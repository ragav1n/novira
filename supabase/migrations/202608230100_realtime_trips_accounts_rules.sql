-- Close the last three realtime gaps: `trips`, `accounts`, `categorization_rules`.
-- Created: 2026-08-23
--
-- Same class of bug as 202608070100_realtime_transactions.sql, found the same way
-- and stated here with the measurements rather than the inference.
--
-- Probed against the live project with a filtered `event: '*'` subscription
-- (`user_id=eq.<uid>`, one channel per run, insert then delete):
--
--   table                  published   filtered DELETE arrives
--   transactions           yes         yes
--   buckets                yes         yes
--   savings_goals          yes         yes
--   recurring_templates    yes         yes
--   accounts               yes         NO
--   categorization_rules   yes         NO
--   trips                  NO          -- nothing at all arrives
--
-- 1. `trips` is not in the publication. `active-trip-provider.tsx` has subscribed
--    since the feature shipped and the channel reports SUBSCRIBED, but not one
--    event has ever been delivered — a dead subscription is indistinguishable
--    from a live one on the client, because `.subscribe()` succeeds either way.
--
-- 2. `accounts` and `categorization_rules` are published and deliver INSERT and
--    UPDATE, but not DELETE. Both were almost certainly enabled with the
--    dashboard's per-table realtime toggle, which adds the table to the
--    publication without touching its replica identity. With the default replica
--    identity a DELETE writes only the primary key into the old record, so
--    Realtime cannot evaluate a `user_id=eq.<id>` filter and drops the event.
--    User-visible effect: delete an account or an auto-categorization rule on one
--    device and it stays on screen everywhere else until a manual reload.
--
-- Cost of REPLICA IDENTITY FULL is the whole pre-image in the WAL on every
-- UPDATE/DELETE. All three are low-write, small tables — far cheaper here than on
-- `transactions`, where the same trade was already accepted. RLS still gates who
-- sees which row.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'trips'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
    END IF;
END $$;

ALTER TABLE public.trips REPLICA IDENTITY FULL;
ALTER TABLE public.accounts REPLICA IDENTITY FULL;
ALTER TABLE public.categorization_rules REPLICA IDENTITY FULL;
