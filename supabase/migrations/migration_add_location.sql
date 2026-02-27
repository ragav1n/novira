-- Add optional location fields to transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS place_name text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS place_address text;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS place_lat double precision;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS place_lng double precision;
