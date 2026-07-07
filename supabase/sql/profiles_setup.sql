-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- Sets up a profiles table, auto-provisioning trigger, and an avatars storage bucket.

-- 1. Profile data, separate from auth.users. Only the owning user can read/write their row.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  updated_at timestamptz not null default now()
);

-- Added after the initial rollout; safe to re-run against an existing table.
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name text;
alter table public.profiles add column if not exists phone text;

alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy "Users can update own profile" on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- No insert policy: rows are created only via the trigger below (security definer),
-- so users can't insert arbitrary profile rows for other ids.

-- 2. Auto-create a profile row when a new auth user is created, pre-filled from
-- Google's OAuth claims when present (raw_user_meta_data.full_name / avatar_url),
-- falling back to the raw OIDC claims (name / picture) for other providers, or to
-- the first/last name and phone collected by the email/password sign-up form.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := new.raw_user_meta_data;
begin
  insert into public.profiles (id, full_name, avatar_url, first_name, last_name, phone)
  values (
    new.id,
    coalesce(
      meta ->> 'full_name',
      nullif(trim(concat_ws(' ', meta ->> 'first_name', meta ->> 'last_name')), ''),
      meta ->> 'name'
    ),
    coalesce(meta ->> 'avatar_url', meta ->> 'picture'),
    meta ->> 'first_name',
    meta ->> 'last_name',
    meta ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger execution isn't gated by EXECUTE grants, so revoking public execute closes
-- off this security-definer function as a callable RPC without affecting the trigger.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Backfill profiles for any users created before this migration existed.
insert into public.profiles (id, full_name, avatar_url)
select
  id,
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'),
  coalesce(raw_user_meta_data ->> 'avatar_url', raw_user_meta_data ->> 'picture')
from auth.users
on conflict (id) do nothing;

-- 4. Storage bucket for avatar images. Public read (so <img> tags load them directly),
-- writes restricted to a user's own folder (avatars/<user_id>/...).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Avatar images are publicly accessible" on storage.objects
for select
to public
using (bucket_id = 'avatars');

create policy "Users can upload their own avatar" on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can update their own avatar" on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
