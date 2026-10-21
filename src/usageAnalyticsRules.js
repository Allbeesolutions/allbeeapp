// Non-sensitive, stable route classes only; never include hash payloads or queries.
export const USAGE_SCREENS = Object.freeze([
  'dashboard','tasks','projects','marketing','courses','attendance','team',
  'clients','leads','apn','notifications','progress','knowledge',
  'learning','updates','testing','performance',
]);
const VALID = new Set(USAGE_SCREENS);
const APN_PUBLIC_TABS = new Set(['home','leads','network','targets','learn','achievements','leaderboard']);

export function safeUsageScreen(hash = '') {
  if (typeof hash !== 'string') return null;
  const segments = hash.replace(/^#\/?/, '').split(/[/?]/).map(x => x.toLowerCase());
  const route = segments[0] || 'dashboard';
  if (!VALID.has(route)) return null;
  if (route === 'apn' && segments[1] && !APN_PUBLIC_TABS.has(segments[1])) return null;
  return route;
}

export function customerUsagePayload({ visitorId, sessionId, kind, screen, target = null, seconds = null }) {
  if (!VALID.has(screen) || !['visit','view','tap','active_time'].includes(kind)) return null;
  if (target != null && (kind !== 'tap' || !['nav','button'].includes(target))) return null;
  if (seconds != null && (kind !== 'active_time' || !Number.isInteger(seconds) || seconds < 0 || seconds > 180)) return null;
  return { p_visitor: visitorId, p_session: sessionId, p_kind: kind, p_screen: screen,
    p_target: target, p_seconds: seconds };
}
