-- Migration: Bucket UX polish
-- Date: 2026-05-03
--
-- 1. allowed_categories: when set (non-empty), only transactions whose category
--    is in this list count toward the bucket. Empty array = all categories allowed.
-- 2. completed_at: timestamp set by /api/cron/bucket-completion when end_date
--    passes and the bucket is auto-archived. Drives the "Completed" summary card.
-- 3. completion_notified: 1=true once we've sent a push for completion, prevents
--    re-notification if the cron runs more than once.

ALTER TABLE public.buckets
    ADD COLUMN IF NOT EXISTS allowed_categories TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.buckets
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE public.buckets
    ADD COLUMN IF NOT EXISTS completion_notified BOOLEAN NOT NULL DEFAULT FALSE;

-- A small index helps the cron sweep find candidates fast even when bucket count grows.
CREATE INDEX IF NOT EXISTS buckets_end_date_idx
    ON public.buckets (end_date)
    WHERE is_archived = FALSE AND completed_at IS NULL;
