-- Migration: Atomic Savings Deposit Removal
-- Date: 2026-05-05
-- Mirrors add_savings_deposit_atomic so deleting a deposit and decrementing
-- the goal's current_amount happen in a single transaction with auth check.

CREATE OR REPLACE FUNCTION public.remove_savings_deposit_atomic(
    p_deposit_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_goal_id UUID;
    v_amount NUMERIC;
BEGIN
    IF p_user_id <> auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    SELECT goal_id, amount
        INTO v_goal_id, v_amount
        FROM public.savings_deposits
        WHERE id = p_deposit_id AND user_id = p_user_id
        FOR UPDATE;

    IF v_goal_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Deposit not found');
    END IF;

    DELETE FROM public.savings_deposits WHERE id = p_deposit_id;

    UPDATE public.savings_goals
        SET current_amount = GREATEST(0, current_amount - v_amount),
            updated_at = NOW()
        WHERE id = v_goal_id AND user_id = p_user_id;

    RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_savings_deposit_atomic(UUID, UUID) TO authenticated;
