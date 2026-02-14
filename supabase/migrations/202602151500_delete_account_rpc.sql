-- Migration: Add prepare_delete_account RPC
-- Description: Function to clean up all user data before account deletion
-- This avoids foreign key constraint issues when deleting from auth.users

DROP FUNCTION IF EXISTS public.prepare_delete_account(uuid);

CREATE OR REPLACE FUNCTION public.prepare_delete_account(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- 1. Delete transactions where user is the owner
    -- (Splits will cascade delete from transactions)
    DELETE FROM public.transactions WHERE user_id = p_user_id;

    -- 2. Delete splits where user is involved (as a debtor)
    -- (These might not be linked to their own transactions)
    DELETE FROM public.splits WHERE user_id = p_user_id;

    -- 3. Delete group memberships
    DELETE FROM public.group_members WHERE user_id = p_user_id;

    -- 4. Delete groups created by the user
    -- (Memberships will cascade delete)
    -- (Transactions in these groups should be handled or set to null, but let's delete them to be safe/clean)
    DELETE FROM public.groups WHERE created_by = p_user_id;

    -- 5. Delete friendships
    DELETE FROM public.friendships WHERE user_id = p_user_id OR friend_id = p_user_id;

    -- 6. Delete profile (Public profile)
    DELETE FROM public.profiles WHERE id = p_user_id;
    
    -- Note: We do NOT delete from auth.users here. 
    -- That must be done via the Supabase Admin API (server-side).
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
