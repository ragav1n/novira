-- Fix the per-currency leg of the credit-card sign normalization
-- Created: 2026-05-13
--
-- The earlier migration 202605132900 successfully flipped
-- accounts.opening_balance for credit cards (positive → negative), but its
-- per-currency loop over opening_balances was a no-op: it used `value->>0`
-- to test the entry, which returns NULL for a jsonb scalar number (->> with
-- an integer is array indexing). The CASE always fell to ELSE and the map
-- was rewritten identically.
--
-- Correctly detect jsonb numbers via jsonb_typeof + value::text::numeric.
-- Idempotent: gated on existence of at least one positive entry, so
-- re-running after a partial state won't double-flip already-negative rows.

update public.accounts
set opening_balances = coalesce(
    (
        select jsonb_object_agg(
            key,
            case
                when jsonb_typeof(v) = 'number' and (v::text)::numeric > 0
                    then to_jsonb(-((v::text)::numeric))
                else v
            end
        )
        from jsonb_each(opening_balances) as kv(key, v)
    ),
    '{}'::jsonb
)
where type = 'credit_card'
  and opening_balances is not null
  and opening_balances <> '{}'::jsonb
  and exists (
      select 1
      from jsonb_each(opening_balances) as kv2(key2, v2)
      where jsonb_typeof(v2) = 'number'
        and (v2::text)::numeric > 0
  );
