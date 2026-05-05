-- One-off bills / reminders shown on the Cash Flow (calendar) page.
-- Distinct from recurring_templates (which auto-repeats), savings_goals (which
-- track a target amount + deadline), and buckets (which are budget envelopes).

create table if not exists public.scheduled_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    group_id uuid null references public.groups(id) on delete cascade,
    date date not null,
    label text not null,
    amount numeric null,
    currency text null,
    notes text null,
    is_completed boolean not null default false,
    created_at timestamptz not null default now()
);

create index if not exists scheduled_events_user_date_idx
    on public.scheduled_events (user_id, date);
create index if not exists scheduled_events_group_date_idx
    on public.scheduled_events (group_id, date);

alter table public.scheduled_events enable row level security;

drop policy if exists "scheduled_events_select_own" on public.scheduled_events;
create policy "scheduled_events_select_own" on public.scheduled_events
    for select using (auth.uid() = user_id);

drop policy if exists "scheduled_events_insert_own" on public.scheduled_events;
create policy "scheduled_events_insert_own" on public.scheduled_events
    for insert with check (auth.uid() = user_id);

drop policy if exists "scheduled_events_update_own" on public.scheduled_events;
create policy "scheduled_events_update_own" on public.scheduled_events
    for update using (auth.uid() = user_id);

drop policy if exists "scheduled_events_delete_own" on public.scheduled_events;
create policy "scheduled_events_delete_own" on public.scheduled_events
    for delete using (auth.uid() = user_id);
