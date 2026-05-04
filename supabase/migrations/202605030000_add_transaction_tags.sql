-- Migration: Add user-defined tags to transactions
-- Date: 2026-05-03
--
-- Tags are free-form labels (e.g. "vacation", "work", "tax-deductible") that
-- complement categories and buckets. Stored as text[] with a GIN index so
-- containment queries (`@>`, `&&`) stay fast.

-- ─── 1. Schema ────────────────────────────────────────────────────────────────
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS transactions_tags_idx
    ON public.transactions USING GIN (tags);

-- ─── 2. Update create_transaction_atomic to persist tags ──────────────────────
CREATE OR REPLACE FUNCTION public.create_transaction_atomic(
    p_transaction JSONB,
    p_splits      JSONB DEFAULT NULL,
    p_recurring   JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transaction_id  UUID;
    v_result          JSONB;
    v_idempotency_key UUID;
    v_tags            TEXT[];
BEGIN
    v_idempotency_key := (p_transaction->>'idempotency_key')::UUID;

    IF (p_transaction->>'user_id')::UUID <> auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Cannot create transaction for another user');
    END IF;

    IF v_idempotency_key IS NOT NULL THEN
        SELECT jsonb_build_object('success', true, 'data', to_jsonb(t.*), 'idempotent', true)
        INTO v_result
        FROM public.transactions t
        WHERE t.idempotency_key = v_idempotency_key;

        IF v_result IS NOT NULL THEN
            RETURN v_result;
        END IF;
    END IF;

    -- Coerce the tags JSON array to text[] (default to empty array).
    IF p_transaction ? 'tags' AND jsonb_typeof(p_transaction->'tags') = 'array' THEN
        SELECT array_agg(value ORDER BY ord)
        INTO v_tags
        FROM jsonb_array_elements_text(p_transaction->'tags') WITH ORDINALITY t(value, ord)
        WHERE value IS NOT NULL AND length(trim(value)) > 0;
    END IF;

    INSERT INTO public.transactions (
        user_id, description, amount, category, date,
        payment_method, notes, currency, group_id,
        bucket_id, exchange_rate, base_currency,
        converted_amount, is_recurring, exclude_from_allowance,
        place_name, place_address, place_lat, place_lng,
        tags, idempotency_key
    ) VALUES (
        (p_transaction->>'user_id')::UUID,
        (p_transaction->>'description'),
        (p_transaction->>'amount')::NUMERIC,
        (p_transaction->>'category'),
        (p_transaction->>'date')::DATE,
        COALESCE(p_transaction->>'payment_method', 'Cash'),
        p_transaction->>'notes',
        p_transaction->>'currency',
        (p_transaction->>'group_id')::UUID,
        (p_transaction->>'bucket_id')::UUID,
        (p_transaction->>'exchange_rate')::NUMERIC,
        p_transaction->>'base_currency',
        (p_transaction->>'converted_amount')::NUMERIC,
        COALESCE((p_transaction->>'is_recurring')::BOOLEAN, FALSE),
        COALESCE((p_transaction->>'exclude_from_allowance')::BOOLEAN, FALSE),
        p_transaction->>'place_name',
        p_transaction->>'place_address',
        (p_transaction->>'place_lat')::NUMERIC,
        (p_transaction->>'place_lng')::NUMERIC,
        COALESCE(v_tags, '{}'::TEXT[]),
        v_idempotency_key
    )
    RETURNING id INTO v_transaction_id;

    IF p_splits IS NOT NULL AND jsonb_array_length(p_splits) > 0 THEN
        INSERT INTO public.splits (transaction_id, user_id, amount, is_paid)
        SELECT
            v_transaction_id,
            (s->>'user_id')::UUID,
            (s->>'amount')::NUMERIC,
            COALESCE((s->>'is_paid')::BOOLEAN, FALSE)
        FROM jsonb_array_elements(p_splits) AS s;
    END IF;

    IF p_recurring IS NOT NULL THEN
        INSERT INTO public.recurring_templates (
            user_id, description, amount, category, currency,
            group_id, payment_method, frequency, next_occurrence,
            exclude_from_allowance, intended_day, metadata
        ) VALUES (
            (p_recurring->>'user_id')::UUID,
            (p_recurring->>'description'),
            (p_recurring->>'amount')::NUMERIC,
            (p_recurring->>'category'),
            (p_recurring->>'currency'),
            (p_recurring->>'group_id')::UUID,
            COALESCE(p_recurring->>'payment_method', 'Cash'),
            (p_recurring->>'frequency')::TEXT,
            (p_recurring->>'next_occurrence')::DATE,
            COALESCE((p_recurring->>'exclude_from_allowance')::BOOLEAN, FALSE),
            (p_recurring->>'intended_day')::SMALLINT,
            COALESCE(p_recurring->'metadata', '{}'::JSONB)
        );
    END IF;

    SELECT jsonb_build_object('success', true, 'data', to_jsonb(t.*), 'idempotent', false)
    INTO v_result
    FROM public.transactions t
    WHERE t.id = v_transaction_id;

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ─── 3. Propagate tags from recurring metadata ────────────────────────────────
-- Recurring templates store tags inside their JSONB metadata so we don't have
-- to add yet another column. process_recurring_transactions copies them onto
-- each generated row.
CREATE OR REPLACE FUNCTION process_recurring_transactions(user_id_input UUID)
RETURNS VOID AS $$
DECLARE
    template_record   RECORD;
    new_transaction_id UUID;
    process_date      DATE;
    debtor_id         UUID;
    split_amt         NUMERIC;
    friend_ids_json   JSONB;
    next_month_start  DATE;
    days_in_next_month INT;
    target_day        INT;
    template_tags     TEXT[];
BEGIN
    FOR template_record IN
        SELECT * FROM recurring_templates
        WHERE user_id = user_id_input AND is_active = TRUE AND next_occurrence <= CURRENT_DATE
        FOR UPDATE
    LOOP
        process_date := template_record.next_occurrence;

        -- Tags from template metadata, if any.
        template_tags := '{}'::TEXT[];
        IF template_record.metadata ? 'tags'
           AND jsonb_typeof(template_record.metadata->'tags') = 'array' THEN
            SELECT array_agg(value)
            INTO template_tags
            FROM jsonb_array_elements_text(template_record.metadata->'tags') AS value
            WHERE value IS NOT NULL AND length(trim(value)) > 0;
            template_tags := COALESCE(template_tags, '{}'::TEXT[]);
        END IF;

        WHILE process_date <= CURRENT_DATE LOOP

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
                    exchange_rate, converted_amount, is_recurring,
                    place_name, place_address, place_lat, place_lng, tags
                ) VALUES (
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
                    NULLIF(template_record.metadata->>'place_name', ''),
                    NULLIF(template_record.metadata->>'place_address', ''),
                    (NULLIF(template_record.metadata->>'place_lat', ''))::NUMERIC,
                    (NULLIF(template_record.metadata->>'place_lng', ''))::NUMERIC,
                    template_tags
                )
                RETURNING id INTO new_transaction_id;

                IF (template_record.metadata->>'is_split')::BOOLEAN = TRUE THEN
                    IF template_record.group_id IS NOT NULL THEN
                        INSERT INTO splits (transaction_id, user_id, amount, is_paid)
                        SELECT
                            new_transaction_id,
                            gm.user_id,
                            template_record.amount / (
                                SELECT count(*) FROM group_members WHERE group_id = template_record.group_id
                            ),
                            FALSE
                        FROM group_members gm
                        WHERE gm.group_id = template_record.group_id
                          AND gm.user_id <> template_record.user_id;
                    ELSE
                        friend_ids_json := template_record.metadata->'friend_ids';
                        IF friend_ids_json IS NOT NULL AND jsonb_array_length(friend_ids_json) > 0 THEN
                            split_amt := template_record.amount / (jsonb_array_length(friend_ids_json) + 1);
                            FOR debtor_id IN
                                SELECT jsonb_array_elements_text(friend_ids_json)::UUID
                            LOOP
                                INSERT INTO splits (transaction_id, user_id, amount, is_paid)
                                VALUES (new_transaction_id, debtor_id, split_amt, FALSE);
                            END LOOP;
                        END IF;
                    END IF;
                END IF;
            END IF;

            IF template_record.frequency = 'daily' THEN
                process_date := process_date + INTERVAL '1 day';
            ELSIF template_record.frequency = 'weekly' THEN
                process_date := process_date + INTERVAL '7 days';
            ELSIF template_record.frequency = 'monthly' THEN
                next_month_start   := date_trunc('month', process_date + INTERVAL '1 month')::DATE;
                days_in_next_month := EXTRACT(DAY FROM (next_month_start + INTERVAL '1 month' - INTERVAL '1 day'))::INT;
                target_day         := LEAST(
                    COALESCE(template_record.intended_day, EXTRACT(DAY FROM process_date)::INT),
                    days_in_next_month
                );
                process_date := (next_month_start + (target_day - 1) * INTERVAL '1 day')::DATE;
            ELSIF template_record.frequency = 'yearly' THEN
                process_date := (process_date + INTERVAL '1 year')::DATE;
            ELSE
                EXIT;
            END IF;

        END LOOP;

        UPDATE recurring_templates
        SET next_occurrence = process_date, updated_at = NOW()
        WHERE id = template_record.id;

    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
