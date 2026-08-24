-- Close every remaining realtime gap, and state the whole publication in one place.
-- Created: 2026-08-23
--
-- Third pass of the same bug class as 202608070100 and 202608230100. Those two
-- fixed the tables that were then known to be broken; this one enumerates every
-- table the client actually subscribes to and makes the required state explicit,
-- so the next feature can be checked against a single list instead of three.
--
-- Client subscriptions, as of this migration (table → filter used):
--
--   transactions          user_id / group_id / unfiltered
--   splits                user_id / unfiltered
--   profiles              id
--   buckets               unfiltered
--   savings_goals         user_id
--   savings_deposits      user_id
--   recurring_templates   user_id
--   categorization_rules  user_id
--   accounts              user_id
--   trips                 user_id / id
--   scheduled_events      user_id      <- new subscription, see below
--   workspace_budgets     unfiltered
--   groups                unfiltered
--   group_members         unfiltered
--   friendships           unfiltered
--
-- 1. PUBLICATION. `scheduled_events` has never been in `supabase_realtime` —
--    202605061200 created the table and its policies and stopped there. The
--    calendar's one-off events were the only thing on that screen with no live
--    path at all. Every other table above is added here too, guarded, so the
--    publication is asserted rather than assumed.
--
-- 2. REPLICA IDENTITY. A DELETE writes only the replica-identity columns into the
--    WAL old record. Realtime evaluates both the subscription filter *and* the
--    RLS policy against that record, so on a table whose filter or policy keys off
--    anything but the primary key, DELETEs are silently dropped at the default
--    replica identity: the row stays on screen on every other device until a
--    reload. That is why `user_id`-keyed tables below are set to FULL.
--
--    Deliberately left at the default:
--      profiles          — filter and policy both key on `id`, the primary key.
--      workspace_budgets — subscribed unfiltered; its policy keys on `group_id`,
--                          which is the primary key.
--    Both are already evaluable from the default old record, so FULL would only
--    add WAL volume.
--
--    The FULL statements are idempotent, so the tables 202608070100 and
--    202608230100 already converted are re-asserted here rather than omitted —
--    a table's replica identity is not visible through PostgREST, and a list that
--    is complete is worth more than one that is minimal.

DO $$
DECLARE
    t text;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    FOREACH t IN ARRAY ARRAY[
        'transactions', 'splits', 'profiles', 'buckets', 'savings_goals',
        'savings_deposits', 'recurring_templates', 'categorization_rules',
        'accounts', 'trips', 'scheduled_events', 'workspace_budgets',
        'groups', 'group_members', 'friendships'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        END IF;
    END LOOP;
END $$;

-- Filtered or non-PK-policy tables: the old record must carry enough columns for
-- Realtime to evaluate the filter and the RLS policy on DELETE.
ALTER TABLE public.transactions         REPLICA IDENTITY FULL;
ALTER TABLE public.splits               REPLICA IDENTITY FULL;
ALTER TABLE public.buckets              REPLICA IDENTITY FULL;
ALTER TABLE public.savings_goals        REPLICA IDENTITY FULL;
ALTER TABLE public.savings_deposits     REPLICA IDENTITY FULL;
ALTER TABLE public.recurring_templates  REPLICA IDENTITY FULL;
ALTER TABLE public.categorization_rules REPLICA IDENTITY FULL;
ALTER TABLE public.accounts             REPLICA IDENTITY FULL;
ALTER TABLE public.trips                REPLICA IDENTITY FULL;
ALTER TABLE public.scheduled_events     REPLICA IDENTITY FULL;

-- Membership tables are subscribed unfiltered, but their policies key on
-- `user_id` / group membership rather than the primary key — so leaving a group
-- or removing a friend never reached the other device either.
ALTER TABLE public.groups               REPLICA IDENTITY FULL;
ALTER TABLE public.group_members        REPLICA IDENTITY FULL;
ALTER TABLE public.friendships          REPLICA IDENTITY FULL;

-- Verification (run in the SQL editor; neither pg_publication_tables nor
-- relreplident is reachable through PostgREST, so this cannot be checked from
-- the app or the agent environment):
--
--   select c.relname,
--          (p.tablename is not null) as in_publication,
--          case c.relreplident when 'f' then 'FULL' when 'd' then 'default'
--               when 'n' then 'nothing' when 'i' then 'index' end as replica_identity
--   from pg_class c
--   join pg_namespace n on n.oid = c.relnamespace
--   left join pg_publication_tables p
--     on p.schemaname = 'public' and p.tablename = c.relname
--    and p.pubname = 'supabase_realtime'
--   where n.nspname = 'public'
--     and c.relkind = 'r'
--   order by in_publication desc, c.relname;
--
-- Expected: every table listed at the top of this file shows in_publication = t,
-- and every table except `profiles` and `workspace_budgets` shows FULL.
