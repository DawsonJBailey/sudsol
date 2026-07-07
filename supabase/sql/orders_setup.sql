-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- Sets up an orders table recording completed Stripe payments.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  stripe_payment_intent_id text not null unique,
  status text not null default 'paid',
  amount_total integer not null,
  currency text not null default 'usd',
  customer_name text,
  customer_email text,
  shipping_address jsonb,
  items jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders (user_id);

alter table public.orders enable row level security;

create policy "Users can view own orders" on public.orders
for select
to authenticated
using ((select auth.uid()) = user_id);

-- No insert/update/delete policies for anon/authenticated: rows are written only
-- by the server using the service_role key, after independently verifying the
-- payment with Stripe. This keeps order data from being forged via the public keys.
