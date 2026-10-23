-- AllBee Neon staging migration 010.
-- Neon Auth identity lifecycle cascades to member_roles. Keep the private audit
-- trigger functional when an Auth service worker (not the app's SQL owner)
-- performs an authorized account removal.
BEGIN;

-- Only this non-exposed, trigger-only function receives definer privileges.
-- It writes fixed, validated columns to an internal audit table; there is
-- no dynamic SQL and no arbitrary user input or exposed RPC endpoint.
ALTER FUNCTION allbee_private.log_role_change() SECURITY DEFINER;
ALTER FUNCTION allbee_private.log_role_change()
  SET search_path TO pg_catalog, allbee_private, pg_temp;
REVOKE ALL ON FUNCTION allbee_private.log_role_change()
  FROM PUBLIC, anonymous, authenticated;

INSERT INTO allbee_platform.schema_migrations(migration_id,description)
VALUES ('010_role_audit_service_maintenance',
  'Preserve append-only role audit when restricted Neon Auth service removes an identity')
ON CONFLICT (migration_id) DO NOTHING;
COMMIT;
