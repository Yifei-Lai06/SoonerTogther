-- SoonerTogether — appearance preferences + profile photos (additive).

-- ── Appearance (synced across devices) ──────────────────────────────────────
alter table public.profiles
  add column if not exists accent text not null default 'blue' check (accent in ('blue', 'teal', 'coral')),
  add column if not exists reduce_motion boolean not null default false,
  add column if not exists show_doodles boolean not null default true;

grant update (accent, reduce_motion, show_doodles, avatar_url) on public.profiles to authenticated;

-- ── Profile photo URL guard ─────────────────────────────────────────────────
-- A user may only point their photo at their own upload in the `avatars` bucket,
-- at their Google profile photo, or clear it. No arbitrary external images.
create or replace function private.check_avatar_url() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.avatar_url is distinct from old.avatar_url
     and new.avatar_url is not null
     and new.avatar_url !~ ('^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatars/' || new.id::text || '/[A-Za-z0-9._-]+$')
     and new.avatar_url !~ '^https://lh[0-9]\.googleusercontent\.com/[A-Za-z0-9/._=-]+$'
  then
    raise exception 'invalid_avatar_url';
  end if;
  return new;
end $$;
revoke execute on function private.check_avatar_url() from public, anon, authenticated;

drop trigger if exists profiles_avatar_check on public.profiles;
create trigger profiles_avatar_check before update of avatar_url on public.profiles
  for each row execute function private.check_avatar_url();

-- ── Storage bucket for profile photos ───────────────────────────────────────
-- Public read (photos are shown on profiles); 1 MB max; images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Each user writes only inside a folder named after their user id: avatars/<uid>/<file>.
drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_select_own on storage.objects;
create policy avatars_select_own on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
