# ALLBEE mascot humanisation verification — 2 October 2026

The shared mascot now animates its eyes, mouth, wrists, arms, legs and body using a jointed SVG rig built from the approved PNG. The canonical image remains unchanged (SHA-256 cd41701c8695dda0568ea0d4df02e28e87a3ed2ca133d1dd46f9c04d81e470d0) and is the exact reduced-motion fallback.

The floating character takes short, slow walks at 12 CSS pixels per second with 7–16 second pauses. It stops immediately on interaction and resumes after a touch greeting closes. It checks the whole travel corridor for controls, yields during page transitions/editing/overlays, and searches nearby clear resting spots when mobile actions occupy its initial position. Greetings clear on screen changes so the previous interaction cannot block relocation.

A first tap says Hi or Hello with the available user's first name and offers Ask AI. Ask AI, or a second mascot activation, uses the existing authorised AI route. Keyboard activation focuses the AI action. Contextual text nudges are spaced 65–110 seconds apart and capped at three per session. Shared consumers cover APN, employee workspaces, enabled client accounts, login help and AI welcome/working graphics.

## Verified pre-release acceptance

- Isolated committed baseline: 726d9538d687d5450b6fbd50932f636be257a6ca.
- Full regression: 70 files / 348 tests passed, including 17 mascot tests.
- All 11 edge authorization contracts passed.
- Production build passed; main bundle 515.6 KiB / 525 KiB, total JavaScript 2492.2 KiB / 2560 KiB.
- Browser verification: 497 checks passed, zero page errors.
- Eight widths: 320, 360, 375, 390, 412, 430, 768 and 1440.
- Control collision sweep: 18 APN destinations at three scroll positions for every width.
- Real pointer, touch and Enter interactions; named greetings; slow roaming, alternate leg movement, hover pause, delayed help, reduced motion and blocked travel checked with the production components.
- Staff/intern routing, client AI entitlement, client home-to-AI navigation, mobile prompt-stack relocation, focused editors and overlays checked.
- Five representative captures: workspace 1440, APN 390, client overview 390, client AI 390 and login 390. Rig inspected at 220px.
- Canonical asset and diff checks passed.

Authenticated browser tests used isolated fixtures and blocked external requests. Sources were verified in a detached worktree to exclude concurrent chat edits, then compared byte-for-byte with the scoped primary files. The normal release gate additionally verifies the pushed commit, clean-archive deployment, production build IDs and live mascot behavior on both configured domains. Release evidence is retained under .ai/mascot-humanise.
