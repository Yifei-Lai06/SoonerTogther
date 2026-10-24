-- SoonerTogether — core schema.
-- Run in order: 0001_schema.sql, 0002_security.sql, 0003_functions.sql, 0004_seed.sql
-- (or `npm run db:migrate`). Safe to read top to bottom: tables first, then security.

create schema if not exists private;

-- ── Reference data ──────────────────────────────────────────────────────────
create table public.courses (
  id     text primary key,
  title  text not null,
  dept   text not null,
  topics text[] not null default '{}'
);

-- ── People ──────────────────────────────────────────────────────────────────
-- Public profile: visible to signed-in users. Nothing private lives here.
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  display_name       text not null default '' check (char_length(display_name) <= 60),
  avatar_color       text not null default '#0284C7' check (avatar_color ~ '^#[0-9A-Fa-f]{6}$'),
  avatar_url         text check (avatar_url is null or avatar_url ~ '^https://'),
  major              text not null default '' check (char_length(major) <= 80),
  year               text not null default 'Freshman'
                     check (year in ('Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate')),
  bio                text not null default '' check (char_length(bio) <= 280),
  format             text not null default 'either' check (format in ('in-person', 'online', 'either')),
  modes              text[] not null default '{discussion}'
                     check (modes <@ array['teaching', 'discussion', 'talk']),
  interests          text[] not null default '{}' check (cardinality(interests) <= 20),
  courses            text[] not null default '{}' check (cardinality(courses) <= 12),
  onboarded          boolean not null default false,
  first_time_learner boolean not null default true,
  ou_verified        boolean not null default false,  -- set only by the server
  show_activity      boolean not null default true,
  xp                 integer not null default 0,       -- maintained by trigger from xp_events
  created_at         timestamptz not null default now()
);

-- Owner-only details.
create table public.private_profiles (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  availability text[] not null default '{}'
               check (availability <@ array[
                 'mon-morning','mon-afternoon','mon-evening','tue-morning','tue-afternoon','tue-evening',
                 'wed-morning','wed-afternoon','wed-evening','thu-morning','thu-afternoon','thu-evening',
                 'fri-morning','fri-afternoon','fri-evening','sat-morning','sat-afternoon','sat-evening',
                 'sun-morning','sun-afternoon','sun-evening']),
  ou_email     text
);

create table public.tutor_subjects (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  course_id  text not null references public.courses (id),
  topics     text[] not null default '{}',
  experience text not null default '' check (char_length(experience) <= 200),
  primary key (user_id, course_id)
);

-- Private: used only for matching on the server.
create table public.help_needs (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  course_id text not null references public.courses (id),
  topics    text[] not null default '{}',
  primary key (user_id, course_id)
);

-- ── Matching and sessions ───────────────────────────────────────────────────
create table public.match_requests (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind         text not null check (kind in ('tutor', 'partner')),
  course_id    text not null references public.courses (id),
  topics       text[] not null default '{}',
  mode         text not null check (mode in ('teaching', 'discussion', 'talk')),
  note         text not null default '' check (char_length(note) <= 280),
  status       text not null default 'requested' check (status in ('requested', 'accepted', 'declined', 'cancelled')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> recipient_id)
);
create index match_requests_requester_idx on public.match_requests (requester_id, created_at desc);
create index match_requests_recipient_idx on public.match_requests (recipient_id, created_at desc);
-- Only one pending request per pair per course.
create unique index match_requests_one_pending on public.match_requests
  (least(requester_id, recipient_id), greatest(requester_id, recipient_id), course_id)
  where status = 'requested';

create table public.study_sessions (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null unique references public.match_requests (id) on delete cascade,
  tutor_id     uuid references public.profiles (id) on delete set null,
  slot         text check (slot ~ '^(mon|tue|wed|thu|fri|sat|sun)-(morning|afternoon|evening)$'),
  status       text not null default 'unscheduled' check (status in ('unscheduled', 'scheduled', 'completed', 'cancelled')),
  goals        text not null default '' check (char_length(goals) <= 500),
  notes        text not null default '' check (char_length(notes) <= 5000),
  reflection   text not null default '' check (char_length(reflection) <= 2000),
  checklist    jsonb not null default '[]' check (jsonb_typeof(checklist) = 'array'),
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

create table public.session_confirmations (
  session_id   uuid not null references public.study_sessions (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  confirmed_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- Private per author. Never readable by the other participant.
create table public.session_feedback (
  session_id uuid not null references public.study_sessions (id) on delete cascade,
  from_id    uuid not null references public.profiles (id) on delete cascade,
  to_id      uuid not null references public.profiles (id) on delete cascade,
  helpful    boolean not null,
  again      boolean not null,
  connect    boolean not null,
  created_at timestamptz not null default now(),
  primary key (session_id, from_id)
);

-- ── XP and achievements ─────────────────────────────────────────────────────
create table public.xp_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  key        text not null unique,  -- the same reward can never be granted twice
  amount     integer not null check (amount > 0 and amount <= 100),
  reason     text not null,
  created_at timestamptz not null default now()
);
create index xp_events_user_idx on public.xp_events (user_id, created_at desc);

create table public.achievements (
  user_id   uuid not null references public.profiles (id) on delete cascade,
  badge_id  text not null check (badge_id in ('first-helper', 'peer-mentor', 'study-connector', 'community-builder', 'knowledge-sharer')),
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

-- ── Study Circles ───────────────────────────────────────────────────────────
create table public.circles (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(name) between 3 and 60),
  course_id        text not null references public.courses (id),
  focus            text[] not null default '{}',
  weekly_objective text not null check (char_length(weekly_objective) between 1 and 200),
  day              text not null check (day in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')),
  part             text not null check (part in ('morning', 'afternoon', 'evening')),
  time_label       text not null check (char_length(time_label) <= 12),
  format           text not null check (format in ('in-person', 'online', 'either')),
  location         text not null default '' check (char_length(location) <= 100),
  capacity         integer not null check (capacity between 2 and 8),
  creator_id       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now()
);

create table public.circle_members (
  circle_id uuid not null references public.circles (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
create index circle_members_user_idx on public.circle_members (user_id);

create table public.circle_challenges (
  id        uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  text      text not null check (char_length(text) <= 140),
  position  integer not null default 0
);

create table public.challenge_completions (
  challenge_id uuid not null references public.circle_challenges (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  primary key (challenge_id, user_id)
);

create table public.circle_attendance (
  circle_id uuid not null references public.circles (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  week_key  text not null,
  primary key (circle_id, user_id, week_key)
);

-- ── Connections and messaging ───────────────────────────────────────────────
create table public.connections (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid not null references public.profiles (id) on delete cascade,
  user_b     uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('direct', 'circle')),
  pair_key        text unique,                       -- direct: one conversation per pair
  circle_id       uuid unique references public.circles (id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  check ((kind = 'direct' and pair_key is not null) or (kind = 'circle' and circle_id is not null))
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_members_user_idx on public.conversation_members (user_id);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid references public.profiles (id) on delete set null,
  body            text not null check (char_length(body) between 1 and 2000),
  created_at      timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid references public.profiles (id) on delete set null,
  reported_id     uuid references public.profiles (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  message_id      uuid references public.messages (id) on delete set null,
  reason          text not null check (char_length(reason) between 1 and 1000),
  created_at      timestamptz not null default now()
);

-- ── AI assistant (separate from human conversations) ────────────────────────
create table public.ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  title      text not null default 'New chat' check (char_length(title) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_conversations_user_idx on public.ai_conversations (user_id, updated_at desc);

create table public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null check (char_length(content) <= 12000),
  created_at      timestamptz not null default now()
);
create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

create table private.ai_usage (
  user_id  uuid not null,
  day      date not null,
  requests integer not null default 0,
  primary key (user_id, day)
);

-- ── Feedback, notifications, activity ───────────────────────────────────────
create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete set null,
  rating     integer check (rating between 1 and 5),
  category   text not null check (category in ('general', 'feature', 'bug', 'suggestion')),
  message    text not null check (char_length(message) between 1 and 3000),
  page       text check (char_length(page) <= 200),
  user_agent text check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text not null default '',
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- Public, non-sensitive milestones only (never struggles or private sessions).
create table public.activity (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid not null references public.profiles (id) on delete cascade,
  type       text not null check (type in ('joined_circle', 'badge', 'milestone', 'started_tutoring', 'created_circle')),
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index activity_created_idx on public.activity (created_at desc);

-- ── Campus resources: "Find someone to go with" ─────────────────────────────
create table public.go_with_interests (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  resource_id text not null check (resource_id in ('math-center', 'writing-center', 'tutor-sooner', 'bizzell')),
  course_id   text not null references public.courses (id),
  created_at  timestamptz not null default now(),
  primary key (user_id, resource_id, course_id)
);

create table public.go_together (
  id          uuid primary key default gen_random_uuid(),
  resource_id text not null,
  course_id   text not null references public.courses (id),
  from_id     uuid not null references public.profiles (id) on delete cascade,
  to_id       uuid not null references public.profiles (id) on delete cascade,
  slot        text not null check (slot ~ '^(mon|tue|wed|thu|fri|sat|sun)-(morning|afternoon|evening)$'),
  status      text not null default 'invited' check (status in ('invited', 'confirmed', 'declined')),
  created_at  timestamptz not null default now(),
  check (from_id <> to_id)
);

-- ── Optional OU email verification codes (server/service role only) ─────────
create table private.ou_codes (
  user_id    uuid primary key,
  email      text not null,
  code_hash  text not null,
  expires_at timestamptz not null,
  attempts   integer not null default 0
);
