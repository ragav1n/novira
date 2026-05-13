-- Transfers between accounts (Phase 4c)
-- Created: 2026-05-13
--
-- A transfer moves money from one account to another. It is NOT spending and
-- must be excluded from every aggregate that sums spending. The transfer is
-- modelled as a paired row insert: a positive (outflow) on the source account
-- and a negative (inflow) on the destination, both with is_transfer=true and
-- both sharing a single transfer_pair_id so they can be jointly displayed,
-- edited, or undone.

create or replace function public.record_transfer(
    p_user_id uuid,
    p_from_account_id uuid,
    p_to_account_id uuid,
    p_amount numeric,
    p_date date,
    p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_pair_id uuid := gen_random_uuid();
    v_from public.accounts%rowtype;
    v_to public.accounts%rowtype;
    v_label text;
    v_out_id uuid;
    v_in_id uuid;
begin
    if p_user_id <> auth.uid() then
        return jsonb_build_object('success', false, 'error', 'Unauthorized');
    end if;
    if p_amount is null or p_amount <= 0 then
        return jsonb_build_object('success', false, 'error', 'Amount must be greater than 0');
    end if;
    if p_from_account_id = p_to_account_id then
        return jsonb_build_object('success', false, 'error', 'Source and destination must differ');
    end if;

    select * into v_from from public.accounts where id = p_from_account_id and user_id = p_user_id;
    select * into v_to from public.accounts where id = p_to_account_id and user_id = p_user_id;
    if v_from.id is null or v_to.id is null then
        return jsonb_build_object('success', false, 'error', 'Account not found');
    end if;
    if v_from.currency <> v_to.currency then
        return jsonb_build_object('success', false, 'error', 'Cross-currency transfers are not yet supported');
    end if;

    v_label := coalesce(nullif(p_description, ''), format('Transfer to %s', v_to.name));

    -- Outflow on the source account (positive = money out, matches the
    -- spending sign convention even though aggregates ignore is_transfer rows).
    insert into public.transactions (
        user_id, amount, description, category, date,
        currency, base_currency, exchange_rate, converted_amount,
        is_transfer, transfer_pair_id, account_id,
        payment_method, exclude_from_allowance
    )
    values (
        p_user_id, p_amount, v_label, 'transfer', p_date,
        v_from.currency, v_from.currency, 1, p_amount,
        true, v_pair_id, p_from_account_id,
        'Transfer', true
    )
    returning id into v_out_id;

    -- Inflow on the destination account (negative = money in, mirrors how
    -- add-funds works elsewhere in the app).
    insert into public.transactions (
        user_id, amount, description, category, date,
        currency, base_currency, exchange_rate, converted_amount,
        is_transfer, transfer_pair_id, account_id,
        payment_method, exclude_from_allowance
    )
    values (
        p_user_id, -p_amount, format('Transfer from %s', v_from.name), 'transfer', p_date,
        v_to.currency, v_to.currency, 1, -p_amount,
        true, v_pair_id, p_to_account_id,
        'Transfer', true
    )
    returning id into v_in_id;

    return jsonb_build_object(
        'success', true,
        'pair_id', v_pair_id,
        'out_id', v_out_id,
        'in_id', v_in_id
    );
exception when others then
    return jsonb_build_object('success', false, 'error', sqlerrm);
end;
$$;

-- Bucket spending aggregate must also ignore transfer rows.
create or replace function public.compute_user_bucket_spending(
    p_user_id uuid,
    p_workspace_id text default null
)
returns table (
    bucket_id uuid,
    category text,
    currency text,
    base_currency text,
    exchange_rate numeric,
    share_amount numeric
)
language sql
stable
security invoker
as $$
    select
        t.bucket_id,
        lower(coalesce(t.category, '')) as category,
        upper(coalesce(t.currency, 'USD')) as currency,
        upper(coalesce(t.base_currency, t.currency, 'USD')) as base_currency,
        coalesce(t.exchange_rate, 1)::numeric as exchange_rate,
        sum(
            case
                when not exists (select 1 from splits s where s.transaction_id = t.id) then
                    case when t.user_id = p_user_id then t.amount else 0 end
                when t.user_id = p_user_id then
                    greatest(
                        t.amount - coalesce(
                            (select sum(s.amount) from splits s where s.transaction_id = t.id),
                            0
                        ),
                        0
                    )
                else coalesce(
                    (select s.amount from splits s
                     where s.transaction_id = t.id and s.user_id = p_user_id),
                    0
                )
            end
        ) as share_amount
    from public.transactions t
    where t.bucket_id is not null
      and coalesce(t.is_income, false) = false
      and coalesce(t.is_transfer, false) = false
      and (
            (p_workspace_id is null and t.user_id = p_user_id)
         or (p_workspace_id = 'personal' and t.user_id = p_user_id and t.group_id is null)
         or (p_workspace_id is not null
             and p_workspace_id <> 'personal'
             and t.group_id::text = p_workspace_id)
      )
    group by
        t.bucket_id,
        lower(coalesce(t.category, '')),
        upper(coalesce(t.currency, 'USD')),
        upper(coalesce(t.base_currency, t.currency, 'USD')),
        coalesce(t.exchange_rate, 1);
$$;
