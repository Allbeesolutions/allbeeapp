import { readFile } from 'node:fs/promises';
const rules = {
  'admin-users': [/getUser\(/, /SUPABASE_SERVICE_ROLE_KEY/],
  'username-login': [/auth_preflight_rate_limit/, /signInWithPassword/],
  'ai-chat': [/verifyUser\(/, /edge_user_rate_limit/, /429|rate/i],
  'ai-chat-v2': [/verifyUser\(/, /edge_user_rate_limit/, /429|rate/i],
  'ai-crm-action': [/getUser\(/, /ai_crm_action_claim/],
  'ai-memory-runtime': [/getUser\(/, /x-ai-memory-worker-key/, /Worker authorization required/],
  'ai-crm-worker': [/x-allbee-worker-key/, /Worker authentication required/],
  'ai-crm-webhook': [/verifyResend/, /verifyMeta/, /signature invalid/],
  'notification-push-worker': [/x-notification-push-worker-key/, /Worker authentication required/],
  'founder-lockdown': [/timingSafeEqual/, /reserveAttempt/, /RATE_MAX/],
  'apn-ai': [/verifyUser\(/, /apn_ai_usage_tick/, /HOURLY_CAP/],
};
let failed = false;
for (const [name, patterns] of Object.entries(rules)) {
  const src = await readFile(`supabase/functions/${name}/index.ts`, 'utf8');
  const missing = patterns.filter((p) => !p.test(src));
  if (missing.length) { failed = true; console.error(`[edge-auth] ${name}: FAIL (${missing.length} required guards missing)`); }
  else console.log(`[edge-auth] ${name}: PASS`);
}
if (failed) process.exit(1);
