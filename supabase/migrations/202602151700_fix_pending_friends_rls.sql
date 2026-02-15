-- Allow viewing profiles for pending friend requests
DROP POLICY IF EXISTS "Users can view relevant profiles" ON profiles;

CREATE POLICY "Users can view relevant profiles" 
ON profiles FOR SELECT 
USING (
    -- 1. Own profile
    auth.uid() = profiles.id 
    
    OR 
    
    -- 2. Friends (Accepted OR Pending)
    -- We need to see the profile of someone who sent us a request, or someone we sent a request to.
    EXISTS (
        SELECT 1 FROM friendships 
        WHERE (friendships.user_id = auth.uid() AND friendships.friend_id = profiles.id) 
           OR (friendships.friend_id = auth.uid() AND friendships.user_id = profiles.id)
        -- We removed the 'status = accepted' check to allow pending requests too.
        -- This is safe because users can only create a friendship record via 'addFriendByEmail' which verifies email first.
    )
    
    OR 
    
    -- 3. Group Members (Shared Groups)
    EXISTS (
        SELECT 1 FROM group_members gm1
        JOIN group_members gm2 ON gm1.group_id = gm2.group_id
        WHERE gm1.user_id = auth.uid() AND gm2.user_id = profiles.id
    )
    
    OR 
    
    -- 4. Transaction Counterparts
    EXISTS (
        SELECT 1 FROM transactions t
        JOIN splits s ON s.transaction_id = t.id
        WHERE (t.user_id = auth.uid() AND s.user_id = profiles.id)
            OR (s.user_id = auth.uid() AND t.user_id = profiles.id)
    )
);
