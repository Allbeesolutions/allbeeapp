-- AllBee Neon chat acceptance + client-side audit boundary.
-- Requires 001 foundation and 002 auth-backed core.
BEGIN;
ALTER TABLE public.direct_conversations
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

-- Never let browser clients backdate rows, forge identifiers or change roles.
-- Old table-wide INSERT was intentionally replaced with strict per-column grants.
REVOKE INSERT ON public.member_profiles FROM authenticated;
REVOKE INSERT ON public.direct_conversations FROM authenticated;
REVOKE INSERT ON public.direct_messages FROM authenticated;

GRANT INSERT (user_id, display_name, bio, avatar_key)
  ON public.member_profiles TO authenticated;
GRANT INSERT (participant_one_id, participant_two_id, created_by)
  ON public.direct_conversations TO authenticated;
GRANT INSERT (conversation_id, sender_user_id, body)
  ON public.direct_messages TO authenticated;
GRANT UPDATE (accepted_at) ON public.direct_conversations TO authenticated;

DROP POLICY IF EXISTS direct_conversation_recipient_accept ON public.direct_conversations;
CREATE POLICY direct_conversation_recipient_accept
ON public.direct_conversations FOR UPDATE TO authenticated
USING (
  created_by <> (SELECT NULLIF(auth.user_id(), '')::uuid)
  AND (SELECT NULLIF(auth.user_id(), '')::uuid) IN
    (participant_one_id, participant_two_id)
)
WITH CHECK (
  created_by <> (SELECT NULLIF(auth.user_id(), '')::uuid)
  AND (SELECT NULLIF(auth.user_id(), '')::uuid) IN
    (participant_one_id, participant_two_id)
);

-- No private messages until the recipient has explicitly accepted.
DROP POLICY IF EXISTS direct_message_participant_insert ON public.direct_messages;
CREATE POLICY direct_message_participant_insert ON public.direct_messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_user_id = (SELECT NULLIF(auth.user_id(), '')::uuid)
  AND EXISTS (
    SELECT 1 FROM public.direct_conversations c
    WHERE c.id = conversation_id
      AND c.accepted_at IS NOT NULL
      AND sender_user_id IN (c.participant_one_id, c.participant_two_id)
  )
);

-- Make migration replay safe without resetting an already-accepted conversation.
INSERT INTO allbee_platform.schema_migrations (migration_id, description)
VALUES ('003_chat_acceptance', 'Recipient opt-in for DMs and column-limited inserts prevent timestamp/id forgery')
ON CONFLICT (migration_id) DO NOTHING;
COMMIT;
