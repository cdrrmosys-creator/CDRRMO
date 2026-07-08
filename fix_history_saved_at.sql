-- Fix history table: saved_at column and remove category
-- This script:
-- 1. Adds disaster_type_other column for custom disaster types
-- 2. Converts saved_at from TEXT to TIMESTAMP WITH TIME ZONE
-- 3. Backfills NULL saved_at values with created_at or current timestamp
-- 4. Sets up automatic trigger for future records
-- 5. Removes the unused category column

-- Step 1: Add disaster_type_other column if it doesn't exist
ALTER TABLE history 
  ADD COLUMN IF NOT EXISTS disaster_type_other TEXT;

-- Step 2: Create backup of current data type
ALTER TABLE history 
  ADD COLUMN IF NOT EXISTS saved_at_backup TEXT;

UPDATE history 
  SET saved_at_backup = saved_at 
  WHERE saved_at IS NOT NULL;

-- Step 3: Drop the old column and recreate with correct type
ALTER TABLE history DROP COLUMN IF EXISTS saved_at;
ALTER TABLE history 
  ADD COLUMN saved_at TIMESTAMP WITH TIME ZONE;

-- Step 4: Restore valid timestamps
UPDATE history 
  SET saved_at = saved_at_backup::TIMESTAMP WITH TIME ZONE
  WHERE saved_at_backup IS NOT NULL 
    AND saved_at_backup ~ '^\d{4}-\d{2}-\d{2}';

-- Step 5: Backfill NULL values with created_at or NOW()
UPDATE history 
  SET saved_at = COALESCE(created_at, NOW())
  WHERE saved_at IS NULL;

-- Step 6: Drop backup column
ALTER TABLE history DROP COLUMN IF EXISTS saved_at_backup;

-- Step 7: Set default for new records
ALTER TABLE history 
  ALTER COLUMN saved_at SET DEFAULT NOW();

-- Step 8: Create trigger function if not exists
CREATE OR REPLACE FUNCTION update_history_saved_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.saved_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Drop existing trigger if any
DROP TRIGGER IF EXISTS history_saved_at_trigger ON history;

-- Step 10: Create new trigger
CREATE TRIGGER history_saved_at_trigger
  BEFORE INSERT OR UPDATE ON history
  FOR EACH ROW
  EXECUTE FUNCTION update_history_saved_at();

-- Step 11: Remove unused category column
ALTER TABLE history DROP COLUMN IF EXISTS category;

-- Verify results
SELECT 
  id,
  record_id,
  event_title,
  disaster_type,
  disaster_type_other,
  saved_at,
  created_at
FROM history 
ORDER BY created_at DESC 
LIMIT 10;

-- Summary
SELECT 
  COUNT(*) as total_records,
  COUNT(saved_at) as records_with_saved_at,
  COUNT(*) - COUNT(saved_at) as records_missing_saved_at
FROM history;
