-- AllBee Neon stage-only migration 009.
-- A deleted Auth user may still hold an unexpired JWT. RLS must deny them
-- based on live Neon Auth membership, not only a stale token user_id.
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

  -- Refuse tokens belonging to identities absent from the managed Auth store.
  IF NOT EXISTS (SELECT 1 FROM neon_auth."user" WHERE id = actor) THEN
    RETURN FALSE;
  END IF;

  SELECT mr.status INTO state
  FROM allbee_private.member_roles mr
  WHERE mr.user_id = actor;
  RETURN COALESCE(state, 'active') = 'active';
END
$$;
REVOKE ALL ON FUNCTION allbee_private.is_active_member() FROM PUBLIC, anonymous, authenticated;
GRANT EXECUTE ON FUNCTION allbee_private.is_active_member() TO authenticated;

CREATE OR REPLACE FUNCTION allbee_private.current_user_role()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, allbee_private, pg_temp AS $$
DECLARE
  actor uuid;
  result jsonb;
BEGIN
  actor := NULLIF(auth.user_id(), '')::uuid;
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM neon_auth."user" WHERE id = actor) THEN
    RAISE EXCEPTION 'Account identity no longer exists'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT jsonb_build_object('role', mr.role, 'status', mr.status)
    INTO result
  FROM allbee_private.member_roles mr
  WHERE mr.user_id = actor;

  RETURN COALESCE(result, jsonb_build_object('role','client','status','active'));
END
$$;
REVOKE ALL ON FUNCTION allbee_private.current_user_role() FROM PUBLIC, anonymous, authenticated;
GRANT EXECUTE ON FUNCTION allbee_private.current_user_role() TO authenticated;

-- Task helpers must also short-circuit before looking up a role for an
-- Auth identity that no longer exists. Return FALSE rather than a server 500.
CREATE OR REPLACE FUNCTION allbee_private.is_internal_member()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, allbee_private, pg_temp AS $$
BEGIN
  IF NOT allbee_private.is_active_member() THEN RETURN FALSE; END IF;
  RETURN (allbee_private.current_user_role()->>'role') IN
    ('superadmin','admin','accountant','staff','intern');
END
$$;
REVOKE ALL ON FUNCTION allbee_private.is_internal_member() FROM PUBLIC, anonymous, authenticated;
GRANT EXECUTE ON FUNCTION allbee_private.is_internal_member() TO authenticated;

CREATE OR REPLACE FUNCTION allbee_private.is_task_admin()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, allbee_private, pg_temp AS $$
BEGIN
  IF NOT allbee_private.is_active_member() THEN RETURN FALSE; END IF;
  RETURN (allbee_private.current_user_role()->>'role') IN ('superadmin','admin');
END
$$;
REVOKE ALL ON FUNCTION allbee_private.is_task_admin() FROM PUBLIC, anonymous, authenticated;
GRANT EXECUTE ON FUNCTION allbee_private.is_task_admin() TO authenticated;

INSERT INTO allbee_platform.schema_migrations(migration_id,description)
VALUES ('009_deleted_identity_guard',
  'Database authorization requires current managed Auth identity, invalidating deleted users even with unexpired JWT')
ON CONFLICT (migration_id) DO NOTHING;
COMMIT;
