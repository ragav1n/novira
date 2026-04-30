-- Monthly AI recap storage so users can revisit prior months and the
-- end-of-month auto-show modal can detect unseen recaps.

create table if not exists public.monthly_recaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}(-[0-9]{2}|-FY)$'),
  recap jsonb not null,
  analyzed jsonb not null,
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  unique (user_id, month)
);

create index if not exists monthly_recaps_user_month_idx
  on public.monthly_recaps (user_id, month desc);

alter table public.monthly_recaps enable row level security;

drop policy if exists "select own recaps" on public.monthly_recaps;
create policy "select own recaps" on public.monthly_recaps
  for select using (auth.uid() = user_id);

drop policy if exists "insert own recaps" on public.monthly_recaps;
create policy "insert own recaps" on public.monthly_recaps
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own recaps" on public.monthly_recaps;
create policy "update own recaps" on public.monthly_recaps
  for update using (auth.uid() = user_id);

drop policy if exists "delete own recaps" on public.monthly_recaps;
create policy "delete own recaps" on public.monthly_recaps
  for delete using (auth.uid() = user_id);
