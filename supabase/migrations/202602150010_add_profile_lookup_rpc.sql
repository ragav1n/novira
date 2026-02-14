-- Create a secure function to look up a user by email
-- This is needed because RLS prevents users from querying the profiles table directly for non-friends.
-- SECURITY DEFINER allows this function to bypass RLS, but we restrict it to ONLY looking up by exact email.

CREATE OR REPLACE FUNCTION public.get_profile_by_email(email_input text)
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
    -- We join with auth.users to ensure the email is valid and belongs to the user
    -- effectively using the 'email' column we synced to profiles or by checking auth.users if needed
    -- Since we synced email to profiles in an earlier migration, we can query profiles directly
    WHERE profiles.email = email_input;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_profile_by_email(text) TO authenticated;
