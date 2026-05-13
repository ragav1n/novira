-- Fix balance math when the user's base currency has changed over time.
-- Created: 2026-05-13
--
-- Each transaction stores converted_amount as `amount × exchange_rate at
-- submit time`, in whatever base_currency was active then. If the user
-- ever switched their base (EUR → INR, etc.), old rows are denominated in
-- the old base and new rows in the new — summing them directly is mixed
-- units (was the cause of an "expenses total ₹2.9L" reading that didn't
-- include a ₹4L bucket).
--
-- Right answer: return activity per native tx currency. The client
-- converts each line using its live exchange-rate cache and sums.

drop function if exists public.compute_account_balances(uuid);

create function public.compute_account_balances(p_user_id uuid)
returns table (
    account_id uuid,
    tx_currency text,
    activity_native numeric
)
language sql
stable
security invoker
as $$
    select
        t.account_id,
        upper(coalesce(t.currency, 'USD')) as tx_currency,
        coalesce(
            sum(
                case
                    when coalesce(t.is_income, false) then t.amount
                    else -t.amount
                end
            ),
            0
        )::numeric as activity_native
    from public.transactions t
    where t.user_id = p_user_id
      and t.account_id is not null
    group by t.account_id, upper(coalesce(t.currency, 'USD'));
$$;
