-- =====================================================
-- FIX: Venues saved_at Column Setup
-- =====================================================
-- This script ensures saved_at is properly configured
-- Run this once in Supabase SQL Editor

-- Step 1: Check current column type and convert if needed
-- If saved_at is TEXT, we need to convert it to TIMESTAMP
DO $$ 
BEGIN
  -- Check if saved_at exists and is TEXT
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'venues' 
      AND column_name = 'saved_at' 
      AND data_type = 'text'
  ) THEN
    -- Convert TEXT to TIMESTAMP WITH TIME ZONE
    ALTER TABLE venues 
    ALTER COLUMN saved_at TYPE TIMESTAMP WITH TIME ZONE 
    USING CASE 
      WHEN saved_at IS NULL THEN NULL
      WHEN saved_at ~ '^\d{4}-\d{2}-\d{2}' THEN saved_at::timestamp with time zone
      ELSE NULL
    END;
    
    RAISE NOTICE 'Converted saved_at from TEXT to TIMESTAMP WITH TIME ZONE';
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'venues' 
      AND column_name = 'saved_at'
  ) THEN
    -- Add saved_at column if it doesn't exist
    ALTER TABLE venues 
    ADD COLUMN saved_at TIMESTAMP WITH TIME ZONE;
    
    RAISE NOTICE 'Added saved_at column as TIMESTAMP WITH TIME ZONE';
  ELSE
    RAISE NOTICE 'saved_at column already exists with correct type';
  END IF;
END $$;

-- Step 2: Ensure the trigger function exists
CREATE OR REPLACE FUNCTION set_saved_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.saved_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Drop and recreate the trigger for venues
DROP TRIGGER IF EXISTS trg_saved_at_venues ON venues;
CREATE TRIGGER trg_saved_at_venues
BEFORE INSERT OR UPDATE ON venues
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- Step 4: Backfill existing records with NULL saved_at
UPDATE venues
SET saved_at = COALESCE(created_at, date::timestamp with time zone)
WHERE saved_at IS NULL;

-- Step 5: Verify the setup
SELECT 
  'Column Type' as check_type,
  data_type as status
FROM information_schema.columns 
WHERE table_name = 'venues' 
  AND column_name = 'saved_at'

UNION ALL

SELECT 
  'Trigger Status' as check_type,
  CASE 
    WHEN COUNT(*) > 0 THEN '✓ Trigger exists'
    ELSE '✗ Trigger missing'
  END as status
FROM pg_trigger 
WHERE tgname = 'trg_saved_at_venues'

UNION ALL

SELECT 
  'Records with saved_at' as check_type,
  COUNT(*)::text || ' / ' || (SELECT COUNT(*) FROM venues)::text as status
FROM venues
WHERE saved_at IS NOT NULL;
