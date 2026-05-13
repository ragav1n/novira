-- Per-currency opening balances
-- Created: 2026-05-13
--
-- accounts.opening_balance is a single numeric in the account's default
-- currency. A forex / multi-currency wallet (Wise, Revolut, Apple Cash with
-- a travel card) needs separate opening balances per currency it holds —
-- "I started with €200 + $50 + £15 in Revolut".
--
-- Add an opening_balances jsonb map ({currency: amount}). opening_balance
-- stays for back-compat with everything else that reads it; on save the
-- app keeps the default-currency entry in sync between the two.

alter table public.accounts
    add column if not exists opening_balances jsonb not null default '{}'::jsonb;

-- Backfill: copy opening_balance into the new map under the account's
-- default currency so existing accounts read identically before/after.
update public.accounts
set opening_balances = jsonb_build_object(currency, opening_balance)
where opening_balance is not null
  and opening_balance <> 0
  and (opening_balances is null or opening_balances = '{}'::jsonb);
