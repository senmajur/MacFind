-- MACFIND (McMaster Lost & Found) - Minimal RLS policies for MVP
-- Run this in Supabase Dashboard -> SQL Editor.

-- USERS
alter table public.users enable row level security;

drop policy if exists "users_insert_own" on public.users;
drop policy if exists "users_select_own" on public.users;
drop policy if exists "users_update_own" on public.users;

create policy "users_insert_own"
on public.users
for insert
to authenticated
with check (id = auth.uid());

create policy "users_select_own"
on public.users
for select
to authenticated
using (id = auth.uid());

create policy "users_update_own"
on public.users
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- ITEMS
alter table public.items enable row level security;

drop policy if exists "items_insert_own" on public.items;
drop policy if exists "items_select_all" on public.items;

create policy "items_insert_own"
on public.items
for insert
to authenticated
with check (poster_id = auth.uid());

create policy "items_select_all"
on public.items
for select
to authenticated
using (true);

