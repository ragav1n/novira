-- RPC to settle a split and create transactions for both parties
-- This ensures that when a debt is settled, both the debtor and creditor see a record.

CREATE OR REPLACE FUNCTION settle_split(split_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator (postgres) to bypass RLS for the counterpart
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
    v_debtor_id := v_split.user_id; -- The one who owes money (Split User)
    v_creditor_id := v_split.creator_id; -- The one who paid originally (Transaction Owner)
    v_amount := v_split.amount;
    v_currency := v_split.currency;
    v_exchange_rate := v_split.exchange_rate;
    v_base_currency := v_split.base_currency;
    v_description := v_split.description;

    -- 2.1 Security Check: Ensure caller is authorized
    -- Only the Debtor (user_id) or Creditor (creator_id) can settle this split.
    IF auth.uid() <> v_debtor_id AND auth.uid() <> v_creditor_id THEN
        RAISE EXCEPTION 'Not authorized to settle this split';
    END IF;

    -- 3. Mark Split as Paid
    UPDATE public.splits SET is_paid = TRUE WHERE id = split_id;

    -- 4. Create Transaction for Debtor (Settlement Sent / Expense)
    -- "I paid Bob"
    INSERT INTO public.transactions (
        user_id, amount, description, category, date, currency, exchange_rate, base_currency
    ) VALUES (
        v_debtor_id,
        v_amount,
        'Settled: ' || v_description,
        v_split.category, -- Inherit ORIGINAL category (e.g. 'food')
        NOW(),
        v_currency,
        v_exchange_rate,
        v_base_currency
    );

    -- 5. Create Transaction for Creditor (Settlement Received / Income)
    -- "Bob paid me"
    -- We store as NEGATIVE for Income so that `totalSpent` (sum of transactions) reduces.
    INSERT INTO public.transactions (
        user_id, amount, description, category, date, currency, exchange_rate, base_currency
    ) VALUES (
        v_creditor_id,
        -v_amount, -- Negative for Income/Reimbursement
        'Settlement Received: ' || v_description,
        v_split.category, -- Inherit ORIGINAL category (e.g. 'food')
        NOW(),
        v_currency,
        v_exchange_rate,
        v_base_currency
    );

    RETURN TRUE;
END;
$$;
