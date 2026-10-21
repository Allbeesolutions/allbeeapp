-- ALLBEE signed-in customer/staff navigation analytics (consent-first).
-- Additive only; no existing business/chat/payment tables modified.
CREATE TABLE IF NOT EXISTS public.app_customer_usage_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 visitor_id uuid NOT NULL,
 session_id uuid NOT NULL,
 kind text NOT NULL CHECK (kind IN ('visit','view','tap','active_time')),
 screen text NOT NULL CHECK (screen IN (
  'dashboard','tasks','projects','marketing','courses','attendance',
  'team','clients','leads','apn','notifications','progress','knowledge',
  'learning','updates','testing','performance'
 )),
 target text CHECK (target IS NULL OR target IN ('nav','button')),
 active_seconds integer CHECK (active_seconds IS NULL OR active_seconds BETWEEN 0 AND 180),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_customer_usage_created_idx
 ON public.app_customer_usage_events(created_at DESC);
CREATE INDEX IF NOT EXISTS app_customer_usage_actor_created_idx
 ON public.app_customer_usage_events(actor_id,created_at DESC);
CREATE INDEX IF NOT EXISTS app_customer_usage_session_idx
 ON public.app_customer_usage_events(session_id,created_at DESC);
ALTER TABLE public.app_customer_usage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_customer_usage_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.app_customer_usage_events TO authenticated;
DROP POLICY IF EXISTS app_customer_usage_admin_read ON public.app_customer_usage_events;
CREATE POLICY app_customer_usage_admin_read ON public.app_customer_usage_events
 FOR SELECT TO authenticated USING(public.is_admin());

-- No direct public-table INSERT. Actor always comes from the verified JWT,
-- not from untrusted browser parameters. Never store chat text, names, IPs,
-- search terms, customer documents, email addresses or URL parameters.
CREATE OR REPLACE FUNCTION public.app_record_customer_usage(
 p_visitor uuid,p_session uuid,p_kind text,p_screen text,
 p_target text DEFAULT NULL,p_seconds integer DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_actor uuid; v_recent integer; v_actor_hour integer;
BEGIN
 v_actor := auth.uid();
 IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='28000'; END IF;
 IF p_visitor IS NULL OR p_session IS NULL OR p_kind IS NULL OR p_screen IS NULL
 OR p_kind NOT IN ('visit','view','tap','active_time')
 OR p_screen NOT IN ('dashboard','tasks','projects','marketing','courses',
  'attendance','team','clients','leads','apn','notifications','progress',
  'knowledge','learning','updates','testing','performance')
 OR (p_target IS NOT NULL AND p_target NOT IN ('nav','button'))
 OR (p_seconds IS NOT NULL AND (p_seconds<0 OR p_seconds>180))
 OR (p_kind<>'tap' AND p_target IS NOT NULL)
 OR (p_kind<>'active_time' AND p_seconds IS NOT NULL)
 THEN RETURN FALSE; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_actor::text));
 SELECT count(*) FILTER (WHERE session_id=p_session),count(*) INTO v_recent,v_actor_hour
 FROM public.app_customer_usage_events
 WHERE actor_id=v_actor AND created_at>now()-INTERVAL '1 hour';
 -- Both session and per-actor budgets apply. Random new session IDs cannot bypass
 -- the account cap across concurrent browser sessions.
 IF v_recent>=240 OR v_actor_hour>=1200 THEN RETURN FALSE; END IF;
 INSERT INTO public.app_customer_usage_events
  (actor_id,visitor_id,session_id,kind,screen,target,active_seconds)
 VALUES (v_actor,p_visitor,p_session,p_kind,p_screen,p_target,p_seconds);
 RETURN TRUE;
END $$;
REVOKE ALL ON FUNCTION public.app_record_customer_usage(uuid,uuid,text,text,text,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.app_record_customer_usage(uuid,uuid,text,text,text,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.app_customer_usage_report()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin() THEN
  RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501';
 END IF;
 SELECT pg_catalog.jsonb_build_object(
  'visits24h',(SELECT count(*) FROM public.app_customer_usage_events WHERE kind='visit' AND created_at>now()-INTERVAL '24 hours'),
  'visits7d',(SELECT count(*) FROM public.app_customer_usage_events WHERE kind='visit' AND created_at>now()-INTERVAL '7 days'),
  'views7d',(SELECT count(*) FROM public.app_customer_usage_events WHERE kind='view' AND created_at>now()-INTERVAL '7 days'),
  'taps7d',(SELECT count(*) FROM public.app_customer_usage_events WHERE kind='tap' AND created_at>now()-INTERVAL '7 days'),
  'visitors7d',(SELECT count(DISTINCT actor_id) FROM public.app_customer_usage_events WHERE kind='visit' AND created_at>now()-INTERVAL '7 days'),
  'returningUsers7d',(SELECT count(*) FROM (
   SELECT actor_id FROM public.app_customer_usage_events
   WHERE kind='visit' AND created_at>now()-INTERVAL '7 days'
   GROUP BY actor_id HAVING count(DISTINCT session_id)>1
  ) repeat_sessions),
  'activeMinutes7d',(SELECT ceil(coalesce(sum(active_seconds),0)/60.0) FROM public.app_customer_usage_events WHERE kind='active_time' AND created_at>now()-INTERVAL '7 days'),
  'daily',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.day),'[]'::jsonb) FROM (
   SELECT to_char(date_trunc('day',created_at),'YYYY-MM-DD') AS day,
    count(*) FILTER (WHERE kind='visit') visits,
    count(*) FILTER (WHERE kind='view') views,
    count(DISTINCT actor_id) users
   FROM public.app_customer_usage_events WHERE created_at>now()-INTERVAL '30 days'
   GROUP BY date_trunc('day',created_at)
  ) d),
  'screens',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.views DESC),'[]'::jsonb) FROM (
   SELECT screen,count(*) views FROM public.app_customer_usage_events
    WHERE kind='view' AND created_at>now()-INTERVAL '7 days'
   GROUP BY screen ORDER BY views DESC LIMIT 20
  ) s),
  'users',(SELECT coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.visits DESC),'[]'::jsonb) FROM (
   SELECT substring(actor_id::text,1,8) actor,
    count(*) FILTER(WHERE kind='visit') visits,
    count(DISTINCT date_trunc('day',created_at)) days_active
   FROM public.app_customer_usage_events WHERE created_at>now()-INTERVAL '7 days'
   GROUP BY actor_id ORDER BY visits DESC LIMIT 50
  ) u)
 ) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.app_customer_usage_report() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.app_customer_usage_report() TO authenticated;

-- Retention needs an approved server-side scheduled cleanup, not an exposed
-- admin-side deletion RPC. Neither migrations nor analytics UI perform deletion.

-- Staged retention implementation. Creating this privileged function does NOT
-- schedule it, call it, or delete rows. Owner must approve service cron later.
CREATE OR REPLACE FUNCTION public.app_prune_customer_usage(p_limit integer DEFAULT 1000)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE removed integer;
BEGIN
 IF p_limit IS NULL OR p_limit<1 OR p_limit>5000 THEN
  RAISE EXCEPTION 'Invalid batch size' USING ERRCODE='22023';
 END IF;
 WITH overdue AS (
  SELECT id FROM public.app_customer_usage_events
  WHERE created_at<now()-INTERVAL '90 days'
  ORDER BY created_at LIMIT p_limit FOR UPDATE SKIP LOCKED
 )
 DELETE FROM public.app_customer_usage_events e USING overdue
 WHERE e.id=overdue.id;
 GET DIAGNOSTICS removed=ROW_COUNT;
 RETURN removed;
END $$;
REVOKE ALL ON FUNCTION public.app_prune_customer_usage(integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.app_prune_customer_usage(integer) TO service_role;
