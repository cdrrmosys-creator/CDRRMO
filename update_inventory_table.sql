-- Add new columns to the inventory table
ALTER TABLE public.inventory
ADD COLUMN IF NOT EXISTS stock_number text,
ADD COLUMN IF NOT EXISTS property_no text,
ADD COLUMN IF NOT EXISTS serial_no text,
ADD COLUMN IF NOT EXISTS unit text,
ADD COLUMN IF NOT EXISTS acquisition_cost numeric(12,2),
ADD COLUMN IF NOT EXISTS property_custodian text,
ADD COLUMN IF NOT EXISTS serviceable boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS photos jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS remarks text;
