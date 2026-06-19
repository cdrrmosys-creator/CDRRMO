-- Add ORCR and photos columns to the vehicles table
ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS orcr TEXT,
ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}';
