create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('android')),
  token text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.device_push_tokens enable row level security;

drop policy if exists "user_select_own_tokens" on public.device_push_tokens;
create policy "user_select_own_tokens"
on public.device_push_tokens
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_insert_own_tokens" on public.device_push_tokens;
create policy "user_insert_own_tokens"
on public.device_push_tokens
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_update_own_tokens" on public.device_push_tokens;
create policy "user_update_own_tokens"
on public.device_push_tokens
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
