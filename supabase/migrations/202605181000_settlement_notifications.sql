-- Settlement-related push notifications. Gates two new senders:
--   1. /api/push/notify-split — realtime push when a split is created
--      that involves the user as a debtor.
--   2. /api/cron/settlement-rollup — weekly nudge for unpaid splits >3
--      days old, aggregated per direction (owed-to-me vs i-owe).
-- One preference column covers both so the settings UI stays uncluttered.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS settlement_notifications_enabled boolean NOT NULL DEFAULT true;
