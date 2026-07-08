-- Fix calendar_events table: saved_at column and add event_type_other
-- This script:
-- 1. Adds event_type_other column for custom event types
-- 2. Converts saved_at from TEXT to TIMESTAMP WITH TIME ZONE
-- 3. Backfills NULL saved_at values with created_at or current timestamp
-- 4. Sets up automatic trigger for future records

-- Step 1: Add event_type_other column if it doesn't exist
ALTER TABLE calendar_events 
  ADD COLUMN IF NOT EXISTS event_type_other TEXT;

-- Step 2: Create backup of current data type
ALTER TABLE calendar_events 
  ADD COLUMN IF NOT EXISTS saved_at_backup TEXT;

UPDATE calendar_events 
  SET saved_at_backup = saved_at 
  WHERE saved_at IS NOT NULL;

-- Step 3: Drop the old column and recreate with correct type
ALTER TABLE calendar_events DROP COLUMN IF EXISTS saved_at;
ALTER TABLE calendar_events 
  ADD COLUMN saved_at TIMESTAMP WITH TIME ZONE;

-- Step 4: Restore valid timestamps
UPDATE calendar_events 
  SET saved_at = saved_at_backup::TIMESTAMP WITH TIME ZONE
  WHERE saved_at_backup IS NOT NULL 
    AND saved_at_backup ~ '^\d{4}-\d{2}-\d{2}';

-- Step 5: Backfill NULL values with created_at or NOW()
UPDATE calendar_events 
  SET saved_at = COALESCE(created_at, NOW())
  WHERE saved_at IS NULL;

-- Step 6: Drop backup column
ALTER TABLE calendar_events DROP COLUMN IF EXISTS saved_at_backup;

-- Step 7: Set default for new records
ALTER TABLE calendar_events 
  ALTER COLUMN saved_at SET DEFAULT NOW();

-- Step 8: Create trigger function if not exists
CREATE OR REPLACE FUNCTION update_calendar_events_saved_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.saved_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Drop existing trigger if any
DROP TRIGGER IF EXISTS calendar_events_saved_at_trigger ON calendar_events;

-- Step 10: Create new trigger
CREATE TRIGGER calendar_events_saved_at_trigger
  BEFORE INSERT OR UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_events_saved_at();

-- Verify results
SELECT 
  id,
  event_title,
  event_type,
  event_type_other,
  start_date,
  saved_at,
  created_at
FROM calendar_events 
ORDER BY created_at DESC 
LIMIT 10;

-- Summary
SELECT 
  COUNT(*) as total_records,
  COUNT(saved_at) as records_with_saved_at,
  COUNT(*) - COUNT(saved_at) as records_missing_saved_at
FROM calendar_events;
