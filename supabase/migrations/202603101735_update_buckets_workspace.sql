-- Add missing columns to buckets table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buckets' AND column_name = 'group_id') THEN
        ALTER TABLE buckets ADD COLUMN group_id UUID REFERENCES groups(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buckets' AND column_name = 'currency') THEN
        ALTER TABLE buckets ADD COLUMN currency TEXT DEFAULT 'USD';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buckets' AND column_name = 'start_date') THEN
        ALTER TABLE buckets ADD COLUMN start_date DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buckets' AND column_name = 'end_date') THEN
        ALTER TABLE buckets ADD COLUMN end_date DATE;
    END IF;
END $$;

-- Update RLS Policies for buckets to support group access
DROP POLICY IF EXISTS "Users can manage their own buckets" ON buckets;

CREATE POLICY "Users can view buckets in their workspaces"
ON buckets FOR SELECT
USING (
    auth.uid() = user_id 
    OR 
    group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can create buckets in their workspaces"
ON buckets FOR INSERT
WITH CHECK (
    auth.uid() = user_id
    AND (
        group_id IS NULL 
        OR 
        group_id IN (
            SELECT group_id FROM group_members WHERE user_id = auth.uid()
        )
    )
);

CREATE POLICY "Users can update buckets in their workspaces"
ON buckets FOR UPDATE
USING (
    auth.uid() = user_id 
    OR 
    group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    auth.uid() = user_id 
    OR 
    group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete buckets in their workspaces"
ON buckets FOR DELETE
USING (
    auth.uid() = user_id 
    OR 
    group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
);
