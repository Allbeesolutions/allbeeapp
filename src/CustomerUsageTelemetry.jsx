import React, { useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import { safeUsageScreen, customerUsagePayload } from './usageAnalyticsRules';

const CHOICE = 'allbee-customer-usage-consent-v1';
const VISITOR = 'allbee-usage-visitor-v1';
const SESSION = 'allbee-usage-session-v1';
const DNT = typeof navigator !== 'undefined' && (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true);

function loadChoice() {
  try { return DNT ? 'no' : localStorage.getItem(CHOICE); }
  catch { return 'no'; }
}
function ids() {
  let visitorId = localStorage.getItem(VISITOR);
  if (!visitorId) { visitorId = crypto.randomUUID(); localStorage.setItem(VISITOR, visitorId); }
  let record = null;
  const now = Date.now();
  try { record = JSON.parse(sessionStorage.getItem(SESSION) || 'null'); } catch { /* reset corrupt session */ }
  if (!record?.id || now - Number(record.last) > 1800000 || now < Number(record.last))
    record = { id: crypto.randomUUID(), last: now, counted: false };
  const newSession = !record.counted;
  record.counted = true;
  record.last = now;
  sessionStorage.setItem(SESSION, JSON.stringify(record));
  return { visitorId, sessionId: record.id, newSession };
}

/** Authenticated, opt-in route/activity counts only; never collect text, links or inputs. */
export default function CustomerUsageTelemetry() {
  const [uid, setUid] = useState('');
  const [choice, setChoice] = useState(loadChoice);
  const [open, setOpen] = useState(false);
  const choiceRef = useRef(choice);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setUid(data?.session?.user?.id || '');
    }).catch(() => {});
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUid(session?.user?.id || '');
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const choose = (next) => {
    choiceRef.current = next;
    setChoice(next);
    setOpen(false);
    try {
      localStorage.setItem(CHOICE, next);
      if (next === 'no') { localStorage.removeItem(VISITOR); sessionStorage.removeItem(SESSION); }
    } catch { /* no persistent storage = no event IDs after reload */ }
  };

  useEffect(() => {
    if (!uid || choice !== 'yes' || DNT) return undefined;
    let active = true;
    let current = null;
    let visibleSince = document.visibilityState === 'visible' ? Date.now() : 0;
    const emit = (kind, screen, target = null, seconds = null, trackingIds = null) => {
      if (!active || choiceRef.current !== 'yes' || !screen) return;
      try {
        const id = trackingIds || ids();
        const payload = customerUsagePayload({ visitorId: id.visitorId, sessionId: id.sessionId,
          kind, screen, target, seconds });
        if (payload) Promise.resolve(supabase.rpc('app_record_customer_usage', payload)).catch(() => {});
      } catch { /* telemetry is best-effort, never interrupt the app */ }
    };
    const view = () => {
      const next = safeUsageScreen(window.location.hash);
      if (!next) { current = null; return; }
      const id = (() => { try { return ids(); } catch { return null; } })();
      if (!id) return;
      current = next;
      if (id.newSession) emit('visit', current, null, null, id);
      let duplicate = false;
      try {
        const key = 'allbee-usage-last-view-v1';
        const last = JSON.parse(sessionStorage.getItem(key) || 'null');
        const now = Date.now();
        duplicate = last?.screen === current && now - Number(last.at) < 800;
        sessionStorage.setItem(key, JSON.stringify({ screen:current, at:now }));
      } catch { /* only a best-effort StrictMode deduplication */ }
      if (!duplicate) emit('view', current, null, null, id);
      visibleSince = document.visibilityState === 'visible' ? Date.now() : 0;
    };
    const activity = () => {
      if (!visibleSince || !current) return;
      const elapsed = Math.floor((Date.now() - visibleSince) / 1000);
      visibleSince = document.visibilityState === 'visible' ? Date.now() : 0;
      if (elapsed > 0) emit('active_time', current, null, Math.min(180, elapsed));
    };
    const onVisibility = () => {
      activity();
      if (document.visibilityState === 'visible') visibleSince = Date.now();
    };
    const tap = (event) => {
      if (!current || !(event.target instanceof Element)) return;
      const el = event.target.closest('a,button,[role="button"]');
      if (!el || el.closest('form,[data-usage-private],[data-usage-consent]')) return;
      const target = el.closest('nav,aside,[role="navigation"]') ? 'nav' : 'button';
      emit('tap', current, target);
    };
    view();
    const onHash = () => { activity(); view(); };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('pagehide', activity);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('click', tap, true);
    const interval = window.setInterval(activity, 60000);
    return () => {
      active = false;
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('pagehide', activity);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('click', tap, true);
      window.clearInterval(interval);
    };
  }, [uid, choice]);

  if (!uid || DNT) return null;
  const controlStyle = { position: 'fixed', bottom: 10, left: 10, zIndex: 9000,
    background: 'var(--card, #fff)', color: 'var(--text, #1d2430)',
    border: '1px solid var(--border, #aaa)', borderRadius: 10,
    padding: '5px 8px', fontSize: 11, cursor: 'pointer' };
  return <div data-usage-consent="true">
    <button type="button" style={controlStyle} onClick={() => setOpen(true)}
      aria-label="Change optional usage analytics consent">Privacy settings</button>
    {(open || choice === null) && <aside role="dialog" aria-label="Optional usage analytics"
      style={{ position: 'fixed', bottom: 54, left: 10, right: 10, maxWidth: 420, zIndex: 9001,
        background: 'var(--card, #fff)', color: 'var(--text, #1d2430)',
        border: '1px solid var(--border, #aaa)', borderRadius: 12, padding: 16,
        boxShadow: '0 8px 35px #0003', fontSize: 13 }}>
      <strong>Optional AllBee app analytics</strong>
      <p style={{ margin: '8px 0' }}>Allow basic screen visits, navigation taps and time spent to help improve our app? No messages, form contents, finance details or URLs are recorded. You can change this at any time.</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn primary" onClick={() => choose('yes')}>Allow analytics</button>
        <button type="button" className="btn" onClick={() => choose('no')}>No thanks</button>
      </div>
    </aside>}
  </div>;
}
