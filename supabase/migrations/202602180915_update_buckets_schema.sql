-- Add start_date and end_date to buckets table
ALTER TABLE buckets 
ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;
