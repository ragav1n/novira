-- Enable RLS for Transactions Update/Delete

-- 1. Allow Users to UPDATE their own transactions
DROP POLICY IF EXISTS "Users can update their own transactions" ON transactions;
CREATE POLICY "Users can update their own transactions"
ON transactions
FOR UPDATE
USING (auth.uid() = user_id);

-- 2. Allow Users to DELETE their own transactions
DROP POLICY IF EXISTS "Users can delete their own transactions" ON transactions;
CREATE POLICY "Users can delete their own transactions"
ON transactions
FOR DELETE
USING (auth.uid() = user_id);

-- Note: Splits are set to ON DELETE CASCADE in schema, so deleting a transaction will automatically delete associated splits.
