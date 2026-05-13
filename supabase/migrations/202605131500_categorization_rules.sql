-- Auto-categorization rules
-- Created: 2026-05-13
--
-- Persistent rules that match against a transaction's description or place
-- name and prefill category/bucket/exclude_from_allowance at add or import
-- time. Per-user; first match wins per output field, highest priority first.

create table if not exists public.categorization_rules (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    match_field text not null check (match_field in ('description', 'place_name')),
    match_type text not null check (match_type in ('contains', 'equals', 'regex')),
    pattern text not null,
    category text,
    bucket_id uuid references public.buckets(id) on delete set null,
    exclude_from_allowance boolean,
    priority int not null default 0,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint categorization_rules_pattern_length check (char_length(pattern) <= 200),
    constraint categorization_rules_has_action check (
        category is not null or bucket_id is not null or exclude_from_allowance is not null
    )
);

create index if not exists categorization_rules_user_priority_idx
    on public.categorization_rules (user_id, priority desc, is_active);

-- updated_at maintenance
create or replace function public.categorization_rules_touch_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists categorization_rules_set_updated_at on public.categorization_rules;
create trigger categorization_rules_set_updated_at
    before update on public.categorization_rules
    for each row execute function public.categorization_rules_touch_updated_at();

-- RLS: each user owns their rules
alter table public.categorization_rules enable row level security;

do $$
begin
    if exists (select 1 from pg_policies where schemaname='public' and tablename='categorization_rules' and policyname='Rules: owner select') then
        drop policy "Rules: owner select" on public.categorization_rules;
    end if;
    if exists (select 1 from pg_policies where schemaname='public' and tablename='categorization_rules' and policyname='Rules: owner insert') then
        drop policy "Rules: owner insert" on public.categorization_rules;
    end if;
    if exists (select 1 from pg_policies where schemaname='public' and tablename='categorization_rules' and policyname='Rules: owner update') then
        drop policy "Rules: owner update" on public.categorization_rules;
    end if;
    if exists (select 1 from pg_policies where schemaname='public' and tablename='categorization_rules' and policyname='Rules: owner delete') then
        drop policy "Rules: owner delete" on public.categorization_rules;
    end if;
end $$;

create policy "Rules: owner select"
    on public.categorization_rules for select
    using (auth.uid() = user_id);

create policy "Rules: owner insert"
    on public.categorization_rules for insert
    with check (auth.uid() = user_id);

create policy "Rules: owner update"
    on public.categorization_rules for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Rules: owner delete"
    on public.categorization_rules for delete
    using (auth.uid() = user_id);
