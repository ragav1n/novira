-- Normalize legacy credit-card opening balances to the negative-for-debt convention
-- Created: 2026-05-13
--
-- Before today, the account form used a single ambiguous "Opening balance"
-- label for all types. Credit-card users who typed `1000` typically meant
-- "$1000 starting debt" — but it was stored as +1000 and the balance math
-- (opening + activity) interpreted that as "$1000 available", flipping the
-- meaning of every subsequent display.
--
-- The new form labels it "Starting debt" and flips the sign client-side so
-- the database always stores debt as negative. This migration brings legacy
-- positive credit-card openings into the same convention by flipping their
-- sign. Negative existing values are left alone (they were already correct
-- under the old ambiguous label).
--
-- This is a one-time normalization. There's no way to perfectly recover a
-- user who genuinely had a credit balance on their card; that fraction is
-- expected to be near zero. The fix is to re-enter the value if it was
-- already correct as positive.

update public.accounts
set opening_balance = -opening_balance
where type = 'credit_card'
  and opening_balance > 0;

-- Same normalization inside the per-currency openings jsonb map. Walk the
-- map, negate any positive numeric value, keep zero and negative values as
-- they are.
update public.accounts
set opening_balances = coalesce(
    (
        select jsonb_object_agg(
            key,
            case
                when (value->>0) is not null and (value::text)::numeric > 0 then to_jsonb(-(value::text)::numeric)
                else value
            end
        )
        from jsonb_each(opening_balances)
    ),
    '{}'::jsonb
)
where type = 'credit_card'
  and opening_balances is not null
  and opening_balances <> '{}'::jsonb;
