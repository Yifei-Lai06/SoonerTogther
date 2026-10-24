-- SoonerTogether — hardening from the Supabase security advisor.
-- Pin search_path on the remaining helper (advisor lint 0011).
create or replace function private.week_key(p_at timestamptz default now()) returns text
language sql immutable set search_path = '' as $$ select to_char(p_at at time zone 'utc', 'IYYY-"W"IW') $$;
