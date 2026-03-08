-- Migration: Add group_id to savings_goals
ALTER TABLE IF EXISTS public.savings_goals 
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;

-- Update RLS for savings_goals
DROP POLICY IF EXISTS "Users can manage their own goals" ON public.savings_goals;
DROP POLICY IF EXISTS "Users can view and manage their own goals" ON public.savings_goals;

CREATE POLICY "Users can manage their own or group goals" ON public.savings_goals
FOR ALL USING (
  auth.uid() = user_id 
  OR 
  group_id IN (
    SELECT group_id FROM public.group_members WHERE user_id = auth.uid()
  )
);

-- Update RLS for savings_deposits so members can add deposits to a group goal
DROP POLICY IF EXISTS "Users can manage their own deposits" ON public.savings_deposits;

CREATE POLICY "Users can manage deposits for their own or group goals" ON public.savings_deposits
FOR ALL USING (
  auth.uid() = user_id
  OR
  EXISTS (
      SELECT 1 FROM public.savings_goals sg
      WHERE sg.id = goal_id 
      AND sg.group_id IN (SELECT group_id FROM public.group_members WHERE user_id = auth.uid())
  )
);
