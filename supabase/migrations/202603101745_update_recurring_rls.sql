-- Update RLS for recurring_templates to support workspace visibility
DROP POLICY IF EXISTS "Users can manage their own templates" ON recurring_templates;

CREATE POLICY "Users can view relevant recurring templates"
ON recurring_templates FOR SELECT
USING (
    auth.uid() = user_id 
    OR 
    group_id IN (
        SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert their own templates"
ON recurring_templates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
ON recurring_templates FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
ON recurring_templates FOR DELETE
USING (auth.uid() = user_id);
