# SoonerTogether

> **Learn Together. Grow Together. Belong Together.**
> We don't just match students with answers. We match them with people.

SoonerTogether is a social peer-tutoring platform for University of Oklahoma students, built for **SASEHacks for Good**. Students sign in with Google, find peer tutors and study partners, message their matches in real time, join recurring Study Circles, earn XP for verified help, and use an AI study assistant between sessions.

*A student-created project. Not affiliated with, endorsed by, or operated by the University of Oklahoma.*

---

## Two modes, one app

| | **Cloud mode** (beta) | **Demo mode** |
| --- | --- | --- |
| When | Supabase keys are set | No keys, or a visitor clicks "Explore the demo" |
| Accounts | Google sign-in or email link (Supabase Auth) | None — sample student "Alex" |
| Data | PostgreSQL with Row Level Security | Browser `localStorage` |
| Other people | Real students, Realtime updates | Simulated with labeled demo controls |
| Messaging | Real-time 1:1 and circle group chats | Local practice chat |
| AI assistant | Per-user quota, saved history | Works if `DEEPSEEK_API_KEY` is set |

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000 — demo mode until you add Supabase keys
```

To turn on accounts, the database, messaging and AI, follow **[SETUP_GUIDE.md](SETUP_GUIDE.md)**. It's step by step, and you never paste secrets into a chat.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm test` | Unit tests: matching, XP, demo reducer, cloud data mapping, redirect safety |
| `npm run test:db` | Database security tests: the real migrations run in PGlite (in-process Postgres) while impersonating different users |
| `npm run db:migrate` | Apply `supabase/migrations` to your Supabase database (reads `SUPABASE_DB_URL` from `.env.local`) |
| `npm run env:check` | Shows which settings are present in `.env.local` (names only, never values) |
| `npm run typecheck` / `npm run lint` / `npm run build` | TypeScript, ESLint, production build |
| `npm run check` | All of the above |

## Features

- **Google sign-in** (plus email magic link), persistent sessions, protected routes, onboarding for new users, profile editing, sign out, **account deletion**. Any Google account can join the beta. The **OU verified** badge only appears for a provider-confirmed `@ou.edu` address or a verified email code; typing an OU address is never enough.
- **Discover:** the original weighted matcher (35% course, 25% topics, 20% learning style, 15% schedule, 5% interests). Course, meeting format and availability are eligibility gates. In cloud mode it runs **on the server**, so nobody's schedule or learning needs reach other browsers.
- **Session flow:** request → accept/decline → pick a mutually free time → shared Teaching/Discussion/Talk workspace → **both** confirm → XP → private feedback → mutual-only study connection.
- **Messages:** inbox with search and unread counts, real-time 1:1 chats (opened automatically when a request is accepted), Study Circle group chats, "Seen" receipts, pagination, a 2,000-character limit, block and report. Emails are never shown.
- **AI Study Assistant:** DeepSeek, server-side only, streaming replies, quick actions (explain step by step, hint, quiz me, summarize, prep for a session, discussion prompts). Clearly labeled as an AI. Encourages learning over answer-copying. Per-user and global daily caps, a burst limit, timeouts and size limits. Its history is stored separately from human chats.
- **Study Circles:** create, discover, join and leave, capacity limits, weekly schedule, rotating leads, weekly check-ins (+15 XP), group challenges with milestones (+25 XP), group chat.
- **Social:** Instagram-inspired layout (sidebar on desktop, bottom tabs on phones), profile pages, activity feed of positive milestones (opt-out in Settings), notifications.
- **Explanations everywhere:** tap-to-learn glossary terms (Tutor, Tutee, Study Partner, Study Circle, modes, XP, AI Assistant), dismissible "how it works" cards, helpful empty states.
- **OU resources** with official links and **Find Someone to Go With** (opt in, then pair up by shared free time; never books anything with the resource).
- **Beta feedback:** a "Send feedback" button everywhere (rating, category, message). Stored privately and readable at `/admin/feedback` for `ADMIN_EMAILS` or in the Supabase dashboard.

## Security model

- **Row Level Security on every table.** The browser can read only what its user may see. Every important write goes through `SECURITY DEFINER` Postgres functions (`supabase/migrations/0003_functions.sql`). These functions take the user from `auth.uid()` and validate everything inside one transaction.
- **Users can't:** read others' messages, feedback, availability or learning needs; edit others' profiles; insert XP or change their XP, OU badge or first-timer status (column-level grants); forge the other person's session confirmation; join conversations they don't belong to; match with themselves.
- **XP is a ledger with a unique key per reward**, so a reward can't be granted twice. Session XP is capped at 3 per person per day.
- **Secret keys stay on the server.** `SUPABASE_SECRET_KEY` and `DEEPSEEK_API_KEY` are only read in server files guarded by `server-only` (the build fails if client code imports them). `.env*` is git- and Vercel-ignored.
- Post-login redirects only allow same-site paths, so a link can't send users to another site.

## Architecture

```
supabase/migrations/   0001 schema · 0002 RLS + grants + realtime · 0003 server functions · 0004 seed data
src/proxy.ts           refreshes the auth cookie and protects app routes (Next.js 16 "proxy")
src/app/
  page.tsx, login/, privacy/, auth/callback, auth/signout, demo/, admin/feedback
  (app)/               dashboard (Home), match (Discover), messages, ai, circles, sessions,
                       connections, resources, students/[id] (profiles), onboarding, settings
  api/                 match · overlap · go-with · ai · feedback · account · ou
src/lib/
  matching.ts xp.ts state.ts   pure domain logic (shared by demo, cloud and server)
  cloud.ts                     database rows ⇄ app state, actions → RPC calls
  store.tsx                    one store with two backends (demo/localStorage, cloud/Supabase + Realtime)
  hooks.ts                     matches, shared times, go-with candidates, inbox
  supabase/                    browser, server and admin clients
src/server/            directory.ts (server-side matching data) · ai.ts (DeepSeek) · http.ts
tests/                 logic + cloud unit tests · db/ security tests on the real migrations
```

## Deployment

Vercel (Hobby). See SETUP_GUIDE.md step 7 for the exact commands, including the `NODE_OPTIONS` preload this PC needs because its computer name contains non-ASCII characters. Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `DEEPSEEK_API_KEY`, optional `AI_DAILY_LIMIT_PER_USER`, `AI_DAILY_LIMIT_TOTAL`, `ADMIN_EMAILS`, `RESEND_API_KEY`.

## Known limitations

- Times are weekly windows (e.g. "Wednesday afternoon"). There's no calendar sync, video calling, file sharing or push notifications yet.
- Tutor experience is self-described and not verified.
- Matching loads up to about 2,000 profiles per request. That's fine for a beta; a larger launch would move matching into SQL.
- OU email-code verification needs a [Resend](https://resend.com) key. Without one, only `@ou.edu` Google accounts get the badge.
- Supabase's built-in email sender is rate-limited, so Google sign-in is the recommended path.

See [TESTING_REPORT.md](TESTING_REPORT.md) for what has and hasn't been tested.
