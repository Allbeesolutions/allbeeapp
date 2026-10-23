-- AllBee fresh Neon staging migration 004.
-- One-way recipient consent, server-owned chat timestamps, scrubbed soft-deletes,
-- and a non-escalating read-only endpoint for current user's role.
BEGIN;

CREATE OR REPLACE FUNCTION allbee_private.stamp_accepted_chat()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  -- UPDATE grants permit changing only accepted_at. A recipient can accept
  -- an invitation exactly once; the timestamp must come from PostgreSQL.
  IF OLD.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation acceptance cannot be changed.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.accepted_at IS NULL THEN
    RAISE EXCEPTION 'An invitation must be explicitly accepted.'
      USING ERRCODE = 'check_violation';
  END IF;
  NEW.accepted_at := statement_timestamp();
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION allbee_private.stamp_accepted_chat() FROM PUBLIC, anonymous, authenticated;
DROP TRIGGER IF EXISTS allbee_chat_acceptance_guard ON public.direct_conversations;
CREATE TRIGGER allbee_chat_acceptance_guard BEFORE UPDATE ON public.direct_conversations
  FOR EACH ROW EXECUTE FUNCTION allbee_private.stamp_accepted_chat();

CREATE OR REPLACE FUNCTION allbee_private.stamp_message_change()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'A deleted message cannot be changed.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    -- A soft-delete irreversibly removes original content; no invisible
    -- deleted text can be retrieved through permitted SELECT queries.
    IF NEW.deleted_at IS NULL THEN
      RAISE EXCEPTION 'Deletion cannot be undone.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    NEW.deleted_at := statement_timestamp();
    NEW.body := '[Deleted message]';
    NEW.edited_at := NULL;
  ELSIF NEW.body IS DISTINCT FROM OLD.body THEN
    NEW.edited_at := statement_timestamp();
  ELSIF NEW.edited_at IS DISTINCT FROM OLD.edited_at THEN
    RAISE EXCEPTION 'Edit timestamps are server-owned.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION allbee_private.stamp_message_change() FROM PUBLIC, anonymous, authenticated;
DROP TRIGGER IF EXISTS allbee_message_mutation_guard ON public.direct_messages;
CREATE TRIGGER allbee_message_mutation_guard BEFORE UPDATE ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION allbee_private.stamp_message_change();

-- Schema allbee_private is not exposed through Neon Data API. The only
-- callable read API below returns *the current verified session's* role.
-- An unassigned but authenticated user is a client, never an admin.
CREATE OR REPLACE FUNCTION allbee_private.current_user_role()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, allbee_private, pg_temp AS $$
DECLARE
  actor uuid;
  result jsonb;
BEGIN
  actor := nullif(auth.user_id(), '')::uuid;
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE='insufficient_privilege';
  END IF;
  SELECT jsonb_build_object('role', mr.role, 'status', mr.status)
    INTO result
  FROM allbee_private.member_roles mr
  WHERE mr.user_id = actor;
  RETURN COALESCE(result, jsonb_build_object('role', 'client', 'status', 'active'));
END
$$;
REVOKE ALL ON FUNCTION allbee_private.current_user_role() FROM PUBLIC, anonymous, authenticated;
GRANT USAGE ON SCHEMA allbee_private TO authenticated;
GRANT EXECUTE ON FUNCTION allbee_private.current_user_role() TO authenticated;

-- This public RPC has no caller-controlled user ID or role parameters.
-- It executes with the authenticated caller's identity, not supplied metadata.
CREATE OR REPLACE FUNCTION public.my_member_access()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, allbee_private, pg_temp
AS $$ SELECT allbee_private.current_user_role() $$;
REVOKE ALL ON FUNCTION public.my_member_access() FROM PUBLIC, anonymous, authenticated;
GRANT EXECUTE ON FUNCTION public.my_member_access() TO authenticated;

INSERT INTO allbee_platform.schema_migrations (migration_id, description)
VALUES (
  '004_chat_mutation_role_guard',
  'One-way server-timestamped invitations, scrubbed soft deletes and read-only self-role RPC'
)
ON CONFLICT (migration_id) DO NOTHING;

COMMIT;
