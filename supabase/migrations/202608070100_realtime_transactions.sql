-- Add `transactions` to the Realtime publication.
--
-- The client has subscribed to postgres_changes on `transactions` since the
-- dashboard was built (useDashboardData, buckets-provider, analytics-view), but
-- the table was never published — 202602161200_enable_realtime.sql only added
-- groups, group_members, friendships, and splits. Those handlers have therefore
-- never fired, and cross-tab/cross-device freshness has been carried entirely by
-- the `splits` subscription, the visibilitychange refetch, and queue events.
--
-- REPLICA IDENTITY FULL is required, not optional: every client subscription
-- filters on `user_id=eq.<id>` or `group_id=eq.<id>`. With the default replica
-- identity a DELETE only puts the primary key in the old record, so Realtime
-- cannot evaluate those filters and drops the event — deletes would silently
-- never arrive. FULL puts the whole pre-image in the WAL so the filter matches.
--
-- Cost: FULL logs the entire old row on every UPDATE/DELETE, and `transactions`
-- is the highest-write table here. That is the accepted trade for working
-- filtered deletes; RLS still gates which subscriber sees which row.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'transactions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
    END IF;
END $$;

ALTER TABLE public.transactions REPLICA IDENTITY FULL;

-- `splits` was published in 202602161200 but left on the default replica
-- identity, so its DELETE events (filtered on user_id) have been dropped the
-- same way. Same fix, same reasoning.
ALTER TABLE public.splits REPLICA IDENTITY FULL;
