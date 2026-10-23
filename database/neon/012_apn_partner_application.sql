-- Narrow self-application intake based on the legacy pending APN signup path.
-- This does NOT approve a partner, assign a member role, or issue an APN ID.
-- Only the verified Neon Auth identity may create one immutable pending row.
BEGIN;

CREATE TABLE IF NOT EXISTS allbee_private.apn_application_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  applicant_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action = 'created'),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
REVOKE ALL ON TABLE allbee_private.apn_application_audit FROM PUBLIC, anonymous, authenticated;
ALTER TABLE allbee_private.apn_application_audit ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.apn_partner_apply(
  p_name text,
  p_mobile text,
  p_district text
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp AS $$
DECLARE
  actor uuid := NULLIF(auth.user_id(), '')::uuid;
  actor_role text;
  clean_name text := btrim(p_name);
  clean_district text := btrim(p_district);
  mobile_digits text;
  inserted bigint;
  current_status text;
BEGIN
  IF actor IS NULL OR NOT allbee_private.is_active_member() THEN
    RAISE EXCEPTION 'Active authentication required' USING ERRCODE = 'insufficient_privilege';
  END IF;
  actor_role := allbee_private.current_user_role()->>'role';
  IF actor_role NOT IN ('client', 'partner') THEN
    RAISE EXCEPTION 'This account cannot submit an APN application'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF clean_name IS NULL OR length(clean_name) NOT BETWEEN 2 AND 100
     OR clean_name ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Invalid applicant name' USING ERRCODE = 'check_violation';
  END IF;
  IF p_mobile IS NULL OR p_mobile !~ '^[+0-9 ()-]{7,25}$' THEN
    RAISE EXCEPTION 'Invalid applicant mobile' USING ERRCODE = 'check_violation';
  END IF;
  mobile_digits := regexp_replace(p_mobile, '[^0-9]', '', 'g');
  IF length(mobile_digits) NOT BETWEEN 7 AND 15 THEN
    RAISE EXCEPTION 'Invalid applicant mobile' USING ERRCODE = 'check_violation';
  END IF;
  IF clean_district IS NULL OR length(clean_district) NOT BETWEEN 2 AND 100
     OR clean_district ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION 'Invalid applicant district' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.apn_users(id, user_id, data)
  VALUES (actor::text, actor,
    jsonb_build_object('id', actor::text, 'name', clean_name,
      'mobile', mobile_digits, 'district', clean_district,
      'status', 'pending', 'requestedRole', 'partner'))
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  IF inserted = 1 THEN
    INSERT INTO allbee_private.apn_application_audit(applicant_user_id, action)
    VALUES (actor, 'created');
  END IF;

  SELECT COALESCE(data->>'status', 'pending') INTO current_status
  FROM public.apn_users WHERE user_id = actor;
  RETURN jsonb_build_object('id', actor::text, 'status', current_status);
END
$$;
REVOKE ALL ON FUNCTION public.apn_partner_apply(text,text,text)
  FROM PUBLIC, anonymous, authenticated;
GRANT EXECUTE ON FUNCTION public.apn_partner_apply(text,text,text) TO authenticated;

INSERT INTO allbee_platform.schema_migrations(migration_id, description)
VALUES ('012_apn_partner_application',
  'Verified Auth self-application creates one pending APN row with validated fields and private audit; no approval or role grant')
ON CONFLICT (migration_id) DO NOTHING;
COMMIT;
