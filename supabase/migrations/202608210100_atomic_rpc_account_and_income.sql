-- Migration: persist account_id and is_income in create_transaction_atomic
-- Date: 2026-08-21
--
-- create_transaction_atomic was last revised on 2026-05-03. `is_income` arrived
-- on 2026-05-07 (202605070100_recurring_income.sql) and `account_id` on
-- 2026-05-13 (202605131700_accounts.sql). Neither was ever added to the INSERT,
-- and every add-expense write goes through this RPC, so both were silently
-- dropped on every save:
--
--   * Choosing an account in the form did nothing. The row inserted with
--     account_id = NULL, and the transactions_default_account BEFORE INSERT
--     trigger then force-assigned the user's *primary* account. That trigger's
--     own comment says "until the add-expense form wires it explicitly" — the
--     form does now, but the RPC discarded it before the trigger ever saw it.
--     Filtering by any non-primary account therefore showed nothing.
--
--   * Marking an entry as Income saved it as an expense, inflating totalSpent,
--     the run-rate projection and every bucket/allowance figure. The template
--     lost the flag too, so each auto-posted month was an expense as well.
--
-- Otherwise identical to the 2026-05-03 definition.
--
-- account_id is accepted only when it belongs to the caller. This function is
-- SECURITY DEFINER, so RLS does not vet a client-supplied foreign key here; an
-- id belonging to someone else falls back to NULL and lets the trigger assign
-- the caller's primary account, rather than filing the row against a stranger.

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
    v_account_id      UUID;
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

    -- Only honour an account the caller actually owns; see header note.
    SELECT a.id INTO v_account_id
    FROM public.accounts a
    WHERE a.id = (p_transaction->>'account_id')::UUID
      AND a.user_id = auth.uid();

    INSERT INTO public.transactions (
        user_id, description, amount, category, date,
        payment_method, notes, currency, group_id,
        bucket_id, account_id, exchange_rate, base_currency,
        converted_amount, is_recurring, is_income, exclude_from_allowance,
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
        v_account_id,
        (p_transaction->>'exchange_rate')::NUMERIC,
        p_transaction->>'base_currency',
        (p_transaction->>'converted_amount')::NUMERIC,
        COALESCE((p_transaction->>'is_recurring')::BOOLEAN, FALSE),
        COALESCE((p_transaction->>'is_income')::BOOLEAN, FALSE),
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
        -- recurring_templates has no account_id column, so only is_income is new here.
        INSERT INTO public.recurring_templates (
            user_id, description, amount, category, currency,
            group_id, payment_method, frequency, next_occurrence,
            exclude_from_allowance, intended_day, is_income, metadata
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
            COALESCE((p_recurring->>'is_income')::BOOLEAN, FALSE),
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
