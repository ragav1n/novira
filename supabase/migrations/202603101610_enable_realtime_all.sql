-- Enable Realtime for remaining core tables
DO $$
BEGIN
    -- 1. Ensure the publication exists (it should, but just in case)
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- 2. Enable Realtime for profiles
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profiles') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
    END IF;

    -- 3. Enable Realtime for workspace_budgets
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'workspace_budgets') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE workspace_budgets;
    END IF;

    -- 4. Enable Realtime for savings_goals
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'savings_goals') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE savings_goals;
    END IF;

    -- 5. Enable Realtime for savings_deposits
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'savings_deposits') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE savings_deposits;
    END IF;

    -- 6. Enable Realtime for recurring_templates
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'recurring_templates') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE recurring_templates;
    END IF;

    -- 7. Enable Realtime for transactions (just in case)
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'transactions') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
    END IF;
END $$;

-- 7. Update RLS for recurring_templates to allow workspace visibility
DROP POLICY IF EXISTS "Users can manage their own templates" ON recurring_templates;

CREATE POLICY "Users can manage their own or group templates" ON recurring_templates
FOR ALL USING (
  auth.uid() = user_id 
  OR 
  group_id IN (
    SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
  )
);
