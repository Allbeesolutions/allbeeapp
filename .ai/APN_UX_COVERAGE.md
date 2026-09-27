# APN UI/UX transformation — certified 2026-09-28

Scope: complete APN partner experience across desktop/mobile, role-specific District/State Head command surfaces, forms, empty/error/loading states, keyboard accessibility, dark mode, reduced motion, login and account gates.

Automated isolated-browser certification: **492 / 492 checks passed** across widths 320, 360, 375, 390, 430, 768, 1024 and 1440 for partner, district_head and state_head roles. External requests were blocked by the verifier. Evidence is generated locally under `.ai/apn-ux-evidence/` and is intentionally not committed.

Routes certified: home, leads, wallet, network, chat, targets, quotations, documents, agreements, notifications, learn, withdrawals, AI, support, achievements, leaderboard, district command and profile. Additional interaction checks cover mobile drawer/focus/Escape/backdrop/navigation, global APN search, narrow quotation/lead forms, agreement reader, support retry recovery, AI failure/retry, network tabs/detail/retry, role command subviews, account gates, partner login, dark mode and reduced motion.

Project regression: 48 test files / 257 tests passed; Vite production build passed.
