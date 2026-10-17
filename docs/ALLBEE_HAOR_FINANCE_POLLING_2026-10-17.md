# AllBee HAOR — finance polling efficiency follow-up (17 October 2026)

## Scope
After delivering NPWWMI batch `c62a46d`, inspected the Finance account-balance refresh hooks for unnecessary RPC traffic. The live application remains at the separately approved production build. Automatic deployment remains disabled in `.ai/HAO_POLICY.json`.

## Verified code change
- Finance balance polling is session-and-permission scoped, not route-scoped. Removed the `route` hook dependency that previously cancelled and restarted a 30-second balance poll (with an immediate extra fetch) each time a finance-authorized user changed screens.
- Skip the periodic `finance_account_balances` RPC when the browser tab is hidden.
- Refresh immediately on tab visibility restoration so a user returning to a previously hidden tab sees current balances rather than waiting for the next poll.
- Keep the existing on-transaction, withdrawal and APN-wallet data-change refresh effect active, so database changes still trigger balance updates.
- Added regression contract assertions for hidden-tab behavior, proper event listener teardown and route-independent effect dependencies.

## Evidence
- Full build and test certification: **80 test files, 396 tests passing** (`.ai/haor-20261017-batch3/finance-certify.log`).
- Dashboard viewport coverage: **10/10 passing** across the configured widths (`finance-dashboard-ui.log`).
- Accounts viewport coverage: **2/2 passing** (`finance-accounts-ui.log`).
- Admin Concepts / APN AI / Client AI smoke: **3/3 passing** (`finance-nav-smoke.log`).
- Main JS: **501.2 KiB / 525 KiB limit**; total JS: **2512.3 KiB / 2560 KiB limit**.
- Previous NPWWMI release also passed the complete 504-route, 492-APN, 18-deep-AI and 18-chat browser sweeps, disposal-DB finance migration replay, RPC audit and vulnerability scan.

## Boundaries and remaining work
- No production balance values, finance writes, migrations, RLS, user sessions, or provider settings were changed.
- Further query optimization should use authenticated real-world request traces and authorized test sessions; the presence of a polling optimization does not certify optimal latency everywhere.
- Deployment requires a new, explicit owner release approval. Unrelated local evidence and worktree files are left intact.
