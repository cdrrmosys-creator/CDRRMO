-- =====================================================
-- FIX: CDRRMC Resolutions saved_at Column
-- =====================================================
-- This script ensures saved_at column is properly set up
-- as TIMESTAMP WITH TIME ZONE with automatic triggers
-- Run this once in Supabase SQL Editor

-- Step 1: Check if saved_at column exists, if not create it
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cdrrmc_reso' AND column_name = 'saved_at'
  ) THEN
    ALTER TABLE cdrrmc_reso ADD COLUMN saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    RAISE NOTICE 'Created saved_at column';
  END IF;
END $$;

-- Step 2: Convert saved_at to proper type if it's not already
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_name = 'cdrrmc_reso' AND column_name = 'saved_at';
  
  IF col_type != 'timestamp with time zone' THEN
    -- Create backup column
    ALTER TABLE cdrrmc_reso ADD COLUMN IF NOT EXISTS saved_at_backup TEXT;
    
    -- Copy data to backup
    UPDATE cdrrmc_reso
    SET saved_at_backup = saved_at::text;
    
    -- Drop old column and create new one
    ALTER TABLE cdrrmc_reso DROP COLUMN saved_at;
    ALTER TABLE cdrrmc_reso ADD COLUMN saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    
    -- Try to restore dates from backup
    UPDATE cdrrmc_reso
    SET saved_at = 
      CASE 
        WHEN saved_at_backup IS NOT NULL AND saved_at_backup != '' 
        THEN saved_at_backup::timestamp with time zone
        ELSE NOW()
      END
    WHERE saved_at_backup IS NOT NULL;
    
    -- Drop backup column
    ALTER TABLE cdrrmc_reso DROP COLUMN IF EXISTS saved_at_backup;
    
    RAISE NOTICE 'Converted saved_at to TIMESTAMP WITH TIME ZONE';
  ELSE
    RAISE NOTICE 'saved_at column is already TIMESTAMP WITH TIME ZONE';
  END IF;
END $$;

-- Step 3: Set default value for the column
ALTER TABLE cdrrmc_reso 
ALTER COLUMN saved_at SET DEFAULT NOW();

-- Step 4: Backfill NULL values with current timestamp
UPDATE cdrrmc_reso
SET saved_at = NOW()
WHERE saved_at IS NULL;

-- Step 5: Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_cdrrmc_reso_saved_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.saved_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Drop trigger if it exists and recreate it
DROP TRIGGER IF EXISTS set_cdrrmc_reso_saved_at ON cdrrmc_reso;

CREATE TRIGGER set_cdrrmc_reso_saved_at
  BEFORE INSERT OR UPDATE ON cdrrmc_reso
  FOR EACH ROW
  EXECUTE FUNCTION update_cdrrmc_reso_saved_at();

-- Step 7: Verify the setup
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'cdrrmc_reso'
  AND column_name = 'saved_at';

-- Step 8: Check trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'cdrrmc_reso'
  AND trigger_name = 'set_cdrrmc_reso_saved_at';

-- Step 9: Show sample of data
SELECT 
  id,
  resolution_no,
  title,
  saved_at,
  CASE 
    WHEN saved_at IS NULL THEN '❌ NULL'
    ELSE '✅ Has value'
  END as status
FROM cdrrmc_reso
ORDER BY saved_at DESC NULLS LAST
LIMIT 5;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CDRRMC Resolutions saved_at column fixed!';
  RAISE NOTICE 'All new records will auto-populate saved_at';
  RAISE NOTICE 'Existing NULL values have been backfilled';
  RAISE NOTICE '========================================';
END $$;
