-- Fix balance computation for is_income rows + allow is_transfer rows
-- Created: 2026-05-13
--
-- Two related fixes:
--
-- 1) compute_account_balances was treating income (positive amount + is_income=true)
--    as money OUT, the same as a regular expense. That made the balance plunge
--    by every income transaction's amount — €5000 salary tracked = €5000 of
--    extra "outflow" against the account.
--
-- 2) positive_amount_check only allowed negative amounts when is_settlement=true,
--    which would fail the inflow leg of record_transfer (negative amount,
--    is_transfer=true, is_settlement=false). Relax it to also allow
--    is_transfer rows.
--
-- Signed contribution to balance (what the new SQL implements):
--   is_income=true: +amount   (positive amount = money in)
--   everything else: -amount  (positive amount = money out;
--                              add-funds / settlement-creditor / transfer-inflow
--                              are negative amounts so this still adds them back in)

create or replace function public.compute_account_balances(p_user_id uuid)
returns table (
    account_id uuid,
    balance numeric
)
language sql
stable
security invoker
as $$
    select
        a.id as account_id,
        a.opening_balance + coalesce(
            sum(
                case
                    when coalesce(t.is_income, false) then t.amount
                    else -t.amount
                end
            ),
            0
        )::numeric as balance
    from public.accounts a
    left join public.transactions t
        on t.account_id = a.id
       and t.user_id = a.user_id
    where a.user_id = p_user_id
    group by a.id, a.opening_balance;
$$;

-- Relax the positive_amount_check to allow transfer rows (which need negative
-- amounts on the inflow leg). Settlement is still allowed; everything else
-- still has to be positive.
alter table public.transactions drop constraint if exists positive_amount_check;
alter table public.transactions add constraint positive_amount_check
    check (
        is_settlement = true
        or coalesce(is_transfer, false) = true
        or amount > 0
    );
