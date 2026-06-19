-- Add insurance fields to the vouchers table
ALTER TABLE public.vouchers
ADD COLUMN IF NOT EXISTS has_insurance BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS insurance_number TEXT,
ADD COLUMN IF NOT EXISTS insurance_id TEXT;
