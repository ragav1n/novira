-- Fix balance computation for is_income rows + drop overly-strict
-- positive_amount_check constraint.
-- Created: 2026-05-13
--
-- Two related fixes:
--
-- 1) compute_account_balances was treating income (positive amount + is_income=true)
--    as money OUT, the same as a regular expense. That made the balance plunge
--    by every income transaction's amount — a €5000 salary tracked became €5000
--    of extra "outflow" against the account.
--
-- 2) positive_amount_check (added in 202602161830) only allowed negative
--    amounts on settlement rows. But the codebase legitimately writes
--    negatives in several other places:
--      - add-funds-dialog (income-style row, no settlement flag)
--      - transfer inflow leg (is_transfer=true)
--      - settlement creditor side (is_settlement=true) — already permitted
--    Trying to add a broader CHECK fails because existing add-funds rows
--    already violate it. The check has been working against the app for
--    longer than it's been helping. Drop it.
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

-- Drop the overly-strict amount-sign check. Idempotent.
alter table public.transactions drop constraint if exists positive_amount_check;
