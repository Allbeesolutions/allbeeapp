-- First APN dependency on the fresh Neon backend. This is a read-only,
-- Auth-linked partner directory, NOT the legacy APN workflow or finance port.
-- Browser writes require separately reviewed, server-verified contracts.
BEGIN;

CREATE TABLE IF NOT EXISTS public.apn_users (
  id text PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data) = 'object'),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT apn_user_id_matches_auth CHECK (id = user_id::text),
  CONSTRAINT apn_user_json_id_matches_auth CHECK (data->>'id' IS NULL OR data->>'id' = id)
);

CREATE INDEX IF NOT EXISTS apn_users_updated_idx ON public.apn_users(updated_at DESC);

REVOKE ALL ON TABLE public.apn_users FROM PUBLIC, anonymous, authenticated;
GRANT SELECT ON TABLE public.apn_users TO authenticated;
ALTER TABLE public.apn_users ENABLE ROW LEVEL SECURITY;

-- Never use client-authored JSON role/status/partnerId as an access claim.
-- A stale JWT for a deleted Auth identity fails closed via is_active_member().
CREATE OR REPLACE FUNCTION allbee_private.can_read_apn_user(p_user_id uuid)
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
  IF actor_role IN ('superadmin', 'admin') THEN RETURN TRUE; END IF;
  RETURN actor = p_user_id AND actor_role IN ('partner', 'district_head', 'state_head');
END
$$;
REVOKE ALL ON FUNCTION allbee_private.can_read_apn_user(uuid) FROM PUBLIC, anonymous, authenticated;
GRANT EXECUTE ON FUNCTION allbee_private.can_read_apn_user(uuid) TO authenticated;

DROP POLICY IF EXISTS apn_users_read_verified_role ON public.apn_users;
CREATE POLICY apn_users_read_verified_role ON public.apn_users FOR SELECT TO authenticated
USING ((SELECT allbee_private.can_read_apn_user(user_id)));

INSERT INTO allbee_platform.schema_migrations(migration_id, description)
VALUES ('011_apn_partner_read_boundary',
  'Auth-linked APN partner directory with active-role read isolation; browser writes withheld')
ON CONFLICT (migration_id) DO NOTHING;
COMMIT;
