-- Add columns for historical currency conversion
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS exchange_rate numeric,
ADD COLUMN IF NOT EXISTS base_currency text,
ADD COLUMN IF NOT EXISTS converted_amount numeric;

-- Comment on columns
COMMENT ON COLUMN transactions.exchange_rate IS 'Exchange rate from transaction currency to base_currency at the time of transaction';
COMMENT ON COLUMN transactions.base_currency IS 'The user''s profile currency at the time of transaction, which converted_amount is based on';
COMMENT ON COLUMN transactions.converted_amount IS 'The amount converted to base_currency using the exchange_rate';
