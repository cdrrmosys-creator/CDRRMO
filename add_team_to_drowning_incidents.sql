-- =====================================================
-- Add team column to drowning_incidents table
-- =====================================================
-- Run this once in Supabase SQL Editor

ALTER TABLE public.drowning_incidents 
ADD COLUMN IF NOT EXISTS team TEXT;

-- Optional: Add comment for documentation
COMMENT ON COLUMN public.drowning_incidents.team IS 'Response team (Alpha, Bravo, Charlie, Delta, or Other)';
