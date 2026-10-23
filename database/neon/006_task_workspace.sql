-- AllBee Neon stage-only migration 006: secure task workspace.
-- Preserve legacy task id/data shape, but use server-trusted UUID assignment
-- columns for authorization instead of spoofable JSON names.
BEGIN;

CREATE TABLE IF NOT EXISTS public.tasks (
  id text PRIMARY KEY CHECK (length(trim(id)) BETWEEN 1 AND 120),
  data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(data) = 'object'),
  owner_user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  assignee_user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'open'
    CHECK (state IN ('open','in_progress','blocked','done','cancelled')),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
CREATE INDEX IF NOT EXISTS allbee_tasks_owner_idx ON public.tasks(owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS allbee_tasks_assignee_idx ON public.tasks(assignee_user_id, updated_at DESC);

REVOKE ALL ON TABLE public.tasks FROM PUBLIC, anonymous, authenticated;
GRANT SELECT ON public.tasks TO authenticated;
GRANT INSERT (id, data, owner_user_id, assignee_user_id, state) ON public.tasks TO authenticated;
GRANT UPDATE (data, state) ON public.tasks TO authenticated;
GRANT DELETE ON public.tasks TO authenticated;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;

-- Internal roles only. A new/unassigned user defaults to 'client', and
-- therefore may NOT create or modify employee tasks.
CREATE OR REPLACE FUNCTION allbee_private.is_internal_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, allbee_private, pg_temp
AS $$
  SELECT (allbee_private.current_user_role()->>'role') IN
    ('superadmin','admin','accountant','staff','intern')
    AND allbee_private.is_active_member()
$$;
REVOKE ALL ON FUNCTION allbee_private.is_internal_member() FROM PUBLIC, anonymous, authenticated;
GRANT EXECUTE ON FUNCTION allbee_private.is_internal_member() TO authenticated;

CREATE OR REPLACE FUNCTION allbee_private.is_task_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, allbee_private, pg_temp
AS $$
  SELECT (allbee_private.current_user_role()->>'role') IN ('superadmin','admin')
    AND allbee_private.is_active_member()
$$;
REVOKE ALL ON FUNCTION allbee_private.is_task_admin() FROM PUBLIC, anonymous, authenticated;
GRANT EXECUTE ON FUNCTION allbee_private.is_task_admin() TO authenticated;

DROP POLICY IF EXISTS task_active_guard ON public.tasks;
CREATE POLICY task_active_guard ON public.tasks AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT allbee_private.is_internal_member()))
WITH CHECK ((SELECT allbee_private.is_internal_member()));

DROP POLICY IF EXISTS task_read_own_or_assigned ON public.tasks;
CREATE POLICY task_read_own_or_assigned ON public.tasks FOR SELECT TO authenticated
USING (
  (SELECT allbee_private.is_task_admin())
  OR (SELECT NULLIF(auth.user_id(), '')::uuid) IN (owner_user_id, assignee_user_id)
);
DROP POLICY IF EXISTS task_create_as_owner ON public.tasks;
CREATE POLICY task_create_as_owner ON public.tasks FOR INSERT TO authenticated
WITH CHECK (owner_user_id = (SELECT NULLIF(auth.user_id(), '')::uuid));
DROP POLICY IF EXISTS task_update_participant ON public.tasks;
CREATE POLICY task_update_participant ON public.tasks FOR UPDATE TO authenticated
USING (
  (SELECT allbee_private.is_task_admin())
  OR (SELECT NULLIF(auth.user_id(), '')::uuid) IN (owner_user_id, assignee_user_id)
)
WITH CHECK (
  (SELECT allbee_private.is_task_admin())
  OR (SELECT NULLIF(auth.user_id(), '')::uuid) IN (owner_user_id, assignee_user_id)
);
DROP POLICY IF EXISTS task_delete_owner_or_admin ON public.tasks;
CREATE POLICY task_delete_owner_or_admin ON public.tasks FOR DELETE TO authenticated
USING (
  (SELECT allbee_private.is_task_admin())
  OR owner_user_id = (SELECT NULLIF(auth.user_id(), '')::uuid)
);

CREATE OR REPLACE FUNCTION allbee_private.stamp_task_updated()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  NEW.updated_at := statement_timestamp();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION allbee_private.stamp_task_updated() FROM PUBLIC, anonymous, authenticated;
DROP TRIGGER IF EXISTS allbee_task_stamp ON public.tasks;
CREATE TRIGGER allbee_task_stamp BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION allbee_private.stamp_task_updated();

INSERT INTO allbee_platform.schema_migrations (migration_id, description)
VALUES ('006_task_workspace', 'Legacy-compatible JSON task rows with UUID-enforced scoped assignments and server timestamps')
ON CONFLICT (migration_id) DO NOTHING;
COMMIT;
