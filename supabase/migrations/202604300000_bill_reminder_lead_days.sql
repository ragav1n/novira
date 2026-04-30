-- Add bill reminder lead time to profiles.
-- NULL = bill reminders disabled. A positive integer means "remind me N days before
-- the recurring template's next_occurrence" via the daily Vercel cron at /api/cron/bill-reminders.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS bill_reminder_lead_days integer
        CHECK (bill_reminder_lead_days IS NULL OR bill_reminder_lead_days BETWEEN 0 AND 14);

-- Track when we last notified for a given (template, occurrence) so we never
-- send a duplicate reminder for the same upcoming bill.
CREATE TABLE IF NOT EXISTS public.bill_reminder_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    template_id uuid NOT NULL REFERENCES public.recurring_templates(id) ON DELETE CASCADE,
    next_occurrence date NOT NULL,
    notified_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (template_id, next_occurrence)
);

CREATE INDEX IF NOT EXISTS bill_reminder_log_user_idx
    ON public.bill_reminder_log (user_id, next_occurrence DESC);

ALTER TABLE public.bill_reminder_log ENABLE ROW LEVEL SECURITY;

-- Users can only read their own reminder log entries. Inserts are server-only
-- (the cron route uses the service role key), so no insert/update/delete policy.
DROP POLICY IF EXISTS "Users can read own bill reminder log" ON public.bill_reminder_log;
CREATE POLICY "Users can read own bill reminder log"
    ON public.bill_reminder_log
    FOR SELECT
    USING (auth.uid() = user_id);
