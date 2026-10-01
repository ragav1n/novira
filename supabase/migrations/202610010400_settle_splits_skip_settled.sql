-- Settling: lock the split, NULL-safe guard, and a batch that skips splits already
-- settled instead of failing the whole call.
--
-- WHY
--   * settle_splits_batch (202605191000) called settle_split for every id, and
--     settle_split raises 'Split not found or already settled' for a paid one. One
--     stale id in the list — a split the other party settled a moment earlier, or
--     a double tap — rolled the entire batch back and showed an error, though
--     nothing was wrong. Already-paid splits are now skipped and not counted; the
--     return value is the number actually settled. A split the caller is not a
--     party to still raises (and rolls back), as before.
--   * settle_split read the split with a plain SELECT, so two concurrent calls (the
--     debtor's "Settle" and the creditor's "Mark received", or the batch racing a
--     single settle) could both see is_paid = false and both insert a pair of
--     settlement rows. The SELECT now takes FOR UPDATE OF s; the second caller
--     waits, then finds the split paid.
--   * The bare `auth.uid() <> ...` comparison fails open on NULL (see 202608220100).
--     Only reachable with EXECUTE, which anon no longer has, but made NULL-safe here
--     since the body is being re-issued anyway.
--
-- settle_split's body is otherwise copied verbatim from
-- 202605191100_settle_split_category_fix.sql (the latest definition).
--
-- Neither function needs a creditor id: the creditor is read from the parent
-- transaction. The client's creditorId is only used for its broadcast.

create or replace function public.settle_split(split_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
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
    where s.id = split_id and s.is_paid = false
    for update of s;

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

    if auth.uid() is null or (auth.uid() <> v_debtor_id and auth.uid() <> v_creditor_id) then
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

revoke execute on function public.settle_split(uuid) from public;
revoke execute on function public.settle_split(uuid) from anon;
grant  execute on function public.settle_split(uuid) to authenticated;
grant  execute on function public.settle_split(uuid) to service_role;

create or replace function public.settle_splits_batch(split_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_id uuid;
    v_count integer := 0;
begin
    foreach v_id in array split_ids loop
        -- Lock first so a concurrent settle cannot slip in between the check and
        -- the call; an already-paid (or missing) split is skipped, not fatal.
        perform 1 from public.splits s
        where s.id = v_id and s.is_paid = false
        for update;

        if found then
            perform public.settle_split(v_id);
            v_count := v_count + 1;
        end if;
    end loop;
    return v_count;
end;
$$;

revoke execute on function public.settle_splits_batch(uuid[]) from public;
revoke execute on function public.settle_splits_batch(uuid[]) from anon;
grant  execute on function public.settle_splits_batch(uuid[]) to authenticated;
grant  execute on function public.settle_splits_batch(uuid[]) to service_role;
