-- Add saved_at column to drowning_incidents table

-- 1. Add the saved_at column if it doesn't exist
ALTER TABLE drowning_incidents 
ADD COLUMN IF NOT EXISTS saved_at TIMESTAMP WITH TIME ZONE;

-- 2. Backfill existing records with their created_at or date value
UPDATE drowning_incidents
SET saved_at = COALESCE(created_at, date::timestamp with time zone)
WHERE saved_at IS NULL;

-- 3. Verify the column was added and populated
SELECT 
  COUNT(*) as total_records,
  COUNT(saved_at) as records_with_saved_at,
  COUNT(*) - COUNT(saved_at) as records_without_saved_at
FROM drowning_incidents;

-- Note: The trigger from add_saved_at_triggers.sql should already handle 
-- setting saved_at automatically for new INSERT and UPDATE operations.
-- If the trigger doesn't exist, it will be created when you run that script.
