-- Tracking columns for the new push notification suite (price-change, goal
-- milestones/deadlines, cash-flow shortfall, anomaly, re-engagement,
-- no-spend streak, group activity, monthly reset, mid-month comparison).
-- Each one is a small idempotency anchor so a notification fires at most once
-- per logical event (not on every cron tick).

-- savings_goals: parallel to buckets.last_threshold_notified / completion flow.
ALTER TABLE public.savings_goals
    ADD COLUMN IF NOT EXISTS last_threshold_notified integer,
    ADD COLUMN IF NOT EXISTS last_deadline_notified text;

-- profiles: lightweight per-user throttles.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS last_reengagement_at date,
    ADD COLUMN IF NOT EXISTS last_no_spend_streak integer,
    ADD COLUMN IF NOT EXISTS last_anomaly_notified_at date,
    ADD COLUMN IF NOT EXISTS last_cashflow_shortfall_at date,
    ADD COLUMN IF NOT EXISTS last_allowance_reset_month text,
    ADD COLUMN IF NOT EXISTS last_midmonth_compared_month text,
    ADD COLUMN IF NOT EXISTS last_group_activity_at timestamptz;
