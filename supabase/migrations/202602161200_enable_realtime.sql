-- Enable Realtime for the core tables needed in GroupsView
-- This script is idempotent: it checks if the table is already in the publication before adding it.

DO $$
BEGIN
    -- 1. Ensure the publication exists
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- 2. Add 'groups' table if not already present
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'groups') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE groups;
    END IF;

    -- 3. Add 'group_members' table if not already present
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'group_members') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE group_members;
    END IF;

    -- 4. Add 'friendships' table if not already present
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'friendships') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
    END IF;

    -- 5. Add 'splits' table if not already present
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'splits') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE splits;
    END IF;
END $$;
