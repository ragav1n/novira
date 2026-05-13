-- Fix balance math for multi-currency transactions
-- Created: 2026-05-13
--
-- compute_account_balances was summing raw `amount` across mixed currencies.
-- A user who logs ₹100,000 in INR and €30 in EUR on the same account got
-- a balance of `0 − (100,000 + 30) = −100,030` with a "€" symbol slapped on
-- — total nonsense.
--
-- Every transaction already stores converted_amount in the user's base
-- currency (= amount × exchange_rate, computed at submit time). Sum that
-- instead. The function now returns just the signed activity in base
-- currency per account; the client adds the opening_balance separately
-- (converting from account.currency → base currency where needed) since
-- exchange rates live in the client cache, not the database.

-- Return shape is changing (balance → activity_base), so CREATE OR REPLACE
-- isn't enough — Postgres rejects return-type changes. Drop first.
drop function if exists public.compute_account_balances(uuid);

create function public.compute_account_balances(p_user_id uuid)
returns table (
    account_id uuid,
    activity_base numeric
)
language sql
stable
security invoker
as $$
    select
        a.id as account_id,
        coalesce(
            sum(
                case
                    when coalesce(t.is_income, false)
                        then coalesce(t.converted_amount, t.amount * coalesce(t.exchange_rate, 1))
                    else
                        -coalesce(t.converted_amount, t.amount * coalesce(t.exchange_rate, 1))
                end
            ),
            0
        )::numeric as activity_base
    from public.accounts a
    left join public.transactions t
        on t.account_id = a.id
       and t.user_id = a.user_id
    where a.user_id = p_user_id
    group by a.id;
$$;
