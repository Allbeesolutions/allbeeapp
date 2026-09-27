# APN Team Chat UI — 2026-09-27

Scope: APN Team Chat (#/apn/chat), based on the supplied screenshot. Internal employee chat is unchanged.

Implemented a desktop split pane and mobile conversation-first layout, polished light/dark message bubbles, date separators, persistent composer, touch-visible message actions, search, unread filtering and partner discovery. Friends, district and state rooms share the conversation UI. Existing Supabase RPCs and permissions remain unchanged; no migration required.

Fixed the message scroll container, prevented duplicate sends, preserved failed-send drafts/replies, avoided restoring already-created messages after attachment failure, and ignored stale thread responses. IME composition does not trigger Enter-to-send.

Verified:
- npm test: 45 files, 243 tests passed.
- npm run build: passed; main chunk 488.77 kB / gzip 141.00 kB.
- node scripts/ui/chat-verify.mjs: 33 checks passed, zero failures.
- Mocked partner/district_head/state_head at 320, 360, 375, 390, 430, 768, 1024, 1366, 1440, 1920 px.
- Inbox/thread navigation, long-message wrapping, composer visibility, search beyond the former eight-chat cap, unread filter, reply/failure/retry, district/state rooms, dark mode and reduced motion.
- Browser fixture blocks external requests. Results are local mocked verification, not certification of production permissions, delivery, attachments or realtime.

Evidence: chat-evidence/results.json and six light/dark desktop/mobile screenshots. Logs: /tmp/allbee-chat-{tests,build,browser}.log on the Mac.

Release checklist: review local chat commit; deploy when authorized; then verify real signed-in partner/head accounts, mobile keyboard, attachments and realtime delivery. No production deployment performed for this batch.

Execution: HHC primary; RDC fallback after HHC HTTP 502 for final verification and checkpoint. Pre-existing AGENTS.md, .ai/state.json and .ai/LIVE_UI_RELEASE.json changes excluded.
