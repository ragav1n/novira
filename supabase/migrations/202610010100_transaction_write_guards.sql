-- Server-side guards on everything create_transaction_atomic (and a direct
-- PostgREST write) can attach to a transaction: splits, group, bucket, account,
-- and the recurring template.
--
-- WHY
-- create_transaction_atomic is SECURITY DEFINER, so RLS does not apply inside it,
-- and the only thing it checked was `p_transaction.user_id = auth.uid()`. Everything
-- else in the payload was trusted:
--
--   * p_recurring.user_id — any value. A caller could create a backdated *daily*
--     template owned by someone else; the victim's next app load runs
--     process_recurring_transactions and backfills one row per day since the
--     forged start date (~2,100 rows for a 2020 date).
--   * p_splits — any user_id, any amount, any is_paid. Charging a stranger works
--     (and notify-split then pushes them about it); so does inserting a split
--     already marked paid, or splits summing to more than the expense.
--   * group_id — any group. The row then appears in that group's feed for every
--     member, because the transactions SELECT policy admits group members.
--   * bucket_id — any bucket.
--   * the idempotency lookup matched on the key alone, so a caller who learned
--     another user's key got that user's transaction back as `data`.
--
-- The direct-write paths had the same gaps: the splits INSERT policy only checks
-- that the caller owns the parent transaction, and the transactions and
-- recurring_templates policies only check user_id.
--
-- WHAT
--   1. can_split_on(tx, debtor) — the one definition of "may this payer charge
--      this person": an accepted friend, or a fellow member of the transaction's
--      group. Used by the RPC, the splits INSERT policy, and the recurring
--      processor (202610010200).
--   2. A BEFORE trigger on transactions rejecting a group the writer is not a
--      member of, a bucket they cannot see, or an account they do not own. It
--      only checks a reference when it is set or *changed*, so an old row in a
--      group the user has since left is still editable.
--   3. The same for recurring_templates (group and account).
--   4. recurring_templates.account_id (audit #17) — recurring posts went to the
--      primary account because the template had nowhere to keep the choice.
--   5. create_transaction_atomic: idempotency scoped to the caller; the recurring
--      template's user_id must be the caller (absent is filled in); splits are
--      checked with can_split_on, must be positive, distinct, sum to no more than
--      the expense, and are always inserted unpaid; recurring account_id is
--      honoured only for an account the caller owns. Rejections RAISE with a
--      SQLSTATE so the existing catch-all reports `code` (42501 for authorisation,
--      22023 for a malformed split).
--   6. splits UPDATE: the debtor could PATCH their own row to `amount: 0` or
--      `is_paid: true` directly — no column limit and no WITH CHECK. Nothing in the
--      client updates splits directly (settling goes through settle_split, which is
--      SECURITY DEFINER and unaffected), so UPDATE is now creditor-only and limited
--      to the is_paid column.
--   7. Receipts on split expenses: the transactions UPDATE policy refuses any row
--      that has splits, so attaching a receipt to a split expense updated 0 rows
--      and reported success. A second permissive policy admits the owner, and an
--      AFTER trigger allows only receipt_path (and account_id — the payer's own
--      bookkeeping, which the bulk "assign by payment method" sweep touches) to
--      change on a row with splits — the payer still cannot rewrite an expense
--      other people owe against.
--
-- Function bodies of create_transaction_atomic are copied forward from
-- 202608240100_atomic_rpc_error_code.sql; only the guard block, the idempotency
-- WHERE, the split INSERT and the recurring INSERT changed.
--
-- Client contract: p_recurring may carry a top-level `account_id`. Before this
-- migration is applied the old function simply ignores the key (it reads named keys
-- only), so the client can ship first.

-- ─── 1. Who may a payer split with ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.can_split_on(p_transaction_id UUID, p_debtor UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.transactions t
        WHERE t.id = p_transaction_id
          AND t.user_id = auth.uid()
          AND p_debtor IS NOT NULL
          AND p_debtor <> t.user_id
          AND (
                (t.group_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.group_members gm
                    WHERE gm.group_id = t.group_id AND gm.user_id = p_debtor
                ))
             OR EXISTS (
                    SELECT 1 FROM public.friendships f
                    WHERE f.status = 'accepted'
                      AND (   (f.user_id = t.user_id AND f.friend_id = p_debtor)
                           OR (f.user_id = p_debtor  AND f.friend_id = t.user_id))
                )
          )
    );
$$;

REVOKE EXECUTE ON FUNCTION public.can_split_on(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_split_on(UUID, UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.can_split_on(UUID, UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.can_split_on(UUID, UUID) TO service_role;

-- ─── 2. Reference checks on transactions ─────────────────────────────────────
--
-- Skipped when auth.uid() is NULL (service-role server code and crons) and when
-- fired from inside another trigger (FK cascades such as delete_group's
-- ON DELETE SET NULL).

CREATE OR REPLACE FUNCTION public.transactions_validate_refs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL OR pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    IF NEW.group_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.group_id IS DISTINCT FROM OLD.group_id)
       AND NOT public.is_group_member(NEW.group_id, NEW.user_id) THEN
        RAISE EXCEPTION 'Not a member of this group' USING ERRCODE = '42501';
    END IF;

    IF NEW.bucket_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.bucket_id IS DISTINCT FROM OLD.bucket_id)
       AND NOT EXISTS (
            SELECT 1 FROM public.buckets b
            WHERE b.id = NEW.bucket_id
              AND (b.user_id = NEW.user_id
                   OR (b.group_id IS NOT NULL AND public.is_group_member(b.group_id, NEW.user_id)))
       ) THEN
        RAISE EXCEPTION 'Bucket not available to this user' USING ERRCODE = '42501';
    END IF;

    IF NEW.account_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.account_id IS DISTINCT FROM OLD.account_id)
       AND NOT EXISTS (
            SELECT 1 FROM public.accounts a
            WHERE a.id = NEW.account_id AND a.user_id = NEW.user_id
       ) THEN
        RAISE EXCEPTION 'Account not owned by this user' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_validate_refs ON public.transactions;
CREATE TRIGGER transactions_validate_refs
    BEFORE INSERT OR UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.transactions_validate_refs();

-- ─── 3 & 4. recurring_templates.account_id and reference checks ──────────────

ALTER TABLE public.recurring_templates
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.recurring_templates_validate_refs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL OR pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    IF NEW.group_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.group_id IS DISTINCT FROM OLD.group_id)
       AND NOT public.is_group_member(NEW.group_id, NEW.user_id) THEN
        RAISE EXCEPTION 'Not a member of this group' USING ERRCODE = '42501';
    END IF;

    IF NEW.account_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.account_id IS DISTINCT FROM OLD.account_id)
       AND NOT EXISTS (
            SELECT 1 FROM public.accounts a
            WHERE a.id = NEW.account_id AND a.user_id = NEW.user_id
       ) THEN
        RAISE EXCEPTION 'Account not owned by this user' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recurring_templates_validate_refs ON public.recurring_templates;
CREATE TRIGGER recurring_templates_validate_refs
    BEFORE INSERT OR UPDATE ON public.recurring_templates
    FOR EACH ROW EXECUTE FUNCTION public.recurring_templates_validate_refs();

-- ─── 5. create_transaction_atomic ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_transaction_atomic(
    p_transaction JSONB,
    p_splits      JSONB DEFAULT NULL,
    p_recurring   JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_transaction_id  UUID;
    v_result          JSONB;
    v_idempotency_key UUID;
    v_tags            TEXT[];
    v_account_id      UUID;
    v_recurring_account_id UUID;
    v_amount          NUMERIC;
    v_split_count     INT;
    v_split_distinct  INT;
    v_split_sum       NUMERIC;
    v_split_positive  BOOLEAN;
    v_split_allowed   BOOLEAN;
BEGIN
    v_idempotency_key := (p_transaction->>'idempotency_key')::UUID;

    IF auth.uid() IS NULL OR (p_transaction->>'user_id')::UUID IS DISTINCT FROM auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Cannot create transaction for another user', 'code', '42501');
    END IF;

    IF p_recurring IS NOT NULL
       AND p_recurring ? 'user_id'
       AND (p_recurring->>'user_id')::UUID IS DISTINCT FROM auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Cannot create a recurring template for another user', 'code', '42501');
    END IF;

    IF v_idempotency_key IS NOT NULL THEN
        SELECT jsonb_build_object('success', true, 'data', to_jsonb(t.*), 'idempotent', true)
        INTO v_result
        FROM public.transactions t
        WHERE t.idempotency_key = v_idempotency_key
          AND t.user_id = auth.uid();

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

    -- Only honour an account the caller actually owns.
    SELECT a.id INTO v_account_id
    FROM public.accounts a
    WHERE a.id = (p_transaction->>'account_id')::UUID
      AND a.user_id = auth.uid();

    v_amount := (p_transaction->>'amount')::NUMERIC;

    -- group_id / bucket_id membership is enforced by transactions_validate_refs,
    -- which raises 42501 into the handler below.
    INSERT INTO public.transactions (
        user_id, description, amount, category, date,
        payment_method, notes, currency, group_id,
        bucket_id, account_id, exchange_rate, base_currency,
        converted_amount, is_recurring, is_income, exclude_from_allowance,
        place_name, place_address, place_lat, place_lng,
        tags, idempotency_key
    ) VALUES (
        auth.uid(),
        (p_transaction->>'description'),
        v_amount,
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

    IF p_splits IS NOT NULL AND jsonb_typeof(p_splits) = 'array' AND jsonb_array_length(p_splits) > 0 THEN
        -- bool_and ignores NULLs, so every predicate is COALESCEd to FALSE: a
        -- missing user_id or amount must fail the check, not drop out of it.
        SELECT count(*),
               count(DISTINCT (s->>'user_id')::UUID),
               COALESCE(sum((s->>'amount')::NUMERIC), 0),
               bool_and(COALESCE((s->>'amount')::NUMERIC > 0, FALSE)),
               bool_and(COALESCE(public.can_split_on(v_transaction_id, (s->>'user_id')::UUID), FALSE))
        INTO v_split_count, v_split_distinct, v_split_sum, v_split_positive, v_split_allowed
        FROM jsonb_array_elements(p_splits) AS s;

        IF NOT v_split_allowed THEN
            RAISE EXCEPTION 'Splits can only be with accepted friends or members of the group'
                USING ERRCODE = '42501';
        END IF;

        -- One cent of slack for client-side rounding of an even split.
        IF v_split_distinct <> v_split_count
           OR NOT v_split_positive
           OR v_split_sum > v_amount + 0.01 THEN
            RAISE EXCEPTION 'Invalid split amounts' USING ERRCODE = '22023';
        END IF;

        INSERT INTO public.splits (transaction_id, user_id, amount, is_paid)
        SELECT
            v_transaction_id,
            (s->>'user_id')::UUID,
            (s->>'amount')::NUMERIC,
            FALSE
        FROM jsonb_array_elements(p_splits) AS s;
    END IF;

    IF p_recurring IS NOT NULL THEN
        SELECT a.id INTO v_recurring_account_id
        FROM public.accounts a
        WHERE a.id = (p_recurring->>'account_id')::UUID
          AND a.user_id = auth.uid();

        INSERT INTO public.recurring_templates (
            user_id, description, amount, category, currency,
            group_id, payment_method, frequency, next_occurrence,
            exclude_from_allowance, intended_day, is_income, account_id, metadata
        ) VALUES (
            auth.uid(),
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
            v_recurring_account_id,
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

REVOKE EXECUTE ON FUNCTION public.create_transaction_atomic(JSONB, JSONB, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_transaction_atomic(JSONB, JSONB, JSONB) FROM anon;
GRANT  EXECUTE ON FUNCTION public.create_transaction_atomic(JSONB, JSONB, JSONB) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.create_transaction_atomic(JSONB, JSONB, JSONB) TO service_role;

-- ─── Direct split inserts get the same rule ─────────────────────────────────

DROP POLICY IF EXISTS "Transaction creators can insert splits" ON public.splits;
CREATE POLICY "Transaction creators can insert splits" ON public.splits FOR INSERT
WITH CHECK (
    public.get_transaction_user_id(transaction_id) = auth.uid()
    AND public.can_split_on(transaction_id, user_id)
    AND amount > 0
    AND is_paid = FALSE
);

-- ─── 6. splits UPDATE: creditor only, is_paid only ───────────────────────────

DROP POLICY IF EXISTS "Users can update relevant splits" ON public.splits;
DROP POLICY IF EXISTS "Creditors can update their splits" ON public.splits;
CREATE POLICY "Creditors can update their splits" ON public.splits FOR UPDATE
USING      (public.get_transaction_user_id(transaction_id) = auth.uid())
WITH CHECK (public.get_transaction_user_id(transaction_id) = auth.uid());

REVOKE UPDATE ON public.splits FROM anon, authenticated;
GRANT  UPDATE (is_paid) ON public.splits TO authenticated;

-- ─── 7. Receipts on split expenses ───────────────────────────────────────────

DROP POLICY IF EXISTS "Owners can attach receipts to split transactions" ON public.transactions;
CREATE POLICY "Owners can attach receipts to split transactions" ON public.transactions FOR UPDATE
USING      (auth.uid() = user_id AND is_settlement = FALSE)
WITH CHECK (auth.uid() = user_id AND is_settlement = FALSE);

-- AFTER rather than BEFORE so to_jsonb sees the final row (generated or
-- trigger-set columns are not settled yet in a BEFORE trigger).
CREATE OR REPLACE FUNCTION public.transactions_split_row_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF auth.uid() IS NULL OR pg_trigger_depth() > 1 THEN
        RETURN NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM public.splits s WHERE s.transaction_id = OLD.id)
       AND (to_jsonb(NEW) - 'receipt_path' - 'account_id' - 'updated_at')
           IS DISTINCT FROM (to_jsonb(OLD) - 'receipt_path' - 'account_id' - 'updated_at') THEN
        RAISE EXCEPTION 'Only the receipt can be changed on a split expense'
            USING ERRCODE = '42501';
    END IF;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS transactions_split_row_guard ON public.transactions;
CREATE TRIGGER transactions_split_row_guard
    AFTER UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.transactions_split_row_guard();

