-- Re-add a sensible amount-sign check
-- Created: 2026-05-13
--
-- The original positive_amount_check was dropped in 202605132200 because
-- add-funds-dialog rows (negative amount, no settlement flag, category='income')
-- violated it. The app has four legitimate negative-amount kinds:
--   - settlement-creditor:  is_settlement = true,  amount < 0
--   - transfer-inflow:      is_transfer   = true,  amount < 0
--   - is_income tracked:    is_income     = true   (any sign — usually positive)
--   - add-funds:            category = 'income',   amount < 0
--
-- Restore the check with all four exceptions so a stray INSERT (a bug, a
-- mistyped manual mutation, a future RPC) still gets caught at the boundary
-- without blocking real use cases. NOT VALID so we don't re-validate the
-- existing rows (the migration that tried to do so already failed once).

alter table public.transactions drop constraint if exists positive_amount_check;

alter table public.transactions
    add constraint positive_amount_check
    check (
        amount > 0
        or coalesce(is_settlement, false) = true
        or coalesce(is_transfer, false) = true
        or coalesce(is_income, false) = true
        or category = 'income'
    )
    not valid;
