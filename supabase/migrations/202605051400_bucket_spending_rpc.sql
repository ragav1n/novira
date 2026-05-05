-- RPC: aggregate bucket spending per (bucket, currency) in SQL.
-- Replaces the client-side fetch+sum that pulled up to 5000 rows per call.
-- Returns one row per (bucket_id, currency) so the client only needs to do FX
-- conversion and final summation across currencies.
--
-- p_workspace_id semantics (mirrors BucketService.getBucketSpending):
--   NULL          -> all of the user's transactions
--   'personal'    -> user's own transactions with group_id IS NULL
--   <uuid string> -> transactions belonging to that group

CREATE OR REPLACE FUNCTION compute_user_bucket_spending(
    p_user_id UUID,
    p_workspace_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    bucket_id UUID,
    category TEXT,
    currency TEXT,
    base_currency TEXT,
    exchange_rate NUMERIC,
    share_amount NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
    SELECT
        t.bucket_id,
        LOWER(COALESCE(t.category, '')) AS category,
        UPPER(COALESCE(t.currency, 'USD')) AS currency,
        UPPER(COALESCE(t.base_currency, t.currency, 'USD')) AS base_currency,
        COALESCE(t.exchange_rate, 1)::NUMERIC AS exchange_rate,
        SUM(
            CASE
                WHEN NOT EXISTS (SELECT 1 FROM splits s WHERE s.transaction_id = t.id) THEN
                    CASE WHEN t.user_id = p_user_id THEN t.amount ELSE 0 END
                WHEN t.user_id = p_user_id THEN
                    GREATEST(
                        t.amount - COALESCE(
                            (SELECT SUM(s.amount) FROM splits s WHERE s.transaction_id = t.id),
                            0
                        ),
                        0
                    )
                ELSE COALESCE(
                    (SELECT s.amount FROM splits s
                     WHERE s.transaction_id = t.id AND s.user_id = p_user_id),
                    0
                )
            END
        ) AS share_amount
    FROM transactions t
    WHERE t.bucket_id IS NOT NULL
      AND (
            (p_workspace_id IS NULL AND t.user_id = p_user_id)
         OR (p_workspace_id = 'personal' AND t.user_id = p_user_id AND t.group_id IS NULL)
         OR (p_workspace_id IS NOT NULL
             AND p_workspace_id <> 'personal'
             AND t.group_id::TEXT = p_workspace_id)
      )
    GROUP BY
        t.bucket_id,
        LOWER(COALESCE(t.category, '')),
        UPPER(COALESCE(t.currency, 'USD')),
        UPPER(COALESCE(t.base_currency, t.currency, 'USD')),
        COALESCE(t.exchange_rate, 1);
$$;

COMMENT ON FUNCTION compute_user_bucket_spending IS
    'Returns aggregated spending per (bucket, category, currency) for a user/workspace. '
    'Client applies FX conversion and bucket.allowed_categories filter.';
