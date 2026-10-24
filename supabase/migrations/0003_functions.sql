-- SoonerTogether — server-side actions.
-- Every public function here is SECURITY DEFINER, derives the caller from auth.uid(),
-- validates everything, and runs as a single transaction (a Postgres function call
-- is atomic). Clients never send user ids for themselves, XP amounts, or scores.

-- ══ Internal helpers (schema private: not exposed through the API) ═════════

create or replace function private.require_user() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  return v;
end $$;

create or replace function private.week_key(p_at timestamptz default now()) returns text
language sql immutable as $$ select to_char(p_at at time zone 'utc', 'IYYY-"W"IW') $$;

create or replace function private.first_name(p_user uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(split_part(display_name, ' ', 1), ''), 'A classmate') from public.profiles where id = p_user;
$$;

create or replace function private.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

create or replace function private.notify(p_user uuid, p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, title, body, link) values (p_user, p_type, p_title, p_body, p_link);
$$;

-- Grants XP once per key. Returns true if newly awarded.
create or replace function private.award_xp(p_user uuid, p_key text, p_amount integer, p_reason text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_rows integer;
begin
  insert into public.xp_events (user_id, key, amount, reason) values (p_user, p_key, p_amount, p_reason)
  on conflict (key) do nothing;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end $$;

-- Keeps profiles.xp in sync with the ledger.
create or replace function private.on_xp_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set xp = xp + new.amount where id = new.user_id;
  return new;
end $$;
create trigger xp_events_total after insert on public.xp_events
  for each row execute function private.on_xp_event();

-- Same badge rules as src/lib/xp.ts (computeBadges).
create or replace function private.refresh_achievements(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_tutored integer; v_topics integer; v_connections integer; v_circles integer; v_attended boolean;
  v_badge text; v_new integer;
begin
  select count(*) into v_tutored from public.study_sessions where tutor_id = p_user and status = 'completed';
  select count(distinct r.course_id || ':' || t) into v_topics
    from public.study_sessions s join public.match_requests r on r.id = s.request_id, unnest(r.topics) t
    where s.tutor_id = p_user and s.status = 'completed';
  select count(*) into v_connections from public.connections where p_user in (user_a, user_b);
  select count(*) into v_circles from public.circle_members where user_id = p_user;
  select exists (select 1 from public.circle_attendance where user_id = p_user) into v_attended;

  for v_badge in
    select b from (values
      ('first-helper', v_tutored >= 1),
      ('peer-mentor', v_tutored >= 5),
      ('study-connector', v_connections >= 2),
      ('community-builder', least(v_circles, 2) + (case when v_attended then 1 else 0 end) >= 3),
      ('knowledge-sharer', v_topics >= 3)
    ) as x(b, earned) where earned
  loop
    insert into public.achievements (user_id, badge_id) values (p_user, v_badge) on conflict do nothing;
    get diagnostics v_new = row_count;
    if v_new > 0 then
      insert into public.activity (actor_id, type, payload) values (p_user, 'badge', jsonb_build_object('badge', v_badge));
      perform private.notify(p_user, 'badge', 'New badge earned', v_badge, '/profile');
    end if;
  end loop;
end $$;

create or replace function private.ensure_direct_conversation(a uuid, b uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_key text := least(a, b)::text || ':' || greatest(a, b)::text; v_id uuid;
begin
  insert into public.conversations (kind, pair_key) values ('direct', v_key)
  on conflict (pair_key) do nothing;
  select id into v_id from public.conversations where pair_key = v_key;
  insert into public.conversation_members (conversation_id, user_id) values (v_id, a), (v_id, b)
  on conflict do nothing;
  return v_id;
end $$;

-- Locks and returns the request/session pair for a participant.
create or replace function private.load_session(p_request uuid, p_user uuid,
  out r public.match_requests, out s public.study_sessions)
language plpgsql security definer set search_path = public as $$
begin
  select * into r from public.match_requests where id = p_request for update;
  if not found or p_user not in (r.requester_id, r.recipient_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select * into s from public.study_sessions where request_id = p_request for update;
end $$;

-- ══ New users ══════════════════════════════════════════════════════════════

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_name text := left(coalesce(nullif(v_meta->>'full_name', ''), nullif(v_meta->>'name', ''), split_part(coalesce(new.email, ''), '@', 1), ''), 60);
  v_avatar text := coalesce(v_meta->>'avatar_url', v_meta->>'picture');
begin
  insert into public.profiles (id, display_name, avatar_url, ou_verified)
  values (
    new.id, v_name,
    case when v_avatar ~ '^https://' then v_avatar end,
    -- Verified only when the identity provider confirmed an @ou.edu address.
    coalesce(new.email ~* '@([a-z0-9-]+\.)*ou\.edu$' and new.email_confirmed_at is not null, false)
  );
  insert into public.private_profiles (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ══ Matching and sessions ══════════════════════════════════════════════════

create or replace function public.request_session(
  p_recipient uuid, p_kind text, p_course text, p_topics text[], p_mode text, p_note text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_me uuid := private.require_user(); v_id uuid; v_topics text[];
begin
  if p_recipient = v_me then raise exception 'cannot_match_self'; end if;
  if p_kind not in ('tutor', 'partner') or p_mode not in ('teaching', 'discussion', 'talk') then
    raise exception 'invalid_input';
  end if;
  if not exists (select 1 from public.profiles where id = p_recipient and onboarded) then raise exception 'unknown_user'; end if;
  if private.is_blocked(v_me, p_recipient) then raise exception 'unavailable'; end if;
  if p_kind = 'tutor' and not exists (
    select 1 from public.tutor_subjects where user_id = p_recipient and course_id = p_course
  ) then raise exception 'not_a_tutor_for_course'; end if;

  select coalesce(array_agg(t), '{}') into v_topics
    from unnest(coalesce(p_topics, '{}')) t
    where t = any (coalesce((select c.topics from public.courses c where c.id = p_course), '{}'::text[]));
  if not exists (select 1 from public.courses where id = p_course) then raise exception 'unknown_course'; end if;

  if exists (
    select 1 from public.match_requests r
    left join public.study_sessions s on s.request_id = r.id
    where r.course_id = p_course
      and least(r.requester_id, r.recipient_id) = least(v_me, p_recipient)
      and greatest(r.requester_id, r.recipient_id) = greatest(v_me, p_recipient)
      and (r.status = 'requested' or (r.status = 'accepted' and s.status in ('unscheduled', 'scheduled')))
  ) then raise exception 'already_open'; end if;

  if (select count(*) from public.match_requests where requester_id = v_me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'rate_limited';
  end if;

  insert into public.match_requests (requester_id, recipient_id, kind, course_id, topics, mode, note)
  values (v_me, p_recipient, p_kind, p_course, v_topics[1:10], p_mode, left(coalesce(p_note, ''), 280))
  returning id into v_id;

  perform private.notify(p_recipient, 'request',
    private.first_name(v_me) || ' asked to study ' || p_course || ' with you', left(coalesce(p_note, ''), 140),
    '/sessions/' || v_id);
  return v_id;
end $$;

create or replace function public.respond_request(p_request uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := private.require_user(); r public.match_requests; v_what text;
begin
  select * into r from public.match_requests where id = p_request for update;
  if not found or r.recipient_id <> v_me then raise exception 'not_found'; end if;
  if r.status <> 'requested' then raise exception 'already_answered'; end if;

  update public.match_requests set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where id = p_request;

  if p_accept then
    v_what := coalesce(nullif(array_to_string(r.topics, ', '), ''), r.course_id);
    insert into public.study_sessions (request_id, tutor_id, goals, checklist)
    values (
      r.id,
      case when r.kind = 'tutor' then r.recipient_id end,
      case r.mode
        when 'talk' then 'Get to know each other and swap what''s working this semester.'
        when 'teaching' then 'Understand ' || v_what || ' well enough to try a new problem alone.'
        else 'Reason through ' || v_what || ' together until both of us can explain it.' end,
      case when r.mode = 'talk' then '[]'::jsonb else coalesce(
        (select jsonb_agg(jsonb_build_object('text', 'Work through ' || t, 'done', false)) from unnest(r.topics) t),
        '[]'::jsonb) end
    );
    perform private.ensure_direct_conversation(r.requester_id, r.recipient_id);
    perform private.notify(r.requester_id, 'accepted', private.first_name(v_me) || ' accepted your request',
      'Pick a time and say hi in Messages.', '/sessions/' || r.id);
  else
    perform private.notify(r.requester_id, 'declined', 'A request wasn''t accepted this time',
      'No reason is shared. Try another match!', '/discover');
  end if;
end $$;

create or replace function public.cancel_request(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := private.require_user(); x record;
begin
  select * into x from private.load_session(p_request, v_me);
  if (x.r).status = 'requested' then
    update public.match_requests set status = 'cancelled', responded_at = now() where id = p_request;
  elsif (x.r).status = 'accepted' and (x.s).status in ('unscheduled', 'scheduled') then
    update public.study_sessions set status = 'cancelled' where id = (x.s).id;
  else
    raise exception 'not_cancellable';
  end if;
end $$;

create or replace function public.schedule_session(p_request uuid, p_slot text)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := private.require_user(); x record;
begin
  select * into x from private.load_session(p_request, v_me);
  if (x.s).id is null or (x.s).status not in ('unscheduled', 'scheduled') then raise exception 'not_schedulable'; end if;
  if not exists (
    select 1 from public.private_profiles a, public.private_profiles b
    where a.user_id = (x.r).requester_id and b.user_id = (x.r).recipient_id
      and p_slot = any (a.availability) and p_slot = any (b.availability)
  ) then raise exception 'slot_not_mutual'; end if;
  update public.study_sessions set slot = p_slot, status = 'scheduled' where id = (x.s).id;
  perform private.notify(case when v_me = (x.r).requester_id then (x.r).recipient_id else (x.r).requester_id end,
    'scheduled', private.first_name(v_me) || ' picked a time', p_slot, '/sessions/' || p_request);
end $$;

create or replace function public.set_session_mode(p_request uuid, p_mode text)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := private.require_user(); x record;
begin
  if p_mode not in ('teaching', 'discussion', 'talk') then raise exception 'invalid_input'; end if;
  select * into x from private.load_session(p_request, v_me);
  if (x.r).status = 'requested' then
    update public.match_requests set mode = p_mode where id = p_request;
  elsif (x.s).status in ('unscheduled', 'scheduled') then
    update public.match_requests set mode = p_mode where id = p_request;
  else
    raise exception 'not_editable';
  end if;
end $$;

create or replace function public.update_workspace(
  p_request uuid, p_goals text, p_notes text, p_reflection text, p_checklist jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := private.require_user(); x record;
begin
  select * into x from private.load_session(p_request, v_me);
  if (x.s).status not in ('scheduled', 'completed') then raise exception 'not_editable'; end if;
  if p_checklist is not null and (jsonb_typeof(p_checklist) <> 'array' or jsonb_array_length(p_checklist) > 30) then
    raise exception 'invalid_input';
  end if;
  update public.study_sessions set
    goals = coalesce(left(p_goals, 500), goals),
    notes = coalesce(left(p_notes, 5000), notes),
    reflection = coalesce(left(p_reflection, 2000), reflection),
    checklist = coalesce(p_checklist, checklist)
  where id = (x.s).id;
end $$;

-- Both participants must confirm. XP is granted exactly once, with a daily cap.
create or replace function public.confirm_session(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := private.require_user(); x record; v_count integer;
  v_ids uuid[]; v_uid uuid; v_other uuid; v_learner uuid; v_verb text;
begin
  select * into x from private.load_session(p_request, v_me);
  if (x.s).id is null or (x.s).status <> 'scheduled' then raise exception 'not_confirmable'; end if;

  insert into public.session_confirmations (session_id, user_id) values ((x.s).id, v_me) on conflict do nothing;
  select count(*) into v_count from public.session_confirmations where session_id = (x.s).id;
  v_ids := array[(x.r).requester_id, (x.r).recipient_id];

  if v_count < 2 then
    perform private.notify(case when v_me = v_ids[1] then v_ids[2] else v_ids[1] end, 'confirm',
      private.first_name(v_me) || ' confirmed your session', 'Confirm too so you both get XP.', '/sessions/' || p_request);
    return;
  end if;

  update public.study_sessions set status = 'completed', completed_at = now() where id = (x.s).id;
  v_verb := case when (x.s).tutor_id is not null then 'tutoring session' else 'study session' end;

  foreach v_uid in array v_ids loop
    v_other := case when v_uid = v_ids[1] then v_ids[2] else v_ids[1] end;
    if (select count(*) from public.xp_events
        where user_id = v_uid and key like 'session:%' and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc') < 3
    then
      perform private.award_xp(v_uid, 'session:' || (x.s).id || ':' || v_uid, 30,
        'Completed a verified ' || v_verb || ' with ' || private.first_name(v_other));
    end if;
  end loop;

  if (x.s).tutor_id is not null then
    v_learner := case when (x.s).tutor_id = v_ids[1] then v_ids[2] else v_ids[1] end;
    if (select first_time_learner from public.profiles where id = v_learner) then
      perform private.award_xp((x.s).tutor_id, 'first-timer:' || (x.s).id, 20,
        'Helped ' || private.first_name(v_learner) || ', a first-time learner');
    end if;
  end if;
  update public.profiles set first_time_learner = false where id = any (v_ids);

  foreach v_uid in array v_ids loop
    perform private.refresh_achievements(v_uid);
    perform private.notify(v_uid, 'completed', 'Session complete', 'Leave private feedback when you have a sec.',
      '/sessions/' || p_request);
  end loop;
end $$;

create or replace function public.submit_feedback(p_request uuid, p_helpful boolean, p_again boolean, p_connect boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := private.require_user(); x record; v_other uuid; v_a uuid; v_b uuid; v_rows integer;
begin
  select * into x from private.load_session(p_request, v_me);
  if (x.s).status is distinct from 'completed' then raise exception 'not_completed'; end if;
  v_other := case when v_me = (x.r).requester_id then (x.r).recipient_id else (x.r).requester_id end;

  insert into public.session_feedback (session_id, from_id, to_id, helpful, again, connect)
  values ((x.s).id, v_me, v_other, p_helpful, p_again, p_connect)
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'already_submitted'; end if;

  if p_helpful then
    perform private.award_xp(v_other, 'helpful:' || (x.s).id || ':' || v_other, 10,
      private.first_name(v_me) || ' found your session helpful');
  end if;

  -- A connection exists only when BOTH people privately said yes.
  if p_connect and exists (
    select 1 from public.session_feedback where session_id = (x.s).id and from_id = v_other and connect
  ) then
    v_a := least(v_me, v_other); v_b := greatest(v_me, v_other);
    insert into public.connections (user_a, user_b) values (v_a, v_b) on conflict do nothing;
    get diagnostics v_rows = row_count;
    if v_rows > 0 then
      perform private.notify(v_me, 'connection', 'New study connection', 'You and ' || private.first_name(v_other) || ' both said yes.', '/connections');
      perform private.notify(v_other, 'connection', 'New study connection', 'You and ' || private.first_name(v_me) || ' both said yes.', '/connections');
      perform private.refresh_achievements(v_me);
      perform private.refresh_achievements(v_other);
    end if;
  end if;
end $$;

-- ══ Study Circles ══════════════════════════════════════════════════════════

create or replace function public.create_circle(
  p_name text, p_course text, p_focus text[], p_objective text, p_day text, p_part text,
  p_time text, p_format text, p_location text, p_capacity integer
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_me uuid := private.require_user(); v_id uuid; v_conv uuid;
begin
  if (select count(*) from public.circles where creator_id = v_me and created_at > now() - interval '1 day') >= 3 then
    raise exception 'rate_limited';
  end if;
  insert into public.circles (name, course_id, focus, weekly_objective, day, part, time_label, format, location, capacity, creator_id)
  values (trim(p_name), p_course,
    (select coalesce(array_agg(t), '{}') from unnest(coalesce(p_focus, '{}')) t
      where t = any (coalesce((select c.topics from public.courses c where c.id = p_course), '{}'::text[]))),
    trim(p_objective), p_day, p_part, left(p_time, 12), p_format, left(coalesce(p_location, ''), 100),
    greatest(2, least(8, p_capacity)), v_me)
  returning id into v_id;
  insert into public.circle_members (circle_id, user_id) values (v_id, v_me);
  insert into public.circle_challenges (circle_id, text, position) values
    (v_id, 'Everyone brings one question they''re stuck on', 0),
    (v_id, 'Each member leads one explanation this week', 1);
  insert into public.conversations (kind, circle_id) values ('circle', v_id) returning id into v_conv;
  insert into public.conversation_members (conversation_id, user_id) values (v_conv, v_me);
  insert into public.activity (actor_id, type, payload) values (v_me, 'created_circle', jsonb_build_object('circle', v_id, 'name', trim(p_name)));
  perform private.refresh_achievements(v_me);
  return v_id;
end $$;

create or replace function public.join_circle(p_circle uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := private.require_user(); c public.circles; v_conv uuid;
begin
  select * into c from public.circles where id = p_circle for update;
  if not found then raise exception 'not_found'; end if;
  if exists (select 1 from public.circle_members where circle_id = p_circle and user_id = v_me) then return; end if;
  if (select count(*) from public.circle_members where circle_id = p_circle) >= c.capacity then raise exception 'circle_full'; end if;
  insert into public.circle_members (circle_id, user_id) values (p_circle, v_me);
  select id into v_conv from public.conversations where circle_id = p_circle;
  if v_conv is null then
    insert into public.conversations (kind, circle_id) values ('circle', p_circle) returning id into v_conv;
  end if;
  insert into public.conversation_members (conversation_id, user_id) values (v_conv, v_me) on conflict do nothing;
  insert into public.activity (actor_id, type, payload) values (v_me, 'joined_circle', jsonb_build_object('circle', p_circle, 'name', c.name));
  perform private.refresh_achievements(v_me);
end $$;

create or replace function public.leave_circle(p_circle uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := private.require_user();
begin
  delete from public.circle_members where circle_id = p_circle and user_id = v_me;
  delete from public.conversation_members m using public.conversations c
    where m.conversation_id = c.id and c.circle_id = p_circle and m.user_id = v_me;
end $$;

create or replace function public.attend_circle(p_circle uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := private.require_user(); v_week text := private.week_key(); v_rows integer; v_name text;
begin
  if not exists (select 1 from public.circle_members where circle_id = p_circle and user_id = v_me) then
    raise exception 'not_a_member';
  end if;
  insert into public.circle_attendance (circle_id, user_id, week_key) values (p_circle, v_me, v_week) on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    select name into v_name from public.circles where id = p_circle;
    perform private.award_xp(v_me, 'circle:' || p_circle || ':' || v_week || ':' || v_me, 15, 'Attended ' || v_name);
    perform private.refresh_achievements(v_me);
  end if;
end $$;

-- A challenge becomes a group milestone once min(3, members) current members finish it.
create or replace function public.toggle_challenge(p_challenge uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := private.require_user(); ch public.circle_challenges; v_members integer; v_before integer; v_after integer;
  v_uid uuid; v_name text;
begin
  select * into ch from public.circle_challenges where id = p_challenge;
  if not found then raise exception 'not_found'; end if;
  perform 1 from public.circles where id = ch.circle_id for update;  -- serialize milestone checks
  if not exists (select 1 from public.circle_members where circle_id = ch.circle_id and user_id = v_me) then
    raise exception 'not_a_member';
  end if;
  select count(*) into v_members from public.circle_members where circle_id = ch.circle_id;
  select count(*) into v_before from public.challenge_completions cc
    join public.circle_members m on m.user_id = cc.user_id and m.circle_id = ch.circle_id
    where cc.challenge_id = p_challenge;

  if exists (select 1 from public.challenge_completions where challenge_id = p_challenge and user_id = v_me) then
    delete from public.challenge_completions where challenge_id = p_challenge and user_id = v_me;
    return;
  end if;
  insert into public.challenge_completions (challenge_id, user_id) values (p_challenge, v_me);
  v_after := v_before + 1;

  if v_before < least(3, v_members) and v_after >= least(3, v_members) then
    select name into v_name from public.circles where id = ch.circle_id;
    for v_uid in
      select cc.user_id from public.challenge_completions cc
      join public.circle_members m on m.user_id = cc.user_id and m.circle_id = ch.circle_id
      where cc.challenge_id = p_challenge
    loop
      perform private.award_xp(v_uid, 'milestone:' || ch.circle_id || ':' || p_challenge || ':' || v_uid, 25,
        v_name || ' completed a group challenge');
    end loop;
    insert into public.activity (actor_id, type, payload)
    values (v_me, 'milestone', jsonb_build_object('circle', ch.circle_id, 'name', v_name, 'challenge', ch.text));
  end if;
end $$;

-- ══ Messaging ══════════════════════════════════════════════════════════════

create or replace function public.send_message(p_conversation uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_me uuid := private.require_user(); v_body text := btrim(coalesce(p_body, '')); v_id uuid; c public.conversations;
begin
  if char_length(v_body) = 0 or char_length(v_body) > 2000 then raise exception 'invalid_length'; end if;
  select * into c from public.conversations where id = p_conversation;
  if not found or not exists (
    select 1 from public.conversation_members where conversation_id = p_conversation and user_id = v_me
  ) then raise exception 'not_found'; end if;
  if c.kind = 'direct' and exists (
    select 1 from public.conversation_members m
    where m.conversation_id = p_conversation and m.user_id <> v_me and private.is_blocked(v_me, m.user_id)
  ) then raise exception 'unavailable'; end if;
  if (select count(*) from public.messages where sender_id = v_me and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'rate_limited';
  end if;
  insert into public.messages (conversation_id, sender_id, body) values (p_conversation, v_me, v_body) returning id into v_id;
  update public.conversations set last_message_at = now() where id = p_conversation;
  update public.conversation_members set last_read_at = now() where conversation_id = p_conversation and user_id = v_me;
  return v_id;
end $$;

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void language sql security definer set search_path = public as $$
  update public.conversation_members set last_read_at = now()
  where conversation_id = p_conversation and user_id = auth.uid();
$$;

-- Inbox: one row per conversation the caller belongs to. No emails, ever.
create or replace function public.my_conversations()
returns table (
  id uuid, kind text, circle_id uuid, title text,
  other_id uuid, other_name text, other_color text, other_avatar text,
  last_body text, last_sender uuid, last_message_at timestamptz, unread integer, other_read_at timestamptz
) language sql stable security definer set search_path = public as $$
  select c.id, c.kind, c.circle_id,
    case when c.kind = 'circle' then ci.name else p.display_name end,
    p.id, p.display_name, p.avatar_color, p.avatar_url,
    lm.body, lm.sender_id, c.last_message_at,
    (select count(*)::int from public.messages m
      where m.conversation_id = c.id and m.created_at > me.last_read_at and m.sender_id is distinct from auth.uid()),
    om.last_read_at
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  left join public.circles ci on ci.id = c.circle_id
  left join public.conversation_members om on c.kind = 'direct' and om.conversation_id = c.id and om.user_id <> me.user_id
  left join public.profiles p on p.id = om.user_id
  left join lateral (
    select body, sender_id from public.messages m where m.conversation_id = c.id order by created_at desc limit 1
  ) lm on true
  where me.user_id = auth.uid()
  order by c.last_message_at desc;
$$;

create or replace function public.block_user(p_user uuid, p_block boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := private.require_user();
begin
  if p_user = v_me then raise exception 'invalid_input'; end if;
  if p_block then
    insert into public.blocks (blocker_id, blocked_id) values (v_me, p_user) on conflict do nothing;
  else
    delete from public.blocks where blocker_id = v_me and blocked_id = p_user;
  end if;
end $$;

create or replace function public.report_user(p_user uuid, p_conversation uuid, p_message uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := private.require_user();
begin
  if (select count(*) from public.reports where reporter_id = v_me and created_at > now() - interval '1 day') >= 10 then
    raise exception 'rate_limited';
  end if;
  if p_conversation is not null and not private.is_conversation_member(p_conversation) then raise exception 'not_found'; end if;
  insert into public.reports (reporter_id, reported_id, conversation_id, message_id, reason)
  values (v_me, p_user, p_conversation, p_message, left(btrim(p_reason), 1000));
end $$;

-- ══ Campus resources ═══════════════════════════════════════════════════════

create or replace function public.go_with_invite(p_to uuid, p_resource text, p_course text, p_slot text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_me uuid := private.require_user(); v_id uuid;
begin
  if p_to = v_me or private.is_blocked(v_me, p_to) then raise exception 'unavailable'; end if;
  if not exists (select 1 from public.go_with_interests where user_id = p_to and resource_id = p_resource and course_id = p_course) then
    raise exception 'not_interested';
  end if;
  if not exists (
    select 1 from public.private_profiles a, public.private_profiles b
    where a.user_id = v_me and b.user_id = p_to and p_slot = any (a.availability) and p_slot = any (b.availability)
  ) then raise exception 'slot_not_mutual'; end if;
  select id into v_id from public.go_together
    where from_id = v_me and to_id = p_to and resource_id = p_resource and status <> 'declined';
  if v_id is not null then return v_id; end if;
  insert into public.go_together (resource_id, course_id, from_id, to_id, slot)
  values (p_resource, p_course, v_me, p_to, p_slot) returning id into v_id;
  perform private.notify(p_to, 'go_with', private.first_name(v_me) || ' wants to visit a campus resource with you',
    p_course || ' · ' || p_slot, '/resources');
  return v_id;
end $$;

create or replace function public.go_with_respond(p_invite uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := private.require_user(); g public.go_together;
begin
  select * into g from public.go_together where id = p_invite for update;
  if not found or g.to_id <> v_me or g.status <> 'invited' then raise exception 'not_found'; end if;
  update public.go_together set status = case when p_accept then 'confirmed' else 'declined' end where id = p_invite;
  if p_accept then
    perform private.ensure_direct_conversation(g.from_id, g.to_id);
    perform private.notify(g.from_id, 'go_with', private.first_name(v_me) || ' is in!', 'Say hi in Messages to plan the visit.', '/messages');
  end if;
end $$;

-- ══ Activity: starting to tutor a subject is a public, positive milestone ══

create or replace function private.on_tutor_subject() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity (actor_id, type, payload)
  values (new.user_id, 'started_tutoring', jsonb_build_object('course', new.course_id));
  return new;
end $$;
create trigger tutor_subject_activity after insert on public.tutor_subjects
  for each row execute function private.on_tutor_subject();

-- ══ AI quota (called only by the server with the service role) ═════════════

create or replace function public.consume_ai_quota(p_user uuid, p_user_limit integer, p_global_limit integer)
returns text language plpgsql security definer set search_path = public as $$
declare v_day date := (now() at time zone 'utc')::date; v_mine integer; v_total integer;
begin
  select coalesce(sum(requests), 0) into v_total from private.ai_usage where day = v_day;
  if v_total >= p_global_limit then return 'global_limit'; end if;
  insert into private.ai_usage (user_id, day, requests) values (p_user, v_day, 1)
  on conflict (user_id, day) do update set requests = private.ai_usage.requests + 1
  returning requests into v_mine;
  if v_mine > p_user_limit then
    update private.ai_usage set requests = requests - 1 where user_id = p_user and day = v_day;
    return 'user_limit';
  end if;
  return 'ok';
end $$;

create or replace function public.ai_usage_today()
returns integer language sql stable security definer set search_path = public as $$
  select coalesce((select requests from private.ai_usage
    where user_id = auth.uid() and day = (now() at time zone 'utc')::date), 0);
$$;

-- ══ Optional OU email verification (service role only) ═════════════════════

create or replace function public.ou_code_store(p_user uuid, p_email text, p_hash text)
returns void language sql security definer set search_path = public as $$
  insert into private.ou_codes (user_id, email, code_hash, expires_at, attempts)
  values (p_user, lower(p_email), p_hash, now() + interval '15 minutes', 0)
  on conflict (user_id) do update
    set email = excluded.email, code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0;
$$;

create or replace function public.ou_code_check(p_user uuid, p_hash text)
returns text language plpgsql security definer set search_path = public as $$
declare c private.ou_codes;
begin
  select * into c from private.ou_codes where user_id = p_user for update;
  if not found then return 'no_code'; end if;
  if c.expires_at < now() then delete from private.ou_codes where user_id = p_user; return 'expired'; end if;
  if c.attempts >= 5 then return 'too_many_attempts'; end if;
  if c.code_hash <> p_hash then
    update private.ou_codes set attempts = attempts + 1 where user_id = p_user;
    return 'wrong_code';
  end if;
  delete from private.ou_codes where user_id = p_user;
  update public.profiles set ou_verified = true where id = p_user;
  update public.private_profiles set ou_email = c.email where user_id = p_user;
  return 'ok';
end $$;

-- ══ Function privileges ════════════════════════════════════════════════════
revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_conversation_member(uuid), private.is_request_participant(uuid),
  private.is_session_participant(uuid) to authenticated;

grant execute on function
  public.request_session(uuid, text, text, text[], text, text),
  public.respond_request(uuid, boolean),
  public.cancel_request(uuid),
  public.schedule_session(uuid, text),
  public.set_session_mode(uuid, text),
  public.update_workspace(uuid, text, text, text, jsonb),
  public.confirm_session(uuid),
  public.submit_feedback(uuid, boolean, boolean, boolean),
  public.create_circle(text, text, text[], text, text, text, text, text, text, integer),
  public.join_circle(uuid),
  public.leave_circle(uuid),
  public.attend_circle(uuid),
  public.toggle_challenge(uuid),
  public.send_message(uuid, text),
  public.mark_conversation_read(uuid),
  public.my_conversations(),
  public.block_user(uuid, boolean),
  public.report_user(uuid, uuid, uuid, text),
  public.go_with_invite(uuid, text, text, text),
  public.go_with_respond(uuid, boolean),
  public.ai_usage_today()
to authenticated;

-- Only the server (service role) may spend AI quota on a user's behalf.
revoke execute on function public.consume_ai_quota(uuid, integer, integer) from authenticated;
grant execute on function public.consume_ai_quota(uuid, integer, integer) to service_role;
revoke execute on function public.ou_code_store(uuid, text, text), public.ou_code_check(uuid, text) from authenticated;
grant execute on function public.ou_code_store(uuid, text, text), public.ou_code_check(uuid, text) to service_role;
