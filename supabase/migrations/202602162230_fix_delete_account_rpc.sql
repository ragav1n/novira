-- Fix prepare_delete_account to handle transaction_history and recurring_templates

CREATE OR REPLACE FUNCTION public.prepare_delete_account(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- 1. Delete transactions where user is the owner
    -- (Splits will cascade delete from transactions)
    -- (Triggers will run and create transaction_history records where changed_by = p_user_id)
    DELETE FROM public.transactions WHERE user_id = p_user_id;

    -- 2. Delete splits where user is involved (as a debtor)
    DELETE FROM public.splits WHERE user_id = p_user_id;

    -- 3. Delete recurring templates
    DELETE FROM public.recurring_templates WHERE user_id = p_user_id;

    -- 4. Delete group memberships
    DELETE FROM public.group_members WHERE user_id = p_user_id;

    -- 5. Delete groups created by the user
    DELETE FROM public.groups WHERE created_by = p_user_id;

    -- 6. Delete friendships
    DELETE FROM public.friendships WHERE user_id = p_user_id OR friend_id = p_user_id;

    -- 7. Delete transaction history where user is the 'changed_by' actor
    -- This cleans up:
    -- a) History of edits made by this user on their own or others' transactions
    -- b) History created just now by step 1 (deletion of transactions)
    DELETE FROM public.transaction_history WHERE changed_by = p_user_id;

    -- 8. Delete profile (Public profile)
    DELETE FROM public.profiles WHERE id = p_user_id;
    
    -- Note: We do NOT delete from auth.users here. 
    -- That must be done via the Supabase Admin API (server-side).
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
