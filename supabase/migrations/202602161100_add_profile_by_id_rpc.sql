-- Create a secure function to look up a user by ID
-- This is needed because RLS prevents users from querying the profiles table directly for non-friends.
-- SECURITY DEFINER allows this function to bypass RLS.

CREATE OR REPLACE FUNCTION public.get_profile_by_id(user_id_input uuid)
RETURNS TABLE (
    id uuid,
    full_name text,
    avatar_url text
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        profiles.id, 
        profiles.full_name, 
        profiles.avatar_url
    FROM profiles
    WHERE profiles.id = user_id_input;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_profile_by_id(uuid) TO authenticated;
