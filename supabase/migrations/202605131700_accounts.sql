-- Multi-account / wallet abstraction
-- Created: 2026-05-13
--
-- Adds a per-user `accounts` table (one per checking/savings/card/cash/etc),
-- plus the columns on transactions needed to slice spending by source and
-- model transfers between accounts without double-counting them in spending
-- aggregates (mirrors how is_income / is_settlement already work).
--
-- Phase 4a only: schema + backfill + RLS + realtime. Read/write wiring across
-- dashboard, analytics, add-expense, crons, etc. happens in phases 4b–4c.

-- 1. accounts table
create table if not exists public.accounts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    type text not null check (type in ('cash', 'checking', 'savings', 'credit_card', 'digital_wallet', 'other')),
    currency text not null,
    opening_balance numeric not null default 0,
    credit_limit numeric,
    color text default '#8A2BE2',
    icon text default 'wallet',
    is_primary boolean not null default false,
    archived_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint accounts_name_length check (char_length(name) between 1 and 50),
    constraint accounts_credit_limit_only_for_card check (
        credit_limit is null or type = 'credit_card'
    )
);

create index if not exists accounts_user_idx
    on public.accounts (user_id) where archived_at is null;

-- Enforce at most one primary account per user (among non-archived).
create unique index if not exists accounts_one_primary_per_user
    on public.accounts (user_id) where is_primary = true and archived_at is null;

-- 2. updated_at trigger
create or replace function public.accounts_touch_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at
    before update on public.accounts
    for each row execute function public.accounts_touch_updated_at();

-- 3. RLS — each user owns their accounts
alter table public.accounts enable row level security;

do $$
begin
    if exists (select 1 from pg_policies where schemaname='public' and tablename='accounts' and policyname='Accounts: owner select') then
        drop policy "Accounts: owner select" on public.accounts;
    end if;
    if exists (select 1 from pg_policies where schemaname='public' and tablename='accounts' and policyname='Accounts: owner insert') then
        drop policy "Accounts: owner insert" on public.accounts;
    end if;
    if exists (select 1 from pg_policies where schemaname='public' and tablename='accounts' and policyname='Accounts: owner update') then
        drop policy "Accounts: owner update" on public.accounts;
    end if;
    if exists (select 1 from pg_policies where schemaname='public' and tablename='accounts' and policyname='Accounts: owner delete') then
        drop policy "Accounts: owner delete" on public.accounts;
    end if;
end $$;

create policy "Accounts: owner select" on public.accounts for select using (auth.uid() = user_id);
create policy "Accounts: owner insert" on public.accounts for insert with check (auth.uid() = user_id);
create policy "Accounts: owner update" on public.accounts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Accounts: owner delete" on public.accounts for delete using (auth.uid() = user_id);

-- 4. Columns on transactions
alter table public.transactions
    add column if not exists account_id uuid references public.accounts(id) on delete set null;
alter table public.transactions
    add column if not exists is_transfer boolean not null default false;
alter table public.transactions
    add column if not exists transfer_pair_id uuid;

create index if not exists transactions_account_idx
    on public.transactions (account_id) where account_id is not null;

create index if not exists transactions_transfer_pair_idx
    on public.transactions (transfer_pair_id) where transfer_pair_id is not null;

-- 5. Backfill: for every existing user that has transactions but no account
-- yet, create a default "Cash" account and assign their orphan transactions
-- to it. Idempotent — only acts on rows where account_id is null.
do $$
declare
    u record;
    new_account_id uuid;
    user_default_currency text;
begin
    for u in
        select distinct t.user_id
        from public.transactions t
        where t.account_id is null
    loop
        -- Skip if the user already has an account (manual creation, etc.).
        if exists (select 1 from public.accounts where user_id = u.user_id) then
            update public.transactions t
            set account_id = (
                select id from public.accounts
                where user_id = u.user_id and archived_at is null
                order by is_primary desc, created_at asc
                limit 1
            )
            where t.user_id = u.user_id and t.account_id is null;
            continue;
        end if;

        -- Pick the user's most-used currency among unassigned tx as the
        -- default for the new Cash account.
        select currency into user_default_currency
        from public.transactions
        where user_id = u.user_id and account_id is null and currency is not null
        group by currency
        order by count(*) desc
        limit 1;

        if user_default_currency is null then
            user_default_currency := 'USD';
        end if;

        insert into public.accounts (user_id, name, type, currency, is_primary)
        values (u.user_id, 'Cash', 'cash', user_default_currency, true)
        returning id into new_account_id;

        update public.transactions
        set account_id = new_account_id
        where user_id = u.user_id and account_id is null;
    end loop;
end $$;

-- 6. Auto-assign account_id on new transactions until the add-expense form
-- wires it explicitly (Phase 4b). If the inserting user has a primary
-- account, use that; otherwise their oldest active account; otherwise null.
create or replace function public.transactions_default_account()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if new.account_id is null then
        select id into new.account_id
        from public.accounts
        where user_id = new.user_id and is_primary = true and archived_at is null
        limit 1;

        if new.account_id is null then
            select id into new.account_id
            from public.accounts
            where user_id = new.user_id and archived_at is null
            order by created_at asc
            limit 1;
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists transactions_set_default_account on public.transactions;
create trigger transactions_set_default_account
    before insert on public.transactions
    for each row execute function public.transactions_default_account();

-- 7. Realtime
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'accounts'
    ) then
        alter publication supabase_realtime add table public.accounts;
    end if;
end $$;
