-- Migration: Formalize workspace_budgets table
CREATE TABLE IF NOT EXISTS public.workspace_budgets (
    group_id UUID PRIMARY KEY REFERENCES public.groups(id) ON DELETE CASCADE,
    monthly_budget NUMERIC NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: We used PRIMARY KEY(group_id) because each workspace has only ONE monthly budget.
-- If we wanted per-currency budgets, we would use (group_id, currency).
-- But for the dashboard view, a workspace usually has one "operational" budget.

-- Enable RLS
ALTER TABLE public.workspace_budgets ENABLE ROW LEVEL SECURITY;

-- Policy: Members can view and manage their group's budget
DROP POLICY IF EXISTS "Members can manage group budget" ON public.workspace_budgets;
CREATE POLICY "Members can manage group budget" ON public.workspace_budgets
FOR ALL USING (
    group_id IN (
        SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.groups WHERE id = group_id AND created_by = auth.uid()
    )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.workspace_budgets;
CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.workspace_budgets
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
