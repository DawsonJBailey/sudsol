-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- Server-side shadow copy of each logged-in user's cart, synced from the client
-- (localStorage remains the source of truth for rendering; this table exists so
-- the abandoned-cart cron job has something to query).

create table if not exists public.carts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  -- Set once the abandoned-cart cron has notified HubSpot for the current cart
  -- contents; reset to null whenever the cart changes so a new abandonment can
  -- be detected. Cleared (row deleted) entirely once the user checks out.
  hubspot_synced_at timestamptz
);

alter table public.carts enable row level security;

create policy "Users can view own cart" on public.carts
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can upsert own cart" on public.carts
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own cart" on public.carts
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- No delete policy for users: the row is cleared server-side (service role) once
-- an order is recorded, so a completed purchase can't be mistaken for an
-- abandoned one.
