-- AllBee Neon stage-only migration 007.
-- Recipient-scoped alerts; authorized internal admins send, recipients may read.
-- Distinct from the old broad public.notifications JSON collection.
BEGIN;

CREATE TABLE IF NOT EXISTS public.member_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  kind text NOT NULL DEFAULT 'general'
    CHECK (kind IN ('general','task','announcement')),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2500),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  read_at timestamptz,
  CONSTRAINT member_notification_read_after_created CHECK (read_at IS NULL OR read_at >= created_at)
);
CREATE INDEX IF NOT EXISTS allbee_member_notifications_inbox
  ON public.member_notifications(recipient_user_id, created_at DESC);

ALTER TABLE public.member_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_notifications FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.member_notifications FROM PUBLIC, anonymous, authenticated;
GRANT SELECT ON public.member_notifications TO authenticated;
GRANT INSERT (recipient_user_id, sender_user_id, kind, title, body)
  ON public.member_notifications TO authenticated;
GRANT UPDATE (read_at) ON public.member_notifications TO authenticated;

DROP POLICY IF EXISTS member_notification_active_gate ON public.member_notifications;
CREATE POLICY member_notification_active_gate ON public.member_notifications
AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT allbee_private.is_active_member()))
WITH CHECK ((SELECT allbee_private.is_active_member()));

DROP POLICY IF EXISTS member_notification_recipient_read ON public.member_notifications;
CREATE POLICY member_notification_recipient_read ON public.member_notifications
FOR SELECT TO authenticated
USING (recipient_user_id = (SELECT NULLIF(auth.user_id(),'')::uuid));

DROP POLICY IF EXISTS member_notification_admin_create ON public.member_notifications;
CREATE POLICY member_notification_admin_create ON public.member_notifications
FOR INSERT TO authenticated
WITH CHECK (
  sender_user_id = (SELECT NULLIF(auth.user_id(),'')::uuid)
  AND (SELECT allbee_private.is_task_admin())
);

DROP POLICY IF EXISTS member_notification_recipient_ack ON public.member_notifications;
CREATE POLICY member_notification_recipient_ack ON public.member_notifications
FOR UPDATE TO authenticated
USING (recipient_user_id = (SELECT NULLIF(auth.user_id(),'')::uuid))
WITH CHECK (recipient_user_id = (SELECT NULLIF(auth.user_id(),'')::uuid));

CREATE OR REPLACE FUNCTION allbee_private.mark_notification_read()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog,public,pg_temp AS $$
BEGIN
  IF OLD.read_at IS NOT NULL THEN
    RAISE EXCEPTION 'Acknowledgement cannot be changed'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.read_at IS NULL THEN
    RAISE EXCEPTION 'Acknowledgement requires an explicit read'
      USING ERRCODE = 'check_violation';
  END IF;
  NEW.read_at := statement_timestamp();
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION allbee_private.mark_notification_read() FROM PUBLIC, anonymous, authenticated;
DROP TRIGGER IF EXISTS allbee_member_notification_ack_guard ON public.member_notifications;
CREATE TRIGGER allbee_member_notification_ack_guard
BEFORE UPDATE ON public.member_notifications FOR EACH ROW
EXECUTE FUNCTION allbee_private.mark_notification_read();

INSERT INTO allbee_platform.schema_migrations (migration_id, description)
VALUES ('007_member_notifications',
  'Recipient-only alerts, approved admin sender, immutable one-way acknowledgment')
ON CONFLICT(migration_id) DO NOTHING;
COMMIT;
