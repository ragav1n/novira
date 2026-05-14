-- Trips (Travel mode)
-- Created: 2026-05-14
--
-- A trip is a named date range with an optional base location and home
-- currency. While a trip is active, new expenses get auto-tagged with the
-- trip slug (handled client-side in useExpenseSubmission). Trips can be
-- workspace-scoped via group_id, mirroring savings_goals.

create table if not exists public.trips (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    group_id uuid references public.groups(id) on delete set null,
    name text not null,
    slug text not null,
    start_date date not null,
    end_date date not null,
    home_currency text,
    base_location text,
    auto_tag_enabled boolean not null default true,
    created_at timestamptz not null default now(),
    constraint trips_dates_valid check (end_date >= start_date),
    constraint trips_name_length check (char_length(name) between 1 and 80),
    constraint trips_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{0,31}$'),
    constraint trips_user_slug_unique unique (user_id, slug)
);

create index if not exists trips_user_active_idx
    on public.trips (user_id, start_date, end_date);

create index if not exists trips_group_active_idx
    on public.trips (group_id, start_date, end_date)
    where group_id is not null;

-- RLS: owner can manage; group members can read/write group-scoped trips
alter table public.trips enable row level security;

do $$
begin
    if exists (select 1 from pg_policies where schemaname='public' and tablename='trips' and policyname='Trips: owner or group member') then
        drop policy "Trips: owner or group member" on public.trips;
    end if;
end $$;

create policy "Trips: owner or group member"
    on public.trips for all
    using (
        auth.uid() = user_id
        or (
            group_id is not null
            and group_id in (select group_id from public.group_members where user_id = auth.uid())
        )
    )
    with check (
        auth.uid() = user_id
        or (
            group_id is not null
            and group_id in (select group_id from public.group_members where user_id = auth.uid())
        )
    );
