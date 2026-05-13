-- Account balance computation (Phase 4c.2)
-- Created: 2026-05-13
--
-- Per-account expected balance:
--   balance = opening_balance − Σ amount  (over all txs on this account)
--
-- Sign convention: positive `amount` is money out (expense / transfer out),
-- negative is money in (income / transfer in / add-funds). For cash and bank
-- accounts the result is positive when you have money. For credit cards the
-- result goes negative when you have debt — utilization is computed as the
-- absolute of that against the credit_limit.

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
        a.opening_balance - coalesce(sum(t.amount), 0)::numeric as balance
    from public.accounts a
    left join public.transactions t
        on t.account_id = a.id
       and t.user_id = a.user_id
    where a.user_id = p_user_id
    group by a.id, a.opening_balance;
$$;
