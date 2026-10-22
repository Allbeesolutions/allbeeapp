# AllBee fresh Neon database — 23 October 2026

Created under **Allbee** (not Hajihaz) organization `org-wispy-tooth-01070087`.
Project: `allbee-core`, ID `icy-mud-74621536`.
Database: `allbee`, PostgreSQL 17, Singapore `aws-ap-southeast-1`.
Old Supabase data is intentionally **not transferred** on owner instruction. Old database is not deleted or changed.

The private `allbee_platform` schema tracks migrations and readiness of seven backend capabilities. Only the PostgreSQL database connection is marked ready. No real customer data is stored in this foundation.

**Secrets:** AllBee-specific Neon CLI login is in a restricted folder outside Git:
`~/Documents/AllBee-Emergency-Rescue-2026-10-22/auth-neon-company-v3/`.
Never commit database passwords, access tokens or connection strings.

**Warning:** The existing AllBee React app uses Supabase Auth, Storage, Realtime, RPCs and Edge Functions. It cannot be redirected to Neon just by changing a URL. Required new work: secure application API and sessions; new-user signup (legacy users excluded), authorization/RLS; file storage; chat/realtime; background/edge functions; deliberate port of existing domain schemas and finance protections; full browser and production acceptance. Do not attempt blanket replay of hundreds of Supabase-specific migrations on Neon.

This foundation makes no production Vercel change. **Do not integrate HajiPay with AllBee.**

Test: `bash scripts/test-neon-foundation.sh` against an isolated private PostgreSQL cluster and run the migration against the new AllBee Neon project only after verifying its organization and database.
