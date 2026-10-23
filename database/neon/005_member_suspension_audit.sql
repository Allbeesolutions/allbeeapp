-- AllBee Neon security migration 005. Unassigned users are clients by default.
-- A suspended or terminated member may still possess a valid Auth session, but
-- MUST NOT read or mutate application data until reactivated by an owner.
BEGIN;

CREATE OR REPLACE FUNCTION allbee_private.is_active_member()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, allbee_private, pg_temp AS $$
DECLARE
  actor uuid;
  state text;
BEGIN
  actor := NULLIF(auth.user_id(), '')::uuid;
  IF actor IS NULL THEN RETURN FALSE; END IF;
  SELECT mr.status INTO state FROM allbee_private.member_roles mr WHERE mr.user_id=actor;
  RETURN COALESCE(state, 'active') = 'active';
END
$$;
REVOKE ALL ON FUNCTION allbee_private.is_active_member() FROM PUBLIC, anonymous, authenticated;
GRANT EXECUTE ON FUNCTION allbee_private.is_active_member() TO authenticated;

-- RESTRICTIVE policies are conjunctive guards. This retains the earlier
-- per-user/participant permissive policies while blocking suspended accounts.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['member_profiles','direct_conversations','direct_messages'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS allbee_active_member_guard ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY allbee_active_member_guard ON public.%I AS RESTRICTIVE
       FOR ALL TO authenticated
       USING ((SELECT allbee_private.is_active_member()))
       WITH CHECK ((SELECT allbee_private.is_active_member()))', t
    );
  END LOOP;
END $$;

-- Private audit: no client can read/write historical role assignments.
CREATE TABLE IF NOT EXISTS allbee_private.member_role_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  old_role text,
  new_role text,
  old_status text,
  new_status text,
  action text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  changed_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  database_actor text NOT NULL DEFAULT current_user
);
REVOKE ALL ON TABLE allbee_private.member_role_audit FROM PUBLIC, anonymous, authenticated;
ALTER TABLE allbee_private.member_role_audit ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION allbee_private.log_role_change()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, allbee_private, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO allbee_private.member_role_audit
      (user_id, old_role, new_role, old_status, new_status, action)
    VALUES (NEW.user_id, NULL, NEW.role, NULL, NEW.status, 'INSERT');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role IS DISTINCT FROM NEW.role OR OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO allbee_private.member_role_audit
        (user_id, old_role, new_role, old_status, new_status, action)
      VALUES (NEW.user_id, OLD.role, NEW.role, OLD.status, NEW.status, 'UPDATE');
    END IF;
    RETURN NEW;
  ELSE
    INSERT INTO allbee_private.member_role_audit
      (user_id, old_role, new_role, old_status, new_status, action)
    VALUES (OLD.user_id, OLD.role, NULL, OLD.status, NULL, 'DELETE');
    RETURN OLD;
  END IF;
END
$$;
REVOKE ALL ON FUNCTION allbee_private.log_role_change() FROM PUBLIC, anonymous, authenticated;
DROP TRIGGER IF EXISTS allbee_role_audit_trigger ON allbee_private.member_roles;
CREATE TRIGGER allbee_role_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON allbee_private.member_roles
  FOR EACH ROW EXECUTE FUNCTION allbee_private.log_role_change();

INSERT INTO allbee_platform.schema_migrations (migration_id, description)
VALUES ('005_member_suspension_audit', 'Restrictive per-request member status gate and private audited role changes')
ON CONFLICT (migration_id) DO NOTHING;
COMMIT;
