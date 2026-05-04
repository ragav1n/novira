-- Track the highest spending-threshold milestone (50/80/100) we've already
-- notified the user about for each bucket. NULL = no threshold notified yet.
ALTER TABLE buckets
    ADD COLUMN IF NOT EXISTS last_threshold_notified smallint;
