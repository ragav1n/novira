-- Per-user opt-in for the daily/weekly spending digest push.
-- 'off' (default): no digest. 'daily': every morning. 'weekly': Monday mornings.
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS digest_frequency text NOT NULL DEFAULT 'off'
        CHECK (digest_frequency IN ('off', 'daily', 'weekly'));
