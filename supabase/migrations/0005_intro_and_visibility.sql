-- SoonerTogether — guided intro + profile visibility (additive; safe on existing data).

alter table public.profiles
  add column if not exists intro_seen_at timestamptz,
  add column if not exists show_circles boolean not null default true,
  add column if not exists show_xp boolean not null default true,
  add column if not exists show_interests boolean not null default true;

-- Users control these on their own profile (RLS already limits updates to their own row).
grant update (intro_seen_at, show_circles, show_xp, show_interests) on public.profiles to authenticated;
