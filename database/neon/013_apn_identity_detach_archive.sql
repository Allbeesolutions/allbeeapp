-- Preserve APN business identity/history when an Auth account is removed.
-- The legacy admin-users permanent-delete path retains its APN row rather
-- than cascading it away; a deleted row is visible only to a superadmin.
BEGIN;

ALTER TABLE public.apn_users ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.apn_users DROP CONSTRAINT IF EXISTS apn_users_user_id_fkey;
ALTER TABLE public.apn_users ADD CONSTRAINT apn_users_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION allbee_private.archive_detached_apn_user()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF OLD.user_id IS NOT NULL AND NEW.user_id IS NULL THEN
    NEW.data := NEW.data || jsonb_build_object(
      'status', 'deleted', 'archived', true,
      'deletedAt', (extract(epoch FROM statement_timestamp()) * 1000)::bigint,
      'deletedBy', 'auth-identity-removal');
    NEW.updated_at := statement_timestamp();
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION allbee_private.archive_detached_apn_user()
  FROM PUBLIC, anonymous, authenticated;
DROP TRIGGER IF EXISTS apn_user_auth_detach ON public.apn_users;
CREATE TRIGGER apn_user_auth_detach BEFORE UPDATE OF user_id ON public.apn_users
  FOR EACH ROW EXECUTE FUNCTION allbee_private.archive_detached_apn_user();

ALTER TABLE public.apn_users DROP CONSTRAINT IF EXISTS apn_user_detached_archived;
ALTER TABLE public.apn_users ADD CONSTRAINT apn_user_detached_archived
  CHECK (user_id IS NOT NULL OR data @> '{"status":"deleted","archived":true}'::jsonb);

DROP POLICY IF EXISTS apn_users_read_verified_role ON public.apn_users;
DROP FUNCTION IF EXISTS allbee_private.can_read_apn_user(uuid);
CREATE OR REPLACE FUNCTION allbee_private.can_read_apn_user(p_user_id uuid, p_status text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, allbee_private, pg_temp AS $$
DECLARE
  actor uuid;
  actor_role text;
BEGIN
  IF NOT allbee_private.is_active_member() THEN RETURN FALSE; END IF;
  actor := NULLIF(auth.user_id(), '')::uuid;
  SELECT role INTO actor_role FROM allbee_private.member_roles WHERE user_id = actor;
  actor_role := COALESCE(actor_role, 'client');
  IF actor_role = 'superadmin' THEN RETURN TRUE; END IF;
  IF p_status = 'deleted' THEN RETURN FALSE; END IF;
  IF actor_role = 'admin' THEN RETURN TRUE; END IF;
  RETURN COALESCE(actor = p_user_id, FALSE)
    AND actor_role IN ('partner', 'district_head', 'state_head');
END
$$;
REVOKE ALL ON FUNCTION allbee_private.can_read_apn_user(uuid,text)
  FROM PUBLIC, anonymous, authenticated;
GRANT EXECUTE ON FUNCTION allbee_private.can_read_apn_user(uuid,text) TO authenticated;
CREATE POLICY apn_users_read_verified_role ON public.apn_users FOR SELECT TO authenticated
USING (allbee_private.can_read_apn_user(user_id, data->>'status'));

INSERT INTO allbee_platform.schema_migrations(migration_id, description)
VALUES ('013_apn_identity_detach_archive',
  'Auth deletion retains APN row as archived history; deleted rows visible only to active superadmins')
ON CONFLICT (migration_id) DO NOTHING;
COMMIT;
