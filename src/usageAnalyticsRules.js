// Consent must not override browser-level privacy preferences.
export function privacySignalEnabled(preferences) {
  return preferences?.doNotTrack === '1' || preferences?.globalPrivacyControl === true;
}

// Non-sensitive, stable route classes only; never include hash payloads or queries.
export const USAGE_SCREENS = Object.freeze([
  'dashboard','tasks','projects','marketing','courses','attendance','team',
  'clients','leads','apn','notifications','progress','knowledge',
  'learning','updates','testing','performance',
  'client_home','apn_home','apn_leads','apn_network','apn_targets',
  'apn_learn','apn_achievements','apn_leaderboard',
]);
const VALID = new Set(USAGE_SCREENS);
const APN_PUBLIC_TABS = new Set(['home','leads','network','targets','learn','achievements','leaderboard']);

export function safeUsageScreen(hash = '') {
  if (typeof hash !== 'string') return null;
  const segments = hash.replace(/^#\/?/, '').split(/[/?]/).map(x => x.toLowerCase());
  const route = segments[0] || 'dashboard';
  // Only count explicitly approved coarse screens, not dynamic IDs, private
  // chat, support, wallet, profile, or AI conversation routes.
  if (route === 'client') return segments[1] === 'home' ? 'client_home' : null;
  if (route === 'apn') {
    const section = segments[1] || 'home';
    return APN_PUBLIC_TABS.has(section) ? 'apn_' + section : null;
  }
  return VALID.has(route) ? route : null;
}

export function customerUsagePayload({ visitorId, sessionId, kind, screen, target = null, seconds = null }) {
  if (!VALID.has(screen) || !['visit','view','tap','active_time'].includes(kind)) return null;
  if (target != null && (kind !== 'tap' || !['nav','button'].includes(target))) return null;
  if (seconds != null && (kind !== 'active_time' || !Number.isInteger(seconds) || seconds < 0 || seconds > 180)) return null;
  return { p_visitor: visitorId, p_session: sessionId, p_kind: kind, p_screen: screen,
    p_target: target, p_seconds: seconds };
}
