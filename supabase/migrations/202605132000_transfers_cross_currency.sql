-- Cross-currency transfers (Phase 4c follow-up)
-- Created: 2026-05-13
--
-- When the source and destination accounts use different currencies, the
-- transfer needs an explicit destination amount (the user is essentially
-- recording both sides of a currency exchange). Same-currency transfers
-- keep their old single-amount behavior.

create or replace function public.record_transfer(
    p_user_id uuid,
    p_from_account_id uuid,
    p_to_account_id uuid,
    p_amount numeric,
    p_date date,
    p_description text default null,
    p_to_amount numeric default null
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
    v_label_out text;
    v_label_in text;
    v_to_amount numeric;
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

    if v_from.currency = v_to.currency then
        v_to_amount := p_amount;
    else
        if p_to_amount is null or p_to_amount <= 0 then
            return jsonb_build_object(
                'success', false,
                'error', 'Destination amount is required for cross-currency transfers'
            );
        end if;
        v_to_amount := p_to_amount;
    end if;

    v_label_out := coalesce(nullif(p_description, ''), format('Transfer to %s', v_to.name));
    v_label_in := coalesce(nullif(p_description, ''), format('Transfer from %s', v_from.name));

    -- Outflow on the source account, in the source currency.
    insert into public.transactions (
        user_id, amount, description, category, date,
        currency, base_currency, exchange_rate, converted_amount,
        is_transfer, transfer_pair_id, account_id,
        payment_method, exclude_from_allowance
    )
    values (
        p_user_id, p_amount, v_label_out, 'transfer', p_date,
        v_from.currency, v_from.currency, 1, p_amount,
        true, v_pair_id, p_from_account_id,
        'Transfer', true
    )
    returning id into v_out_id;

    -- Inflow on the destination account, in the destination currency. The
    -- amount is negative (= money in) so the balance formula adds it back.
    insert into public.transactions (
        user_id, amount, description, category, date,
        currency, base_currency, exchange_rate, converted_amount,
        is_transfer, transfer_pair_id, account_id,
        payment_method, exclude_from_allowance
    )
    values (
        p_user_id, -v_to_amount, v_label_in, 'transfer', p_date,
        v_to.currency, v_to.currency, 1, -v_to_amount,
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
