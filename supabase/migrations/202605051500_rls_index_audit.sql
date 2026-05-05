-- Indexes for the subqueries in the profile SELECT RLS policy
-- (see 202602142355_fix_profiles_rls.sql). At small scale the planner happily
-- sequential-scans these tables on every profile read; at 100k+ rows this is
-- the dominant per-request cost.
--
-- Each subquery and its supporting index:
--   1. friendships.user_id / friendships.friend_id with status filter
--   2. group_members self-join on group_id (find shared groups)
--   3. transactions JOIN splits — needs (user_id) on both ends
--
-- All indexes use IF NOT EXISTS so this migration is idempotent.

-- 1. Friendships: cover both lookup directions plus the status filter
CREATE INDEX IF NOT EXISTS idx_friendships_user_friend_status
    ON friendships (user_id, friend_id, status);

CREATE INDEX IF NOT EXISTS idx_friendships_friend_user_status
    ON friendships (friend_id, user_id, status);

-- 2. Group members: the self-join on group_id needs both columns indexed.
-- (group_id, user_id) supports "find groups for this user" and the join key.
CREATE INDEX IF NOT EXISTS idx_group_members_group_user
    ON group_members (group_id, user_id);

CREATE INDEX IF NOT EXISTS idx_group_members_user_group
    ON group_members (user_id, group_id);

-- 3. Splits: lookup by user_id is hot for the RLS subquery and for the new
-- compute_user_bucket_spending RPC's per-row split lookup.
CREATE INDEX IF NOT EXISTS idx_splits_user
    ON splits (user_id);

CREATE INDEX IF NOT EXISTS idx_splits_transaction
    ON splits (transaction_id);

-- 4. Transactions: composite for the most common scoping
-- (workspace bucket queries, dashboard pagination, RLS counterpart subquery)
CREATE INDEX IF NOT EXISTS idx_transactions_user_bucket
    ON transactions (user_id, bucket_id)
    WHERE bucket_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_group_bucket
    ON transactions (group_id, bucket_id)
    WHERE bucket_id IS NOT NULL AND group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_date
    ON transactions (user_id, date DESC);

-- ANALYZE to refresh planner statistics so the new indexes are picked up
-- immediately rather than on the next autovacuum.
ANALYZE friendships;
ANALYZE group_members;
ANALYZE splits;
ANALYZE transactions;
