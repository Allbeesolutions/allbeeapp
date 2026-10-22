# AllBee customer analytics — staged production activation and blocker

## Current release

AllBee customer-analytics UI and SQL have been implemented, reviewed, and certified in disposable PostgreSQL. **It is not correct to represent tracking as production-active until the exact AllBee database has received the migration and its RLS/privilege checks pass.**

The app now has an explicit frontend release flag `VITE_CUSTOMER_ANALYTICS_ENABLED`. It is **disabled by default**. While disabled, analytics consent UI is not mounted and the Admin "Customer activity" tab is not exposed. This avoids collecting browser consent or attempting missing RPC calls on older databases.

## Project boundary

The AllBee app's existing project reference in the owner's local config is `ogacjpwlbhmonycjevml`. The currently accessible Supabase integration lists only unrelated projects, and the Mac Supabase CLI account does **not** list this AllBee project. **Never apply AllBee analytics migrations to Daavah, Suplaykart, or any similarly named project.**

## Exact verification and release steps

1. Connect the correct AllBee Supabase project/organization and confirm the ID and project owner without exposing API keys.
2. Review and back up the production schema and current migration list.
3. Review/apply the already-committed additive migration `supabase/migrations/20261021221500_customer_usage_analytics.sql` on **that project only**. This step is not executed as part of this commit or the Vercel deployment.
4. Independently check: RLS enabled, anonymous users cannot read/write raw events, non-admin authenticated users cannot retrieve aggregates, administrator aggregates are correct, usage RPC input limits and concurrent rate limits hold, and cleanup function privileges cannot be used by ordinary clients.
5. Confirm AllBee privacy disclosure and retention policy. The staged 90-day batch-pruning function is **not scheduled** by app deployment.
6. Set Vercel production `VITE_CUSTOMER_ANALYTICS_ENABLED=true` **only after** the checks above succeed, rebuild/deploy an exact CI-passing SHA, verify both domains and role-specific navigation, then test explicit opt-in/out with authorized accounts. If the flag remains absent or false, the rest of AllBee may be safely released while analytics stays dormant.
7. Schedule bounded retention cleanup only with confirmed privileged runner credentials, audit logging, dry-run counts and explicit review of its timezone/cadence. Never delete production records merely to create a demonstration dashboard.

## Tests

`src/analyticsReleaseGate.test.js` verifies default-off, invalid values and explicit true. `src/CustomerUsageDashboard.test.jsx` verifies the hidden tab in the staged state, plus previously tested valid admin reports. Existing consent, DNT/GPC, account isolation, backend SQL and CI tests remain active.

## Payments

AllBee must use its own independently selected future payment provider. **Never integrate HajiPay**; see `ALLBEE_PAYMENT_BOUNDARY_2026-10-22.md`.
