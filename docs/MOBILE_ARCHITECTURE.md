# Future mobile app: sharing one backend

SoonerTogether is a **website** today. No native app exists yet, and none is claimed. This note explains how a future React Native / Expo app could use **the same accounts, data, messages and progress** without a second backend.

## What is already shared and reusable

| Layer | Where it lives | Mobile-ready because… |
| --- | --- | --- |
| Accounts | Supabase Auth (Google, email link) | Mobile signs in to the same Auth project, so it's the same user ID. |
| Data | Supabase Postgres (`supabase/migrations`) | One database. Every table has Row Level Security, so any client only sees what its user may see. |
| Sensitive actions | Postgres `SECURITY DEFINER` functions (`0003_functions.sql`): `request_session`, `respond_request`, `schedule_session`, `confirm_session`, `submit_feedback`, `join_circle`, `attend_circle`, `toggle_challenge`, `send_message`, `block_user`, `report_user`, … | They run in the database and take the caller from the auth token. Mobile calls the exact same RPCs, so XP, connections and validation behave identically. |
| Realtime | Supabase Realtime on `messages`, `notifications`, `match_requests`, `study_sessions`, … | Same channels and filters from `@supabase/supabase-js` on mobile. |
| Matching | `src/lib/matching.ts` (pure TypeScript), run on the server by `POST /api/match` | Mobile calls the same HTTPS endpoint. Private schedules never reach any client. |
| AI assistant | `POST /api/ai` (DeepSeek key stays server-side, quotas live in the database) | Mobile calls the same endpoint, with the same per-user limits. |
| Domain logic | `src/lib/{matching,xp,state,cloud}.ts` and `types.ts` have no React or Next.js imports | They can be moved into a shared package (e.g. `packages/core`) and imported by both apps. |

## How a mobile client would authenticate

1. Use `@supabase/supabase-js` with the same **project URL and publishable key**. These are public by design; never ship the secret key in an app.
2. Google sign-in: `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "soonertogether://auth/callback" } })` (or native Google Sign-In plus `signInWithIdToken`). Add `soonertogether://**` to Supabase → Auth → Redirect URLs. Store the session in the platform's secure storage (Expo SecureStore).
3. Read with normal queries; RLS applies automatically. Write through the same RPCs the website uses.
4. For the Next.js API routes (`/api/match`, `/api/overlap`, `/api/go-with`, `/api/ai`, `/api/account`), send `Authorization: Bearer <access_token>`. **One small change is needed before mobile:** those routes currently read the session from cookies (`getVerifiedUser` in `src/lib/supabase/server.ts`). Add a fallback that verifies a bearer token with `supabase.auth.getUser(token)`. It's a few lines and doesn't change web behavior.

## Rules to keep it that way

- New business rules go into a database function or a server route, never only into a page component.
- New tables get RLS policies plus a test in `tests/db/security.test.ts`.
- Keep `src/lib/*` framework-free (no `next/*` or React imports), so a mobile app can reuse it.
- Don't create a separate database, user table or XP system for mobile users.

## Not done yet (intentionally)

- No native app and no app-store builds.
- No PWA install prompt. It could be added later with a manifest and a carefully tested service worker. It isn't enabled, to avoid caching problems with authentication.
- No push notifications (would need Expo push or FCM plus a server trigger).
