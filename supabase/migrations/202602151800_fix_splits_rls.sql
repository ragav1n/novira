-- Fix Splits RLS Policies
-- The original migration only added a SELECT policy. We need INSERT, UPDATE, DELETE.

-- Drop existing policies to be safe (though likely none exist for these operations)
DROP POLICY IF EXISTS "Transaction creators can insert splits" ON splits;
DROP POLICY IF EXISTS "Users can update relevant splits" ON splits;
DROP POLICY IF EXISTS "Transaction creators can delete splits" ON splits;

-- 1. INSERT: Allow if you own the parent transaction
-- We use the helper function public.get_transaction_user_id(tid) which is SECURITY DEFINER
CREATE POLICY "Transaction creators can insert splits" ON splits FOR INSERT 
WITH CHECK (
    public.get_transaction_user_id(transaction_id) = auth.uid()
);

-- 2. UPDATE: Allow if you own the transaction OR you are the debtor (the one who owes)
-- Debtors need to update to mark as paid (via settleSplit)
CREATE POLICY "Users can update relevant splits" ON splits FOR UPDATE
USING (
    public.get_transaction_user_id(transaction_id) = auth.uid() 
    OR 
    user_id = auth.uid()
);

-- 3. DELETE: Allow if you own the transaction
CREATE POLICY "Transaction creators can delete splits" ON splits FOR DELETE
USING (
    public.get_transaction_user_id(transaction_id) = auth.uid()
);
