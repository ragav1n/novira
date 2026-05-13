-- Account-scoped bucket spending (Phase 4c follow-up)
-- Created: 2026-05-13
--
-- compute_user_bucket_spending learns an optional p_account_id parameter so
-- the dashboard's per-account filter can scope bucket totals too. Passing
-- null keeps the legacy "across all accounts" behavior.

create or replace function public.compute_user_bucket_spending(
    p_user_id uuid,
    p_workspace_id text default null,
    p_account_id uuid default null
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
      and (p_account_id is null or t.account_id = p_account_id)
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
