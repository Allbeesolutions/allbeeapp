# AllBee customer activity analytics — pre-release contract

Status: **staged only**. No production SQL applied and no analytics collection released by this HAOR workstream. The app repository requires restored write permission before opening a PR. The app has a separate current customer/support/chat system: do not confuse those tables with these new voluntary UI events.

## Metrics

- A **visit** means one opted-in signed-in user/device session, starting when first counted and resetting after 30 minutes of inactivity. Do not count each click as a visit.
- A **view** means an approved coarse screen displayed. Ignore dynamic IDs, search terms, hashes/queries and sensitive routes. React StrictMode re-renders within 800 ms are deduplicated.
- A **tap** is a generic approved `nav` or `button` action; never a form value, chat message or literal label.
- **Active seconds** are counted during foreground intervals, capped at 180 seconds per event. In the dashboard, display approximate total minutes.
- **Unique user** means a distinct authenticated Supabase actor during the selected interval; not cross-browser anonymous uniqueness.
- **Returning user** means the same authenticated actor has at least two distinct `visit` session IDs during seven days.
- **Daily visits** use UTC dates. Empty days are represented by zero only after a successful authenticated backend response. Never mask missing schema, auth failure or network errors as zero.

## Privacy and access

1. No collection before explicit consent. Respect Do Not Track and Global Privacy Control. Show a permanent privacy control for opt-out; after withdrawal remove browser visitor/session IDs and stop new telemetry. Previously collected events are subject to the published retention/deletion policy, not immediate historical deletion.
2. Only allow the predetermined screen, kind and target categories. Never store names, IPs, user text, chats, payment details, device command arguments, search terms, or URL paths/IDs.
3. `app_record_customer_usage` resolves actor from verified `auth.uid()` and accepts no browser actor ID. Database RLS denies raw events to non-admins. Reports require `public.is_admin()` after trusted authentication; do not extend the RPC to customer roles.
4. Prevent event spam with concurrent-safe limits: 240 per session/hour and 1,200 per authenticated actor/hour. These are abuse limits rather than pricing quotas.
5. Data remains in the project's database only. No cross-project analytics pooling, copying other tenants, or storing raw clickstreams in marketing providers.

## Release and retention gates

- First: review migration SQL, non-admin denial, authenticated event intake, batch limits, report counts, and analytics UI in an isolated test database.
- Second: use scoped production migration approval, controlled deploy, opt-in test account, and admin viewing test. Never seed fake production totals.
- Retention is **90 days** for optional events. A service-role-only `app_prune_customer_usage(1000)` batch function is staged but **not called or scheduled**. Owner must approve its production schedule, retention notice and historical deletion procedure. Preview migrations do not delete data.
- Test signed-in accounts under Chromium/WebKit and mobile/PWA, anonymous rejection, switching accounts, foreground/background events, accessibility, consent withdrawal, and pagination before acceptance.
