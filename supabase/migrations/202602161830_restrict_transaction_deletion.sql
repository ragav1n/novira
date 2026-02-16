-- Migration to restrict deletion of split and settlement transactions
-- 1. Add is_settlement column
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS is_settlement BOOLEAN DEFAULT FALSE;

-- 2. Update settle_split RPC to set is_settlement = TRUE
CREATE OR REPLACE FUNCTION settle_split(split_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_split RECORD;
    v_transaction RECORD;
    v_debtor_id UUID;
    v_creditor_id UUID;
    v_amount NUMERIC;
    v_currency TEXT;
    v_exchange_rate NUMERIC;
    v_base_currency TEXT;
    v_description TEXT;
BEGIN
    -- 1. Fetch Split and Transaction Details
    SELECT s.*, t.user_id as creator_id, t.description, t.category, t.currency, t.exchange_rate, t.base_currency
    INTO v_split
    FROM public.splits s
    JOIN public.transactions t ON s.transaction_id = t.id
    WHERE s.id = split_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Split not found';
    END IF;

    IF v_split.is_paid THEN
        RETURN TRUE; -- Already paid
    END IF;

    -- 2. Identify Parties
    v_debtor_id := v_split.user_id;
    v_creditor_id := v_split.creator_id;
    v_amount := v_split.amount;
    v_currency := v_split.currency;
    v_exchange_rate := v_split.exchange_rate;
    v_base_currency := v_split.base_currency;
    v_description := v_split.description;

    IF auth.uid() <> v_debtor_id AND auth.uid() <> v_creditor_id THEN
        RAISE EXCEPTION 'Not authorized to settle this split';
    END IF;

    -- 3. Mark Split as Paid
    UPDATE public.splits SET is_paid = TRUE WHERE id = split_id;

    -- 4. Create Transaction for Debtor (Settlement Sent)
    INSERT INTO public.transactions (
        user_id, amount, description, category, date, currency, exchange_rate, base_currency, is_settlement
    ) VALUES (
        v_debtor_id,
        v_amount,
        'Settled: ' || v_description,
        v_split.category,
        NOW(),
        v_currency,
        v_exchange_rate,
        v_base_currency,
        TRUE -- Mark as settlement
    );

    -- 5. Create Transaction for Creditor (Settlement Received)
    INSERT INTO public.transactions (
        user_id, amount, description, category, date, currency, exchange_rate, base_currency, is_settlement
    ) VALUES (
        v_creditor_id,
        -v_amount,
        'Settlement Received: ' || v_description,
        v_split.category,
        NOW(),
        v_currency,
        v_exchange_rate,
        v_base_currency,
        TRUE -- Mark as settlement
    );

    RETURN TRUE;
END;
$$;

-- 3. Update RLS Policies to prevent deletion of split/settlement transactions
DROP POLICY IF EXISTS "Users can delete their own transactions" ON transactions;

CREATE POLICY "Users can delete their own non-split non-settlement transactions"
ON transactions FOR DELETE
USING (
    auth.uid() = user_id 
    AND is_settlement = FALSE 
    AND NOT EXISTS (
        SELECT 1 FROM splits WHERE transaction_id = transactions.id
    )
);

-- Also restrict updates on these sensitive transactions
DROP POLICY IF EXISTS "Users can update their own transactions" ON transactions;

CREATE POLICY "Users can update their own non-split non-settlement transactions"
ON transactions FOR UPDATE
USING (
    auth.uid() = user_id 
    AND is_settlement = FALSE 
    AND NOT EXISTS (
        SELECT 1 FROM splits WHERE transaction_id = transactions.id
    )
)
WITH CHECK (
    auth.uid() = user_id 
    AND is_settlement = FALSE 
);

-- 4. Add check constraint to ensure regular expenses are positive
-- is_settlement = TRUE allows negative (income) or positive (expense) amounts
-- is_settlement = FALSE strictly enforces amount > 0
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS positive_amount_check;
ALTER TABLE public.transactions ADD CONSTRAINT positive_amount_check 
CHECK (is_settlement = TRUE OR amount > 0);
