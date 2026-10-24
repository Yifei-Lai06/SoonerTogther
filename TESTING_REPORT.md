# Testing Report — Production Beta Upgrade

Date: October 24, 2026. Three kinds of testing are kept separate:
- **Automated:** repeatable scripts in `tests/`.
- **Simulated:** run by hand in a browser, but without a real cloud database.
- **Real end-to-end:** real Supabase, real Google accounts, two devices. **Not run yet** — it needs the setup in SETUP_GUIDE.md.

## 1. Automated tests (all passing)

### Database security — `npm run test:db` (24 tests)
The real SQL migrations run in PGlite (Postgres compiled to WebAssembly) with stand-ins for Supabase's `auth` schema and roles. Each step runs as a specific signed-in user.

| Area | What is proven |
| --- | --- |
| Sign-up | A profile and private row are created per user. The OU badge is set only for a provider-confirmed `@ou.edu` email. |
| Profile privacy | Anonymous visitors can't read profiles. Users can't edit others' profiles or set their own XP, OU badge or XP events. Availability and learning needs are owner-only. Internal functions and the AI quota can't be called by users. |
| Matching | Can't request yourself. Tutor requests require someone who tutors the course. Unknown topics are dropped. Only the two participants can see a request. Duplicate open requests are blocked. Only the recipient can accept, and only once. |
| Sessions | Accepting opens exactly one private conversation. Scheduling only accepts a slot both people marked free. No XP after one confirmation. A user can't forge the other's confirmation. Completion gives +30 each plus the +20 first-timer bonus **once**. Re-confirming does nothing. Badges are awarded. |
| Feedback & connections | Feedback is private (the other person can't read it) and one per person. Helpful gives +10 once. A connection forms only after **both** opt in. |
| Messaging | Members can send and read. The unread count updates and clears. No emails appear in the inbox. Outsiders can't read, send, insert forged messages or add themselves. Length limits work. Blocking stops messages and requests. |
| Study Circles | Joining is idempotent. Users can't insert memberships directly. The circle chat follows membership. Weekly check-in pays once. The milestone triggers at 3 members and can't be farmed by toggling. Leaving removes the chat. |
| AI & feedback | Per-user and global daily quotas are enforced in the database. AI chats are private to their owner. Feedback is write-only, and users can't submit it in someone else's name. |
| OU verification | Only the server can store and check codes. Wrong codes are counted. The right code verifies once (single use). |

### Unit tests — `npm test` (24 tests)
- Matching: weights sum to 100. Ranking is deterministic and explainable. Eligibility gates work. Hobbies never outrank academic fit. Partner and circle matching work.
- XP: levels, no double awards, daily cap, week keys. Demo flows for sessions, connections (including the private "no") and circles.
- Cloud mapping: database rows become app state. Other users' schedules and needs are never in browser state. Session statuses combine correctly. Circle order is kept. Connections carry their history.
- Safety helpers: friendly errors never leak raw database text. Post-login redirects reject other sites (`https://…`, `//…`, `/\…`).

### Static checks
- `npm run typecheck`: passes.
- `npm run lint`: passes with 0 problems.
- `npm run build`: passes (31 routes, plus the proxy).

## 2. Simulated tests (local browser, no cloud database)

Run on `http://localhost:3100` with AI in offline mock mode (`AI_MOCK=1`, so no DeepSeek credits were used):

| Check | Result |
| --- | --- |
| New layout: desktop sidebar, right rail, mobile bottom tabs, mobile top bar | ✓ |
| Home intro card, activity feed, recommendations | ✓ |
| AI page: quick action → streamed reply with Markdown, "AI, not a human" label | ✓ |
| AI API: empty → 400, too long (2,001 chars) → 400, 7th request in a minute → 429 | ✓ |
| Demo chat on desktop (two panes) and phone (full screen, no tab bar) | ✓ |
| Discover on phone, with glossary tooltips | ✓ |
| Settings, session detail, login page (shows "cloud not configured" honestly) | ✓ |
| Console errors on Home, Discover, Messages, AI, Sessions, Settings, Login | none (after fixing one hydration mismatch) |
| Protected APIs without sign-in (`/api/match`, `/api/overlap`, `/api/account`) | 401 ✓ |
| Feedback without a database | 503 with a clear message ✓ |

## 3. Real end-to-end tests — NOT RUN YET

These need your Supabase project, Google OAuth credentials and a Vercel deployment (SETUP_GUIDE steps 1–7). Until then, **none of the following is claimed to work in production**:

1. Google sign-in on a laptop (User A) and a phone (User B) with different accounts
2. Both complete onboarding
3. A offers tutoring; B finds A in Discover and sends a request
4. A accepts; the private conversation appears for both
5. B sends a message; A receives it **without refreshing** (Supabase Realtime)
6. Scheduling, both confirmations, XP awarded once
7. Both join a Study Circle and use its group chat
8. Each user uses the AI assistant independently (real DeepSeek key)
9. Account deletion
10. RLS checked on the hosted database (the same policies passed locally in PGlite)

Once the keys are in place, Claude Code can apply the migrations, deploy (with your approval of the Vercel login), and run this checklist with you on two devices.
