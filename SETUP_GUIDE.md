# SoonerTogether — Setup Guide (beginner friendly)

This guide turns SoonerTogether from a demo into a real website with Google sign-in, a cloud database, real-time messaging and the AI assistant.

**Golden rule:** secret keys go **only** into the file `.env.local` on your laptop, or into Vercel's settings page. Never paste them into a chat, an email, a screenshot, or code. Claude Code will never ask for them.

**Time needed:** about 45–60 minutes the first time.
**Cost:** everything here works on free plans (Supabase Free, Vercel Hobby, Google Cloud OAuth). DeepSeek is pay-as-you-go: you set the limits (step 6).

| Who does what | |
| --- | --- |
| **You** (needs your accounts, passwords or approval) | Create the Supabase project, create Google OAuth credentials, copy keys into `.env.local` and Vercel, approve the Vercel login, test with two Google accounts |
| **Claude Code** (once your keys are in `.env.local`) | Run database migrations, check your env file (names only, never values), run tests, build, deploy with your approval, run the cross-device test with you |

---

## Step 0 — Open a terminal in the project

In VS Code or Windows Terminal, go to the project folder:

```bash
cd C:\Users\yifei\OneDrive\desktop\Dream\Coding\soonertogether
```

Then create your private settings file from the template:

```bash
copy .env.example .env.local
```

Open `.env.local` in your editor. You'll fill it in during the next steps.

---

## Step 1 — Create the Supabase project (the cloud database)

1. Go to <https://supabase.com> and sign in (GitHub or email).
2. Click **New project**.
   - Name: `soonertogether`
   - Database password: click **Generate a password**, then **save it in your password manager**. You need it once in step 3.
   - Region: **Central US** (closest to Oklahoma), or any US region.
   - Plan: **Free**.
3. Wait 1–2 minutes until the project is ready.

## Step 2 — Copy the project URL and keys into `.env.local`

In your Supabase project:

1. Open **Project Settings → Data API** (sometimes shown as **API**). Copy **Project URL** into:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   ```
2. Open **Project Settings → API Keys**.
   - Copy the **Publishable key** (starts with `sb_publishable_`) into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`.
     This one is designed to be public: the database's security rules protect the data.
   - Under **Secret keys**, create or reveal a secret key (starts with `sb_secret_`) and copy it into `SUPABASE_SECRET_KEY=`.
     **This one is powerful.** It skips the security rules. It must only ever be in `.env.local` and Vercel's env settings.
   - If your dashboard only shows "Legacy API keys": the **anon** key works as the publishable key and **service_role** works as the secret key (use `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` as the names).
3. Save the file.

## Step 3 — Create the database tables

1. In Supabase, click **Connect** (top of the dashboard) and choose the **Session pooler** connection string (it works on any network).
2. Copy the URI, replace `[YOUR-PASSWORD]` with the password from step 1, and put it in `.env.local`:
   ```
   SUPABASE_DB_URL=postgresql://postgres.xxxx:YOUR-PASSWORD@aws-0-us-east-2.pooler.supabase.com:5432/postgres
   ```
   This one is only for your laptop. **Don't** add it to Vercel.
3. Tell Claude Code "the database URL is in .env.local", or run it yourself:
   ```bash
   npm run db:migrate
   ```
   You should see four `Applying … ok` lines. It's safe to run again: it skips migrations that are already applied.

> **Alternative without the terminal:** open Supabase → **SQL Editor**, then paste and run each file in `supabase/migrations/` in order (0001 → 0004).

To check which settings you've filled in (prints names only, never values):

```bash
npm run env:check
```

## Step 4 — Set up Google sign-in

### 4a. Create Google OAuth credentials

1. Go to <https://console.cloud.google.com> and sign in with your Google account.
2. Create a project (top bar → project picker → **New project**), named `SoonerTogether`.
3. Open **APIs & Services → OAuth consent screen** (also called **Google Auth Platform**):
   - App name: `SoonerTogether`, support email: your email.
   - Audience / user type: **External**.
   - Scopes: the defaults (`openid`, `email`, `profile`) are all you need.
4. Open **Clients** (or **Credentials → Create credentials → OAuth client ID**):
   - Application type: **Web application**, name `SoonerTogether web`.
   - **Authorized JavaScript origins:** `http://localhost:3000`, plus your Vercel URL later (step 7), for example `https://soonertogether.vercel.app`.
   - **Authorized redirect URIs:** `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`. Supabase shows this exact URL on its Google provider page (4b).
5. Click **Create**. Google shows a **Client ID** and a **Client secret**. Keep this tab open for 4b, and don't paste them anywhere else.
6. **Let other people sign in:** while the consent screen says "Testing", only the test users you list can sign in (up to 100). Add your testers' Gmail addresses under **Audience → Test users**, or click **Publish app**. With only the basic scopes, Google normally doesn't require a review.

### 4b. Connect Google to Supabase

1. In Supabase, go to **Authentication → Sign In / Providers → Google**.
2. Turn it **on**, paste the **Client ID** and **Client secret** from 4a, and click **Save**.
3. Go to **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:3000` for now. Change it to your Vercel URL after step 7.
   - **Redirect URLs:** add all of these:
     ```
     http://localhost:3000/**
     https://YOUR-VERCEL-PROJECT.vercel.app/**
     https://*-YOUR-VERCEL-TEAM.vercel.app/**
     ```
     The last line covers Vercel preview deployments. Replace the names with yours after step 7.

**Email sign-in links** also work out of the box, but Supabase's built-in email sender only allows a few emails per hour. For real testing, use Google. You can add your own email provider later under **Authentication → Emails → SMTP**.

## Step 5 — Run it locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000> and click **Sign in → Continue with Google**. After signing in, you'll go through the 4-step profile setup.

If you see "Cloud sign-in isn't configured", the two `NEXT_PUBLIC_SUPABASE_…` lines are missing or wrong. Stop the server (Ctrl+C), fix `.env.local`, and start it again.

## Step 6 — Turn on the AI assistant (DeepSeek)

1. Open `.env.local` and add your key yourself: `DEEPSEEK_API_KEY=…`.
2. Optional limits (defaults shown). These cap your spending:
   ```
   AI_DAILY_LIMIT_PER_USER=30   # questions per person per day
   AI_DAILY_LIMIT_TOTAL=500     # questions for everyone together per day
   ```
3. Restart `npm run dev`. The **AI Assistant** tab now answers for real.

Every reply is capped at about 900 tokens, requests time out after 60 seconds, and each person can send at most 6 questions per minute. If the key is missing, everything else keeps working and the AI page says so.

## Step 7 — Deploy to Vercel (public HTTPS link)

You already have a Vercel account (`yifei-lai06`). Deploy SoonerTogether as its **own project**, separate from CalcHelp.

1. In the project folder, log in (a browser window opens for you to approve):
   ```bash
   $env:NODE_OPTIONS="--require ./scripts/ascii-hostname.cjs"; npx vercel login
   ```
   The `NODE_OPTIONS` part is needed on this PC because its name has non-English characters.
2. Create the project and the first preview deployment:
   ```bash
   $env:NODE_OPTIONS="--require ./scripts/ascii-hostname.cjs"; npx vercel
   ```
   Answer: set up and deploy → yes; scope → your team; link to existing project → **no**; name → `soonertogether`; directory → `./`.
3. Add environment variables in the browser: **Vercel → soonertogether → Settings → Environment Variables**. Add these for **Production** and **Preview**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (mark as **Sensitive**)
   - `DEEPSEEK_API_KEY` (Sensitive, optional)
   - `AI_DAILY_LIMIT_PER_USER`, `AI_DAILY_LIMIT_TOTAL` (optional)
   - `ADMIN_EMAILS` (your email, so you can read feedback)

   **Do not** add `SUPABASE_DB_URL` or `AI_MOCK`.
4. Deploy to production:
   ```bash
   $env:NODE_OPTIONS="--require ./scripts/ascii-hostname.cjs"; npx vercel deploy --prod
   ```
   Vercel prints your public URL, for example `https://soonertogether.vercel.app`.
5. Go back to **step 4a** (add the URL as a JavaScript origin) and **step 4b** (set the Site URL and add the redirect URLs).

Environment variable changes only take effect after a new deployment.

## Step 8 — Test with two Google accounts (two devices)

Use your laptop and your phone (or a friend's phone), with **two different Google accounts**.

1. **Laptop (User A):** open the Vercel URL → Sign in with Google → finish the profile. Under **I can tutor**, add a course (e.g. CS 1323 → Arrays), and mark a few free times.
2. **Phone (User B):** open the same URL → sign in with a *different* Google account → finish the profile. Under **I need help with**, add the same course, and mark at least one free time that matches A.
3. **B:** Discover → pick the course and topic → Tutor → A appears with a match score → **Request connection**.
4. **A:** a notification appears (bell icon). Open Sessions → **Accept**.
5. **B:** open **Messages**. The private chat with A is there. Send "hi!"
6. **A:** the message appears without refreshing.
7. Either of you: open the session → **Pick a time** (only times you share are offered).
8. Both: after meeting, tap **We met — confirm completion**. When both have confirmed, each of you gets +30 XP. A also gets +20 for helping a first-time learner.
9. Both: leave private feedback. If you both choose "add as a study connection", you become connections.
10. Both: join the same Study Circle and try its group chat.
11. Each: ask the AI Assistant something. Each account has its own history and daily limit.

If anything fails, tap **Send feedback** in the app. It saves the page you were on, so the problem is easier to reproduce.

## Step 9 — Read feedback and reports

- **In the app:** open `/admin/feedback` while signed in with an email listed in `ADMIN_EMAILS`.
- **In Supabase:** **Table Editor → feedback** (and **reports** for safety reports). Only you can see these tables in the dashboard. Users can submit feedback but can't read anyone's, including their own.

## Step 10 — Watch usage and costs

| Service | Where to look | Free-plan notes |
| --- | --- | --- |
| Supabase | Project → **Usage** | Free: 500 MB database, 50k monthly active users, 2 GB egress. Free projects **pause after 1 week with no activity**; click Restore to wake them up. |
| Vercel | Project → **Usage** | Hobby is for non-commercial use. |
| DeepSeek | DeepSeek platform → **Usage / Billing** | Set a low top-up amount. The app also enforces per-user and total daily caps. |
| Google OAuth | Free | — |

To pause the AI instantly, remove `DEEPSEEK_API_KEY` in Vercel and redeploy.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| "redirect_uri_mismatch" from Google | The redirect URI in Google must be exactly `https://YOUR-REF.supabase.co/auth/v1/callback` |
| After Google sign-in you land on the wrong site or get an error | Add your site to Supabase **Redirect URLs** (step 4b) |
| "Cloud sign-in isn't configured" | `NEXT_PUBLIC_SUPABASE_URL` or the publishable key is missing; redeploy after fixing it in Vercel |
| Discover says "Couldn't load matches" | `SUPABASE_SECRET_KEY` is missing on the server |
| Messages don't arrive live | Make sure migration 0002 ran (it turns on Realtime for the right tables) |
| `npm run db:migrate` can't connect | Use the **Session pooler** string and check the password |
