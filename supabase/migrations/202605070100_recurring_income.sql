-- Recurring income tracking
-- Adds is_income flag to recurring_templates and transactions, and propagates it
-- through the auto-processor RPC. is_income transactions are excluded from
-- spending aggregates downstream (dashboard run-rate, bucket spending, analytics).
-- Created: 2026-05-07 01:00

ALTER TABLE recurring_templates
    ADD COLUMN IF NOT EXISTS is_income BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS is_income BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_transactions_user_income
    ON transactions (user_id, is_income)
    WHERE is_income = TRUE;

CREATE OR REPLACE FUNCTION process_recurring_transactions(user_id_input UUID)
RETURNS VOID AS $$
DECLARE
    template_record RECORD;
    new_transaction_id UUID;
    process_date DATE;
    debtor_id UUID;
    split_amt NUMERIC;
    friend_ids_json JSONB;
BEGIN
    FOR template_record IN
        SELECT * FROM recurring_templates
        WHERE user_id = user_id_input AND is_active = TRUE AND next_occurrence <= CURRENT_DATE
        FOR UPDATE
    LOOP
        process_date := template_record.next_occurrence;

        WHILE process_date <= CURRENT_DATE LOOP
            -- 1. Insert Transaction (with duplicate check)
            IF NOT EXISTS (
                SELECT 1 FROM transactions
                WHERE user_id = template_record.user_id
                AND description = template_record.description
                AND amount = template_record.amount
                AND date = process_date
            ) THEN
                INSERT INTO transactions (
                    user_id, amount, description, category, date, payment_method,
                    notes, currency, group_id, bucket_id, base_currency,
                    exchange_rate, converted_amount, is_recurring, is_income
                )
                VALUES (
                    template_record.user_id,
                    template_record.amount,
                    template_record.description,
                    template_record.category,
                    process_date,
                    template_record.payment_method,
                    template_record.metadata->>'notes',
                    template_record.currency,
                    template_record.group_id,
                    (NULLIF(template_record.metadata->>'bucket_id', 'null'))::UUID,
                    template_record.currency,
                    1,
                    template_record.amount,
                    TRUE,
                    COALESCE(template_record.is_income, FALSE)
                )
                RETURNING id INTO new_transaction_id;

                -- 2. Handle Splits (income templates can't be split — skip)
                IF (template_record.metadata->>'is_split')::BOOLEAN = TRUE
                   AND COALESCE(template_record.is_income, FALSE) = FALSE THEN
                    IF template_record.group_id IS NOT NULL THEN
                        INSERT INTO splits (transaction_id, user_id, amount, is_paid)
                        SELECT
                            new_transaction_id,
                            gm.user_id,
                            template_record.amount / (SELECT count(*) FROM group_members WHERE group_id = template_record.group_id),
                            FALSE
                        FROM group_members gm
                        WHERE gm.group_id = template_record.group_id AND gm.user_id != template_record.user_id;
                    ELSE
                        friend_ids_json := template_record.metadata->'friend_ids';
                        IF friend_ids_json IS NOT NULL AND jsonb_array_length(friend_ids_json) > 0 THEN
                            split_amt := template_record.amount / (jsonb_array_length(friend_ids_json) + 1);

                            FOR debtor_id IN SELECT jsonb_array_elements_text(friend_ids_json)::UUID
                            LOOP
                                INSERT INTO splits (transaction_id, user_id, amount, is_paid)
                                VALUES (new_transaction_id, debtor_id, split_amt, FALSE);
                            END LOOP;
                        END IF;
                    END IF;
                END IF;
            END IF;

            -- Advance process_date
            IF template_record.frequency = 'daily' THEN process_date := process_date + INTERVAL '1 day';
            ELSIF template_record.frequency = 'weekly' THEN process_date := process_date + INTERVAL '7 days';
            ELSIF template_record.frequency = 'monthly' THEN process_date := (process_date + INTERVAL '1 month')::DATE;
            ELSIF template_record.frequency = 'yearly' THEN process_date := (process_date + INTERVAL '1 year')::DATE;
            ELSE EXIT;
            END IF;
        END LOOP;

        UPDATE recurring_templates
        SET next_occurrence = process_date, updated_at = NOW()
        WHERE id = template_record.id;

    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the bucket spending RPC to exclude is_income transactions
-- (income shouldn't count against any bucket's budget).
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
      AND COALESCE(t.is_income, FALSE) = FALSE
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
