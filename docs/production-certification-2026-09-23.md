# ALLBEE Production Certification — 2026-09-23

## Production
- Supabase: `ogacjpwlbhmonycjevml`, ACTIVE_HEALTHY, ap-northeast-1, PostgreSQL 17.6.1.
- Vercel: `https://allbeeapp-six.vercel.app/`; latest READY production deployment commit `8558063`.

## Verified
- 34 Vitest files / 200 tests pass.
- Realtime live probe reached SUBSCRIBED and cleaned up to CLOSED.
- 229/229 public tables have RLS enabled.
- Sensitive tables have no direct INSERT/UPDATE/DELETE grants for anon/authenticated.
- 358 public SECURITY DEFINER functions have explicit search_path settings.
- ai_forecast_v3 is security_invoker.
- Two exact duplicate CRM indexes removed.
- Push worker active; minute cron configured; push queue has zero pending/processing/failed rows.
- Production HTTP 200 with CSP, HSTS, X-Frame-Options, nosniff and referrer policy.
- Root/APN error boundaries present; resilience tests pass.
- Backup restore RPC is transactional and administrator-gated.

## External/account checks
- Supabase allbee1 currently shows an over-quota warning from the previous billing cycle; billing/usage pages were opened in Safari.
- Auth leaked-password protection is disabled; Attack Protection page was opened. No unsafe workaround applied.
- Live authenticated Safari session verified as SUPER ADMIN. Interactive partner/client/employee acceptance remains dependent on role-specific sessions.

## Intentional advisor backlog
- 2 public-schema extensions: pg_trgm, pg_net.
- 3 intentionally public proposal SECURITY DEFINER functions.
- 329 authenticated SECURITY DEFINER RPCs requiring per-function review, not blanket revoke.
- 9 RLS-only/no-policy server tables requiring per-table access review.
- 129 RLS init-plan, 42 multiple-permissive-policy, 75 unused-index and 64 unindexed-FK advisor findings require semantic/performance review before bulk changes.

## Migration alignment
- 20260922183241_harden_app_error_trigger_search_path
- 20260922183355_invalidate_committed_admin_signup_code
- 20260922184057_harden_ai_forecast_v3_security_invoker
- 20260922184135_remove_duplicate_crm_indexes

## Release commits
- a60f68e harden production migration security state
- fcae9ea clean duplicate production indexes
- 8558063 align production migration history
