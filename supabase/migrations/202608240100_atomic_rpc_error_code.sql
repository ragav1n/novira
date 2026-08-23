-- Report SQLSTATE alongside SQLERRM from create_transaction_atomic.
--
-- WHY
-- The function wraps its whole body in `EXCEPTION WHEN OTHERS THEN RETURN
-- jsonb_build_object('success', false, 'error', SQLERRM)`, so every rejection —
-- constraint violation, bad cast, missing column — reaches the client as HTTP 200
-- with no code. The offline queue could not tell that apart from "the request never
-- arrived", so it classified it transient: five retries over ~62s, and then the
-- reason overwritten with 'Max retries exceeded'. A row that could never be saved
-- reported itself as a network blip and took its explanation with it.
--
-- Adding 'code' lets the client abandon a deterministic rejection immediately and
-- show the user what Postgres actually said. The client tolerates the field's
-- absence (it falls back to a synthetic RPC_REJECTED), so this migration is an
-- improvement, not a prerequisite.
--
-- The unauthorised branch reports 42501, which the client treats as permanent. That is
-- deliberate: after 202608220100 anon has no EXECUTE, so an unauthenticated or expired
-- caller is rejected by PostgREST with 42501 or 401 *before* entering the function. The
-- only way to reach this branch from the app is a user_id that does not match the
-- session — a client bug, not something a retry fixes.
--
-- The function body below is copied forward verbatim from
-- 202608220100_secure_definer_rpcs.sql; only the two RETURN statements changed.
--
-- CREATE OR REPLACE preserves the existing ACL, but the REVOKE/GRANT block is
-- repeated at the end anyway: this function was the one an anon key could reach
-- (see 202608220100), and that fix is not worth leaving to an assumption.

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

    IF auth.uid() IS NULL OR (p_transaction->>'user_id')::UUID <> auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Cannot create transaction for another user', 'code', '42501');
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
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'code', SQLSTATE);
END;
$$;

-- Re-assert the privilege fix from 202608220100. Idempotent.
REVOKE EXECUTE ON FUNCTION public.create_transaction_atomic(JSONB, JSONB, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_transaction_atomic(JSONB, JSONB, JSONB) FROM anon;
GRANT  EXECUTE ON FUNCTION public.create_transaction_atomic(JSONB, JSONB, JSONB) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.create_transaction_atomic(JSONB, JSONB, JSONB) TO service_role;
