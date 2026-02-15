-- Fix Transactions RLS Policies
-- The original migration only added a SELECT policy. We need INSERT, UPDATE, DELETE.

-- Drop existing policies to be safe
DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete their own transactions" ON transactions;

-- 1. INSERT: Allow if you are the owner (user_id = auth.uid())
CREATE POLICY "Users can insert their own transactions" ON transactions FOR INSERT 
WITH CHECK (
    auth.uid() = user_id
);

-- 2. UPDATE: Allow if you are the owner
CREATE POLICY "Users can update their own transactions" ON transactions FOR UPDATE
USING (
    auth.uid() = user_id
);

-- 3. DELETE: Allow if you are the owner
CREATE POLICY "Users can delete their own transactions" ON transactions FOR DELETE
USING (
    auth.uid() = user_id
);
