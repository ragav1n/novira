-- Add a "spent" aggregate alongside signed activity
-- Created: 2026-05-13
--
-- For simple accounts (cash, checking, savings), the natural answer to
-- "what's this account doing?" is "how much have I spent through it" — a
-- gross-expenses number, not a net-balance number. Returning it alongside
-- the existing activity_native lets the client pick the right framing per
-- account type without another round-trip.

drop function if exists public.compute_account_balances(uuid);

create function public.compute_account_balances(p_user_id uuid)
returns table (
    account_id uuid,
    tx_currency text,
    activity_native numeric,
    spent_native numeric
)
language sql
stable
security invoker
as $$
    select
        t.account_id,
        upper(coalesce(t.currency, 'USD')) as tx_currency,
        -- Signed activity: positive amount with is_income flips sign (money in).
        coalesce(
            sum(
                case
                    when coalesce(t.is_income, false) then t.amount
                    else -t.amount
                end
            ),
            0
        )::numeric as activity_native,
        -- Gross expenses: just regular outflows, excluding income, settlements,
        -- and transfers. This is what most users mean by "spent on this card".
        coalesce(
            sum(
                case
                    when t.amount > 0
                         and not coalesce(t.is_income, false)
                         and not coalesce(t.is_settlement, false)
                         and not coalesce(t.is_transfer, false)
                    then t.amount
                    else 0
                end
            ),
            0
        )::numeric as spent_native
    from public.transactions t
    where t.user_id = p_user_id
      and t.account_id is not null
    group by t.account_id, upper(coalesce(t.currency, 'USD'));
$$;
