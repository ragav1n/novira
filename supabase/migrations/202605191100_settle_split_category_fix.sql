-- Fix settle_split: restore the transaction category in the SELECT
-- Created: 2026-05-19
--
-- The 202605132500 rewrite dropped `t.category` from the record SELECT but
-- kept referencing `v_split.category` when inserting the settlement rows.
-- The `splits` table has no `category` column of its own, so settling any
-- split failed with: record "v_split" has no field "category".
--
-- Re-create the function with `t.category` selected back in. Everything else
-- is identical to 202605132500.

create or replace function public.settle_split(split_id uuid)
returns boolean
language plpgsql
security definer
as $$
declare
    v_split record;
    v_debtor_id uuid;
    v_creditor_id uuid;
    v_amount numeric;
    v_currency text;
    v_exchange_rate numeric;
    v_base_currency text;
    v_description text;
    v_debtor_account_id uuid;
    v_creditor_account_id uuid;
begin
    -- 1. Fetch split + parent transaction context (including category).
    select s.*, t.user_id as creditor_id, t.category, t.currency, t.exchange_rate,
           t.base_currency, t.description
    into v_split
    from public.splits s
    join public.transactions t on t.id = s.transaction_id
    where s.id = split_id and s.is_paid = false;

    if not found then
        raise exception 'Split not found or already settled';
    end if;

    v_debtor_id := v_split.user_id;
    v_creditor_id := v_split.creditor_id;
    v_amount := v_split.amount;
    v_currency := v_split.currency;
    v_exchange_rate := v_split.exchange_rate;
    v_base_currency := v_split.base_currency;
    v_description := v_split.description;

    if auth.uid() <> v_debtor_id and auth.uid() <> v_creditor_id then
        raise exception 'Not authorized to settle this split';
    end if;

    -- 2. Look up each party's primary (or oldest active) account so the
    -- settlement rows land where they belong even if the trigger were skipped.
    select id into v_debtor_account_id
    from public.accounts
    where user_id = v_debtor_id and is_primary = true and archived_at is null
    limit 1;
    if v_debtor_account_id is null then
        select id into v_debtor_account_id
        from public.accounts
        where user_id = v_debtor_id and archived_at is null
        order by created_at asc
        limit 1;
    end if;

    select id into v_creditor_account_id
    from public.accounts
    where user_id = v_creditor_id and is_primary = true and archived_at is null
    limit 1;
    if v_creditor_account_id is null then
        select id into v_creditor_account_id
        from public.accounts
        where user_id = v_creditor_id and archived_at is null
        order by created_at asc
        limit 1;
    end if;

    -- 3. Mark split as paid.
    update public.splits set is_paid = true where id = split_id;

    -- 4. Debtor settlement (money out).
    insert into public.transactions (
        user_id, amount, description, category, date,
        currency, exchange_rate, base_currency,
        is_settlement, account_id
    ) values (
        v_debtor_id, v_amount, 'Settled: ' || v_description, v_split.category, now(),
        v_currency, v_exchange_rate, v_base_currency,
        true, v_debtor_account_id
    );

    -- 5. Creditor settlement (money in).
    insert into public.transactions (
        user_id, amount, description, category, date,
        currency, exchange_rate, base_currency,
        is_settlement, account_id
    ) values (
        v_creditor_id, -v_amount, 'Settlement Received: ' || v_description, v_split.category, now(),
        v_currency, v_exchange_rate, v_base_currency,
        true, v_creditor_account_id
    );

    return true;
end;
$$;
