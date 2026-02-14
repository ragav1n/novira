-- Splitwise Core Schema Migration (v9 - RLS Recursion Fix)

-- 1. DROP EVERYTHING related to Splitwise first (Clean Slate)
DROP TABLE IF EXISTS splits CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS friendships CASCADE;
-- Helper functions might exist, we'll replace them.

-- 2. Helper Functions (SECURITY DEFINER to break RLS recursion)

-- 2.1 Group Recursion Breakers
CREATE OR REPLACE FUNCTION public.is_group_member(gid UUID, uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.group_members 
        WHERE group_id = gid AND user_id = uid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_group_creator(gid UUID, uid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.groups 
        WHERE id = gid AND created_by = uid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.2 Transaction/Split Recursion Breaker (NEW)
-- Allows checking transaction owner without triggering Transaction RLS
CREATE OR REPLACE FUNCTION public.get_transaction_user_id(tid UUID)
RETURNS UUID AS $$
    SELECT user_id FROM public.transactions WHERE id = tid;
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. Friendships
CREATE TABLE friendships (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    friend_id UUID REFERENCES profiles(id) NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, friend_id),
    CONSTRAINT no_self_friending CHECK (user_id != friend_id)
);

-- 4. Groups
CREATE TABLE groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_by UUID REFERENCES profiles(id) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Group Members
CREATE TABLE group_members (
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id),
    CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id)
);

-- 6. Splits
CREATE TABLE splits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    amount NUMERIC NOT NULL,
    is_paid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. RLS Policies

-- Friendships
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own friendships" ON friendships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
CREATE POLICY "Users can manage their own friendships" ON friendships FOR ALL USING (auth.uid() = user_id);

-- Groups
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creator can manage group" ON groups FOR ALL USING (auth.uid() = created_by);
CREATE POLICY "Members can view group" ON groups FOR SELECT USING (
    auth.uid() = created_by OR public.is_group_member(id, auth.uid())
);

-- Group Members
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view membership" ON group_members FOR SELECT USING (
    user_id = auth.uid() OR public.is_group_creator(group_id, auth.uid()) OR public.is_group_member(group_id, auth.uid())
);
CREATE POLICY "Creators can manage members" ON group_members FOR ALL USING (
    public.is_group_creator(group_id, auth.uid())
);

-- Splits (UPDATED: Uses helper function to break recursion)
ALTER TABLE splits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view relevant splits" ON splits FOR SELECT USING (
    -- Creditor check (VIA FUNCTION to avoid recursing back to transactions RLS)
    public.get_transaction_user_id(transaction_id) = auth.uid()
    OR 
    -- Debtor check
    user_id = auth.uid()
);

-- 8. Transactions RLS Cleanly Re-Setup
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can view relevant transactions" ON transactions;
CREATE POLICY "Users can view relevant transactions" ON transactions FOR SELECT USING (
    auth.uid() = user_id 
    OR 
    EXISTS (SELECT 1 FROM splits WHERE transaction_id = transactions.id AND user_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM group_members WHERE group_id = transactions.group_id AND user_id = auth.uid())
);

-- Transaction Columns
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

-- 9. Profiles Sync
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
UPDATE profiles p SET email = u.email FROM auth.users u WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');
