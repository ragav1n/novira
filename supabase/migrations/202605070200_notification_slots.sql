-- Notification slots: a 3/day floor for active subscribed users on top of the
-- existing event-driven cron jobs. Adds the per-user prefs the cron fleet
-- already references but never had migrations for, plus a shared send log so
-- the slot orchestrator can suppress slots within a 4-hour window of any
-- other push (natural anti-stacking — no hard daily cap).

-- Profile preference columns. Several of these are already written to by the
-- settings UI (`components/providers/user-preferences-provider.tsx`) and read
-- by cron routes via a "wide select with legacy fallback" pattern. Until now
-- those writes silently failed. IF NOT EXISTS keeps this idempotent if any
-- column was added manually in the dashboard.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS quiet_hours_start smallint
        CHECK (quiet_hours_start IS NULL OR quiet_hours_start BETWEEN 0 AND 23),
    ADD COLUMN IF NOT EXISTS quiet_hours_end smallint
        CHECK (quiet_hours_end IS NULL OR quiet_hours_end BETWEEN 0 AND 23),
    ADD COLUMN IF NOT EXISTS timezone text,
    ADD COLUMN IF NOT EXISTS bucket_deadline_alerts boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS spending_pace_alerts boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS smart_digests_enabled boolean NOT NULL DEFAULT true;

-- Cross-job send log. Encodes *delivery cadence* (different concern from the
-- per-event dedup flags like last_threshold_notified, which encode *event
-- identity*). Slot dedup uses the partial unique index below; recent-sends
-- lookups for 4-hour suppression use the (user_id, sent_at DESC) index.
CREATE TABLE IF NOT EXISTS public.notification_send_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sent_at timestamptz NOT NULL DEFAULT now(),
    kind text NOT NULL,
    local_date date NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS notification_send_log_slot_dedup
    ON public.notification_send_log (user_id, local_date, kind)
    WHERE kind LIKE 'slot:%';

CREATE INDEX IF NOT EXISTS notification_send_log_recent
    ON public.notification_send_log (user_id, sent_at DESC);

ALTER TABLE public.notification_send_log ENABLE ROW LEVEL SECURITY;

-- Read-only for owning user (so they can audit deliveries from the app if we
-- ever build that UI). Inserts are server-only via service role; no insert /
-- update / delete policy.
DROP POLICY IF EXISTS "Users can read own notification send log" ON public.notification_send_log;
CREATE POLICY "Users can read own notification send log"
    ON public.notification_send_log
    FOR SELECT
    USING (auth.uid() = user_id);
