-- Migration to add is_recurring flag to transactions
-- Created: 2026-02-18 19:30

ALTER TABLE transactions ADD COLUMN is_recurring BOOLEAN DEFAULT FALSE;
