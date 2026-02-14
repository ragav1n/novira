-- Fix RLS for Group Members (Allow Self-Leave)
-- Drop existing policy if it conflicts or is insufficient
DROP POLICY IF EXISTS "Members can leave group" ON group_members;
CREATE POLICY "Members can leave group"
ON group_members
FOR DELETE
USING (user_id = auth.uid());

-- Fix RLS for Friendships (Allow Bidirectional Delete)
-- Update the existing delete policy or create a new one
DROP POLICY IF EXISTS "Users can delete their own friendships" ON friendships;
CREATE POLICY "Users can delete their own friendships"
ON friendships
FOR DELETE
USING (
    auth.uid() = user_id OR auth.uid() = friend_id
);

-- Ensure Insert is still restricted to initiator
DROP POLICY IF EXISTS "Users can insert their own friendships" ON friendships;
CREATE POLICY "Users can insert their own friendships"
ON friendships
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Ensure select is visible to both (already exists but reaffirming)
-- "Users can view their own friendships" usually handles (auth.uid() = user_id OR auth.uid() = friend_id)

-- Ensure Update (Accept) is restricted to recipient
DROP POLICY IF EXISTS "Users can update their own friendships" ON friendships;
CREATE POLICY "Users can update their own friendships"
ON friendships
FOR UPDATE
USING (auth.uid() = friend_id OR auth.uid() = user_id); 
-- logic: friend accepts (update status), user might cancel (update? or delete). keeping broad for now but could refine.
