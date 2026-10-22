-- AllBee fresh Neon auth-backed core. Requires managed Neon Auth + Data API.
-- Intentionally distinct from legacy Supabase schemas and data.
BEGIN;

CREATE SCHEMA IF NOT EXISTS allbee_private;
REVOKE ALL ON SCHEMA allbee_private FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

CREATE TABLE IF NOT EXISTS public.member_profiles (
  user_id uuid PRIMARY KEY REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Member' CHECK (length(trim(display_name)) BETWEEN 1 AND 100),
  bio text NOT NULL DEFAULT '' CHECK (length(bio) <= 2000),
  avatar_key text CHECK (avatar_key IS NULL OR length(avatar_key) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS allbee_private.member_roles (
  user_id uuid PRIMARY KEY REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'client'
    CHECK (role IN ('superadmin','admin','accountant','staff','intern','client','partner','district_head','state_head')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','suspended','terminated')),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.direct_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_one_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  participant_two_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES neon_auth."user"(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ordered_distinct_participants CHECK (participant_one_id < participant_two_id),
  UNIQUE (participant_one_id, participant_two_id)
);
CREATE INDEX IF NOT EXISTS idx_direct_conversations_participant_two
  ON public.direct_conversations(participant_two_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES neon_auth."user"(id),
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 8000),
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation
  ON public.direct_messages(conversation_id, created_at DESC);

-- Browser/API roles never administer member roles or arbitrary conversations.
REVOKE ALL ON TABLE allbee_private.member_roles FROM PUBLIC;
REVOKE ALL ON TABLE allbee_private.member_roles FROM anonymous, authenticated;
REVOKE ALL ON TABLE public.member_profiles, public.direct_conversations, public.direct_messages FROM PUBLIC, anonymous, authenticated;

ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.direct_conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE allbee_private.member_roles ENABLE ROW LEVEL SECURITY;

-- The only browser-editable profile fields do not include the identity or role.
GRANT SELECT, INSERT ON public.member_profiles TO authenticated;
GRANT UPDATE (display_name, bio, avatar_key) ON public.member_profiles TO authenticated;
GRANT SELECT, INSERT ON public.direct_conversations TO authenticated;
GRANT SELECT, INSERT ON public.direct_messages TO authenticated;
GRANT UPDATE (body, edited_at, deleted_at) ON public.direct_messages TO authenticated;

DROP POLICY IF EXISTS member_profile_self_select ON public.member_profiles;
CREATE POLICY member_profile_self_select ON public.member_profiles FOR SELECT TO authenticated
USING ((SELECT NULLIF(auth.user_id(), '')::uuid) = user_id);
DROP POLICY IF EXISTS member_profile_self_insert ON public.member_profiles;
CREATE POLICY member_profile_self_insert ON public.member_profiles FOR INSERT TO authenticated
WITH CHECK ((SELECT NULLIF(auth.user_id(), '')::uuid) = user_id);
DROP POLICY IF EXISTS member_profile_self_update ON public.member_profiles;
CREATE POLICY member_profile_self_update ON public.member_profiles FOR UPDATE TO authenticated
USING ((SELECT NULLIF(auth.user_id(), '')::uuid) = user_id)
WITH CHECK ((SELECT NULLIF(auth.user_id(), '')::uuid) = user_id);

DROP POLICY IF EXISTS direct_conversation_participant_select ON public.direct_conversations;
CREATE POLICY direct_conversation_participant_select ON public.direct_conversations FOR SELECT TO authenticated
USING ((SELECT NULLIF(auth.user_id(), '')::uuid) IN (participant_one_id, participant_two_id));
DROP POLICY IF EXISTS direct_conversation_participant_insert ON public.direct_conversations;
CREATE POLICY direct_conversation_participant_insert ON public.direct_conversations FOR INSERT TO authenticated
WITH CHECK (
  (SELECT NULLIF(auth.user_id(), '')::uuid) = created_by
  AND (SELECT NULLIF(auth.user_id(), '')::uuid) IN (participant_one_id, participant_two_id)
);

DROP POLICY IF EXISTS direct_message_participant_select ON public.direct_messages;
CREATE POLICY direct_message_participant_select ON public.direct_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.direct_conversations c
    WHERE c.id = conversation_id
      AND (SELECT NULLIF(auth.user_id(), '')::uuid) IN (c.participant_one_id, c.participant_two_id)
  )
);
DROP POLICY IF EXISTS direct_message_participant_insert ON public.direct_messages;
CREATE POLICY direct_message_participant_insert ON public.direct_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_user_id = (SELECT NULLIF(auth.user_id(), '')::uuid)
  AND EXISTS (
    SELECT 1 FROM public.direct_conversations c
    WHERE c.id = conversation_id
      AND sender_user_id IN (c.participant_one_id, c.participant_two_id)
  )
);
DROP POLICY IF EXISTS direct_message_sender_edit_within_hour ON public.direct_messages;
CREATE POLICY direct_message_sender_edit_within_hour ON public.direct_messages FOR UPDATE TO authenticated
USING (
  sender_user_id = (SELECT NULLIF(auth.user_id(), '')::uuid)
  AND deleted_at IS NULL
  AND created_at > now() - interval '1 hour'
  AND EXISTS (
    SELECT 1 FROM public.direct_conversations c
    WHERE c.id = conversation_id
      AND sender_user_id IN (c.participant_one_id, c.participant_two_id)
  )
)
WITH CHECK (
  sender_user_id = (SELECT NULLIF(auth.user_id(), '')::uuid)
  AND created_at > now() - interval '1 hour'
  AND EXISTS (
    SELECT 1 FROM public.direct_conversations c
    WHERE c.id = conversation_id
      AND sender_user_id IN (c.participant_one_id, c.participant_two_id)
  )
);

INSERT INTO allbee_platform.schema_migrations (migration_id, description)
VALUES ('002_neon_auth_core', 'Managed Neon Auth member profile, private role and direct-chat tables with per-user row access')
ON CONFLICT (migration_id) DO NOTHING;

COMMIT;
