-- Migration: Add idempotency_key and Atomic Transaction RPC
-- Date: 2026-03-11

-- 1. Add idempotency_key to transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS idempotency_key UUID UNIQUE;

-- 2. Create Atomic Transaction RPC
CREATE OR REPLACE FUNCTION public.create_transaction_atomic(
    p_transaction JSONB,
    p_splits JSONB DEFAULT NULL,
    p_recurring JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transaction_id UUID;
    v_result JSONB;
    v_idempotency_key UUID;
BEGIN
    -- Extract idempotency key
    v_idempotency_key := (p_transaction->>'idempotency_key')::UUID;

    -- Security Check: Ensure authenticated user is creating for themselves
    IF (p_transaction->>'user_id')::UUID <> auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Cannot create transaction for another user');
    END IF;

    -- Idempotency Check: If key exists, return existing transaction
    IF v_idempotency_key IS NOT NULL THEN
        SELECT jsonb_build_object('success', true, 'data', to_jsonb(t.*), 'idempotent', true)
        INTO v_result
        FROM public.transactions t
        WHERE t.idempotency_key = v_idempotency_key;

        IF v_result IS NOT NULL THEN
            RETURN v_result;
        END IF;
    END IF;

    -- 1. Insert Transaction
    INSERT INTO public.transactions (
        user_id, description, amount, category, date, 
        payment_method, notes, currency, group_id, 
        bucket_id, exchange_rate, base_currency, 
        converted_amount, is_recurring, exclude_from_allowance,
        place_name, place_address, place_lat, place_lng,
        idempotency_key
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
        v_idempotency_key
    )
    RETURNING id INTO v_transaction_id;

    -- 2. Insert Splits (if provided)
    IF p_splits IS NOT NULL AND jsonb_array_length(p_splits) > 0 THEN
        INSERT INTO public.splits (transaction_id, user_id, amount, is_paid)
        SELECT 
            v_transaction_id,
            (s->>'user_id')::UUID,
            (s->>'amount')::NUMERIC,
            COALESCE((s->>'is_paid')::BOOLEAN, FALSE)
        FROM jsonb_array_elements(p_splits) AS s;
    END IF;

    -- 3. Insert Recurring Template (if provided)
    IF p_recurring IS NOT NULL THEN
        INSERT INTO public.recurring_templates (
            user_id, description, amount, category, currency,
            group_id, payment_method, frequency, next_occurrence,
            exclude_from_allowance, metadata
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
            COALESCE(p_recurring->'metadata', '{}'::JSONB)
        );
    END IF;

    -- Fetch and return the newly created transaction
    SELECT jsonb_build_object('success', true, 'data', to_jsonb(t.*), 'idempotent', false)
    INTO v_result
    FROM public.transactions t
    WHERE t.id = v_transaction_id;

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
