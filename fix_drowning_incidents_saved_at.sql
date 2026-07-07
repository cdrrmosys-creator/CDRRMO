-- =====================================================
-- FIX: Drowning Incidents saved_at Column Setup
-- =====================================================
-- This script ensures the saved_at column exists and 
-- the trigger is properly configured for drowning_incidents
-- Run this once in Supabase SQL Editor

-- Step 1: Add saved_at column if it doesn't exist
ALTER TABLE drowning_incidents 
ADD COLUMN IF NOT EXISTS saved_at TIMESTAMP WITH TIME ZONE;

-- Step 2: Create or replace the trigger function (if not exists)
CREATE OR REPLACE FUNCTION set_saved_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.saved_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Drop and recreate the trigger for drowning_incidents
DROP TRIGGER IF EXISTS trg_saved_at_drowning_incidents ON drowning_incidents;
CREATE TRIGGER trg_saved_at_drowning_incidents
BEFORE INSERT OR UPDATE ON drowning_incidents
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- Step 4: Backfill existing records with NULL saved_at
UPDATE drowning_incidents
SET saved_at = COALESCE(created_at, date::timestamp with time zone, NOW())
WHERE saved_at IS NULL;

-- Step 5: Add team column if it doesn't exist (bonus fix)
ALTER TABLE drowning_incidents 
ADD COLUMN IF NOT EXISTS team TEXT;

-- Step 6: Verify the setup
SELECT 
  'Trigger Status' as check_type,
  CASE 
    WHEN COUNT(*) > 0 THEN '✓ Trigger exists'
    ELSE '✗ Trigger missing'
  END as status
FROM pg_trigger 
WHERE tgname = 'trg_saved_at_drowning_incidents'

UNION ALL

SELECT 
  'Column Status' as check_type,
  CASE 
    WHEN COUNT(*) > 0 THEN '✓ saved_at column exists'
    ELSE '✗ saved_at column missing'
  END as status
FROM information_schema.columns 
WHERE table_name = 'drowning_incidents' 
  AND column_name = 'saved_at'

UNION ALL

SELECT 
  'Data Status' as check_type,
  COUNT(*) || ' records with saved_at populated' as status
FROM drowning_incidents
WHERE saved_at IS NOT NULL;
