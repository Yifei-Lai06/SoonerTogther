-- SoonerTogether — Row Level Security and privileges.
-- Principle: the browser may READ what its user is allowed to see. Every write that
-- matters (requests, sessions, XP, circles, messages) goes through the SECURITY
-- DEFINER functions in 0003, which derive the caller from auth.uid().

-- Helpers used inside policies (security definer avoids recursive policy checks).
create or replace function private.is_conversation_member(p_conversation uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation and user_id = auth.uid()
  );
$$;

create or replace function private.is_request_participant(p_request uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.match_requests
    where id = p_request and auth.uid() in (requester_id, recipient_id)
  );
$$;

create or replace function private.is_session_participant(p_session uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.study_sessions s
    join public.match_requests r on r.id = s.request_id
    where s.id = p_session and auth.uid() in (r.requester_id, r.recipient_id)
  );
$$;

-- ── Enable RLS everywhere ───────────────────────────────────────────────────
alter table public.courses               enable row level security;
alter table public.profiles              enable row level security;
alter table public.private_profiles      enable row level security;
alter table public.tutor_subjects        enable row level security;
alter table public.help_needs            enable row level security;
alter table public.match_requests        enable row level security;
alter table public.study_sessions        enable row level security;
alter table public.session_confirmations enable row level security;
alter table public.session_feedback      enable row level security;
alter table public.xp_events             enable row level security;
alter table public.achievements          enable row level security;
alter table public.circles               enable row level security;
alter table public.circle_members        enable row level security;
alter table public.circle_challenges     enable row level security;
alter table public.challenge_completions enable row level security;
alter table public.circle_attendance     enable row level security;
alter table public.connections           enable row level security;
alter table public.conversations         enable row level security;
alter table public.conversation_members  enable row level security;
alter table public.messages              enable row level security;
alter table public.blocks                enable row level security;
alter table public.reports               enable row level security;
alter table public.ai_conversations      enable row level security;
alter table public.ai_messages           enable row level security;
alter table public.feedback              enable row level security;
alter table public.notifications         enable row level security;
alter table public.activity              enable row level security;
alter table public.go_with_interests     enable row level security;
alter table public.go_together           enable row level security;

-- ── Policies ────────────────────────────────────────────────────────────────
create policy courses_read on public.courses for select to anon, authenticated using (true);

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy private_profiles_own on public.private_profiles for select to authenticated using (user_id = auth.uid());
create policy private_profiles_update_own on public.private_profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy tutor_subjects_read on public.tutor_subjects for select to authenticated using (true);
create policy tutor_subjects_insert_own on public.tutor_subjects for insert to authenticated with check (user_id = auth.uid());
create policy tutor_subjects_update_own on public.tutor_subjects for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy tutor_subjects_delete_own on public.tutor_subjects for delete to authenticated using (user_id = auth.uid());

create policy help_needs_own_read on public.help_needs for select to authenticated using (user_id = auth.uid());
create policy help_needs_insert_own on public.help_needs for insert to authenticated with check (user_id = auth.uid());
create policy help_needs_update_own on public.help_needs for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy help_needs_delete_own on public.help_needs for delete to authenticated using (user_id = auth.uid());

create policy match_requests_participants on public.match_requests for select to authenticated
  using (auth.uid() in (requester_id, recipient_id));
create policy study_sessions_participants on public.study_sessions for select to authenticated
  using (private.is_request_participant(request_id));
create policy confirmations_participants on public.session_confirmations for select to authenticated
  using (private.is_session_participant(session_id));
create policy feedback_own_only on public.session_feedback for select to authenticated using (from_id = auth.uid());

create policy xp_own on public.xp_events for select to authenticated using (user_id = auth.uid());
create policy achievements_read on public.achievements for select to authenticated using (true);

create policy circles_read on public.circles for select to authenticated using (true);
create policy circle_members_read on public.circle_members for select to authenticated using (true);
create policy circle_challenges_read on public.circle_challenges for select to authenticated using (true);
create policy challenge_completions_read on public.challenge_completions for select to authenticated using (true);
create policy circle_attendance_read on public.circle_attendance for select to authenticated using (true);

create policy connections_own on public.connections for select to authenticated using (auth.uid() in (user_a, user_b));

create policy conversations_members on public.conversations for select to authenticated
  using (private.is_conversation_member(id));
create policy conversation_members_members on public.conversation_members for select to authenticated
  using (private.is_conversation_member(conversation_id));
create policy messages_members on public.messages for select to authenticated
  using (private.is_conversation_member(conversation_id));

create policy blocks_own on public.blocks for select to authenticated using (blocker_id = auth.uid());

create policy ai_conversations_own on public.ai_conversations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ai_messages_own on public.ai_messages for all to authenticated
  using (user_id = auth.uid()) with check (
    user_id = auth.uid()
    and exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid())
  );

create policy feedback_insert_own on public.feedback for insert to authenticated with check (user_id = auth.uid());

create policy notifications_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy activity_visible on public.activity for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = actor_id and (p.show_activity or p.id = auth.uid()))
);

create policy go_with_read on public.go_with_interests for select to authenticated using (true);
create policy go_with_insert_own on public.go_with_interests for insert to authenticated with check (user_id = auth.uid());
create policy go_with_delete_own on public.go_with_interests for delete to authenticated using (user_id = auth.uid());

create policy go_together_participants on public.go_together for select to authenticated
  using (auth.uid() in (from_id, to_id));

-- ── Table privileges (column-level where needed) ────────────────────────────
revoke all on all tables in schema public from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;
revoke all on schema private from public, anon, authenticated;

grant select on public.courses to anon, authenticated;

grant select on public.profiles to authenticated;
-- xp, ou_verified and first_time_learner are deliberately NOT updatable by users.
grant update (display_name, avatar_color, major, year, bio, format, modes, interests, courses, onboarded, show_activity)
  on public.profiles to authenticated;

grant select on public.private_profiles to authenticated;
grant update (availability) on public.private_profiles to authenticated;

grant select, insert, update, delete on public.tutor_subjects to authenticated;
grant select, insert, update, delete on public.help_needs to authenticated;

grant select on
  public.match_requests, public.study_sessions, public.session_confirmations, public.session_feedback,
  public.xp_events, public.achievements, public.circles, public.circle_members, public.circle_challenges,
  public.challenge_completions, public.circle_attendance, public.connections, public.conversations,
  public.conversation_members, public.messages, public.blocks, public.notifications, public.activity,
  public.go_with_interests, public.go_together
to authenticated;

grant insert, delete on public.go_with_interests to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert, update, delete on public.ai_conversations, public.ai_messages to authenticated;
grant insert on public.feedback to authenticated;

-- ── Realtime: deliver changes the user is allowed to SELECT ─────────────────
alter publication supabase_realtime add table
  public.messages, public.notifications, public.match_requests, public.study_sessions,
  public.session_confirmations, public.connections, public.conversation_members, public.go_together;
