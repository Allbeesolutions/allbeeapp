-- Fresh AllBee database; no old customer data or Supabase API migration.
BEGIN;
CREATE SCHEMA IF NOT EXISTS allbee_platform;
REVOKE ALL ON SCHEMA allbee_platform FROM PUBLIC;

CREATE TABLE IF NOT EXISTS allbee_platform.schema_migrations (
  migration_id text PRIMARY KEY CHECK (char_length(migration_id) BETWEEN 4 AND 100),
  description text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS allbee_platform.service_readiness (
  service text PRIMARY KEY CHECK (
    service IN ('database', 'authentication', 'file_storage', 'realtime', 'server_functions', 'application_api', 'role_isolation')
  ),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  verified_at timestamptz,
  notes text NOT NULL DEFAULT '',
  CONSTRAINT verified_services_have_date CHECK (status <> 'ready' OR verified_at IS NOT NULL)
);

INSERT INTO allbee_platform.schema_migrations(migration_id, description)
VALUES ('001_fresh_foundation', 'Private migration tracking and service readiness for new AllBee Neon PostgreSQL')
ON CONFLICT (migration_id) DO NOTHING;

INSERT INTO allbee_platform.service_readiness(service, status, verified_at, notes)
VALUES
  ('database', 'ready', now(), 'New AllBee-owned Neon PostgreSQL database connection verified'),
  ('authentication', 'pending', NULL, 'Supabase Auth implementation not yet ported'),
  ('file_storage', 'pending', NULL, 'Supabase Storage objects and policies not yet ported'),
  ('realtime', 'pending', NULL, 'Supabase Realtime channels and permissions not yet ported'),
  ('server_functions', 'pending', NULL, 'Supabase Edge Functions not yet ported'),
  ('application_api', 'pending', NULL, 'Existing Supabase JS/RPC client not yet replaced'),
  ('role_isolation', 'pending', NULL, 'Cross-role data restrictions need new authorization testing')
ON CONFLICT (service) DO NOTHING;

REVOKE ALL ON ALL TABLES IN SCHEMA allbee_platform FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA allbee_platform REVOKE ALL ON TABLES FROM PUBLIC;
COMMIT;
