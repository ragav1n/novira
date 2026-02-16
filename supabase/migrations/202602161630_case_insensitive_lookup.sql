-- Upgrade get_profile_by_email to be case-insensitive
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
    WHERE lower(profiles.email) = lower(email_input);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_profile_by_email(text) TO authenticated;
