-- Migration: Atomic Savings Deposits
-- Date: 2026-03-11

CREATE OR REPLACE FUNCTION public.add_savings_deposit_atomic(
    p_goal_id UUID,
    p_user_id UUID,
    p_amount NUMERIC,
    p_currency TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Security Check: Ensure authenticated user is depositing for themselves
    IF p_user_id <> auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Cannot add deposit for another user');
    END IF;

    -- 1. Insert Deposit
    INSERT INTO public.savings_deposits (goal_id, user_id, amount, currency)
    VALUES (p_goal_id, p_user_id, p_amount, p_currency);

    -- 2. Update Goal current_amount
    UPDATE public.savings_goals
    SET current_amount = current_amount + p_amount,
        updated_at = NOW()
    WHERE id = p_goal_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Goal not found or unauthorized';
    END IF;

    RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
