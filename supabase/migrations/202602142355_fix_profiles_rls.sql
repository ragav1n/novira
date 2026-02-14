-- Fix RLS Policies for Profiles
-- The security hardening migration was too restrictive. This allows viewing profiles of friends, group members, and transaction counterparts.

-- Drop the restrictive policy (if it exists)
DROP POLICY IF EXISTS "Users can only view their own profile." ON profiles;
DROP POLICY IF EXISTS "Users can view relevant profiles" ON profiles;

-- Create a new, broader policy
CREATE POLICY "Users can view relevant profiles" 
ON profiles FOR SELECT 
USING (
    -- 1. Own profile
    auth.uid() = profiles.id 
    
    OR 
    
    -- 2. Friends
    EXISTS (
        SELECT 1 FROM friendships 
        WHERE (friendships.user_id = auth.uid() AND friendships.friend_id = profiles.id) 
           OR (friendships.friend_id = auth.uid() AND friendships.user_id = profiles.id)
        AND friendships.status = 'accepted'
    )
    
    OR 
    
    -- 3. Group Members (Shared Groups)
    EXISTS (
        SELECT 1 FROM group_members gm1
        JOIN group_members gm2 ON gm1.group_id = gm2.group_id
        WHERE gm1.user_id = auth.uid() AND gm2.user_id = profiles.id
    )
    
    OR 
    
    -- 4. Transaction Counterparts (people involved in splits with you)
    EXISTS (
         SELECT 1 FROM transactions t
         JOIN splits s ON s.transaction_id = t.id
         WHERE (t.user_id = auth.uid() AND s.user_id = profiles.id)
            OR (s.user_id = auth.uid() AND t.user_id = profiles.id)
    )
);
