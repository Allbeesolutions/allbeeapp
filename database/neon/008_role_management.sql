-- AllBee Neon stage-only migration 008.
-- Controlled superadmin role lifecycle with actor-attributed private audit.
-- This is NOT an initial-superadmin bootstrap; that remains company-owner SQL.
BEGIN;

ALTER TABLE allbee_private.member_role_audit
  ADD COLUMN IF NOT EXISTS actor_user_id uuid;

-- Preserve the original maintenance audit, now add the verified JWT actor.
CREATE OR REPLACE FUNCTION allbee_private.log_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, allbee_private, pg_temp AS $$
DECLARE actor uuid;
BEGIN
  actor := NULLIF(auth.user_id(), '')::uuid;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO allbee_private.member_role_audit
      (user_id, old_role, new_role, old_status, new_status, action, actor_user_id)
    VALUES (NEW.user_id, NULL, NEW.role, NULL, NEW.status, 'INSERT', actor);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role IS DISTINCT FROM NEW.role OR OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO allbee_private.member_role_audit
        (user_id, old_role, new_role, old_status, new_status, action, actor_user_id)
      VALUES (NEW.user_id, OLD.role, NEW.role, OLD.status, NEW.status, 'UPDATE', actor);
    END IF;
    RETURN NEW;
  ELSE
    INSERT INTO allbee_private.member_role_audit
      (user_id, old_role, new_role, old_status, new_status, action, actor_user_id)
    VALUES (OLD.user_id, OLD.role, NULL, OLD.status, NULL, 'DELETE', actor);
    RETURN OLD;
  END IF;
END
$$;
REVOKE ALL ON FUNCTION allbee_private.log_role_change() FROM PUBLIC, anonymous, authenticated;

-- A narrowly-scoped SECURITY DEFINER is unavoidable to alter private roles.
-- Privileges are delegated to a checked *active superadmin JWT user* only.
-- Do not accept owner claims, user metadata, company IDs or supplied actor IDs.
CREATE OR REPLACE FUNCTION public.manage_member_role(
  p_target_user_id uuid,
  p_role text,
  p_status text DEFAULT 'active'
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, allbee_private, pg_temp
AS $$
DECLARE
  actor uuid := NULLIF(auth.user_id(), '')::uuid;
  access jsonb;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='insufficient_privilege';
  END IF;

  access := allbee_private.current_user_role();
  IF access->>'role' IS DISTINCT FROM 'superadmin'
    OR access->>'status' IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Only an active company superadmin can manage roles'
      USING ERRCODE='insufficient_privilege';
  END IF;

  IF p_target_user_id IS NULL OR p_target_user_id = actor THEN
    RAISE EXCEPTION 'A superadmin cannot modify their own role or lifecycle'
      USING ERRCODE='insufficient_privilege';
  END IF;

  IF p_role NOT IN
    ('superadmin','admin','accountant','staff','intern','client','partner','district_head','state_head')
    OR p_role IS NULL THEN
    RAISE EXCEPTION 'Unknown member role' USING ERRCODE='check_violation';
  END IF;

  IF p_status NOT IN ('active','suspended','terminated') OR p_status IS NULL THEN
    RAISE EXCEPTION 'Unknown member status' USING ERRCODE='check_violation';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM neon_auth."user" WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'Target member does not exist' USING ERRCODE='foreign_key_violation';
  END IF;

  INSERT INTO allbee_private.member_roles(user_id,role,status,changed_at)
  VALUES (p_target_user_id,p_role,p_status,statement_timestamp())
  ON CONFLICT(user_id) DO UPDATE
    SET role = EXCLUDED.role,
        status = EXCLUDED.status,
        changed_at = statement_timestamp();

  RETURN jsonb_build_object(
    'user_id', p_target_user_id,
    'role', p_role,
    'status', p_status
  );
END
$$;

REVOKE ALL ON FUNCTION public.manage_member_role(uuid,text,text)
  FROM PUBLIC, anonymous, authenticated;
GRANT EXECUTE ON FUNCTION public.manage_member_role(uuid,text,text)
  TO authenticated;

INSERT INTO allbee_platform.schema_migrations(migration_id,description)
VALUES ('008_role_management',
  'Only active superadmins can change another existing member role or status; actor-attributed audit')
ON CONFLICT(migration_id) DO NOTHING;
COMMIT;
