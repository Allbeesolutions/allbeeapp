# Quarantined, unverified Neon port drafts

These files are **not executable migrations or deployable server code**. They are
preserved only as reference material for deliberate, tested ports. Never apply
the `.sql.draft` files to any database or deploy `founder-lockdown.js.draft`.

The former `database/neon/011`–`021` files were committed to the HAOR branch
without a successful migration-chain replay or staging apply. A read-only
check of the isolated Neon staging branch on 24 October 2026 confirmed only
`001`–`010` in `allbee_platform.schema_migrations`, five public app tables,
no `public.apn_users`, `public.profiles`, or `public.emergency_lockdown`, and
zero Auth users. They do **not** constitute legacy migration parity.

Examples of blockers in these drafts:

- `011` references `public.apn_users`, which the verified foundation does not
  create; it also uses the Supabase `anon` role and `auth.uid()` API.
- `012` depends on `apn_users` and `apn_revenue_collections` before either is
  available. `014` itself assumes the absent `public.profiles`, Supabase Auth,
  Storage and Realtime schemas.
- `019` contains the malformed token `p_// la`, so its function is not valid SQL.
- `021` omits `code_hash`, which its companion server draft queries. The server
  draft also disables TLS certificate verification and has non-atomic attempt
  counting; it is not suitable for a founder emergency control.

Do not repair these by blanket replay of legacy Supabase SQL. Define each
replacement contract against Neon Auth/Data API and the existing client, port
in dependency order, replay the full chain in disposable PostgreSQL, test RLS
with all applicable roles, then verify on the isolated Neon branch. Production
AllBee remains on Supabase until full parity, rollback and owner acceptance.
