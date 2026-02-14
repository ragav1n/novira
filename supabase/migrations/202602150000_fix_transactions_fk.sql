-- Fix Foreign Key for Transactions -> Profiles relationship (PGRST200)

-- We need to ensure transactions.user_id references profiles.id explicitly for PostgREST resource embedding.
-- Currently it likely references auth.users only.

-- 1. Drop existing FK if it exists (referencing auth.users) - Check name first or use generic DROP CONSTRAINT IF EXISTS
-- Note: 'transactions_user_id_fkey' is the standard naming convention.
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;

-- 2. Add FK to profiles
ALTER TABLE transactions 
ADD CONSTRAINT transactions_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Note: profiles.id already references auth.users, so integrity is maintained.
