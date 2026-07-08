-- =====================================================
-- FIX: Training Conducted participants Column
-- =====================================================
-- This script converts the participants column to JSONB
-- so it can properly store participant arrays
-- Run this once in Supabase SQL Editor

-- Step 1: Check current column type
DO $$ 
BEGIN
  -- If participants column doesn't exist, create it as JSONB
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'training_conducted' AND column_name = 'participants'
  ) THEN
    ALTER TABLE training_conducted ADD COLUMN participants JSONB DEFAULT '[]'::jsonb;
    RAISE NOTICE 'Created participants column as JSONB';
  END IF;
END $$;

-- Step 2: If column exists but is wrong type, create temporary column
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_name = 'training_conducted' AND column_name = 'participants';
  
  IF col_type != 'jsonb' THEN
    -- Create backup column
    ALTER TABLE training_conducted ADD COLUMN IF NOT EXISTS participants_backup TEXT;
    
    -- Copy data to backup using exception handling
    UPDATE training_conducted
    SET participants_backup = 
      CASE 
        WHEN participants::text = '' THEN NULL
        WHEN participants::text IS NULL THEN NULL
        ELSE participants::text
      END;
    
    -- Drop the old column
    ALTER TABLE training_conducted DROP COLUMN participants;
    
    -- Create new JSONB column
    ALTER TABLE training_conducted ADD COLUMN participants JSONB DEFAULT '[]'::jsonb;
    
    -- Migrate data from backup
    UPDATE training_conducted
    SET participants = '[]'::jsonb
    WHERE participants_backup IS NULL OR participants_backup = '';
    
    UPDATE training_conducted
    SET participants = participants_backup::jsonb
    WHERE participants_backup IS NOT NULL 
      AND participants_backup != ''
      AND participants_backup ~ '^\s*\[';
    
    UPDATE training_conducted
    SET participants = jsonb_build_array(jsonb_build_object('name', participants_backup))
    WHERE participants_backup IS NOT NULL 
      AND participants_backup != ''
      AND participants_backup !~ '^\s*\[';
    
    -- Drop backup column
    ALTER TABLE training_conducted DROP COLUMN IF EXISTS participants_backup;
    
    RAISE NOTICE 'Converted participants from % to JSONB', col_type;
  ELSE
    RAISE NOTICE 'participants column is already JSONB';
  END IF;
END $$;

-- Step 3: Ensure all NULL values are set to empty array
UPDATE training_conducted
SET participants = '[]'::jsonb
WHERE participants IS NULL;

-- Step 4: Add remarks and photos columns if they don't exist
ALTER TABLE training_conducted 
ADD COLUMN IF NOT EXISTS remarks TEXT;

ALTER TABLE training_conducted 
ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

-- Step 5: Verify the changes
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'training_conducted'
  AND column_name IN ('participants', 'remarks', 'photos')
ORDER BY column_name;

-- Step 6: Show sample of converted data (LIMIT 5 is just for preview - doesn't limit how many you can add!)
SELECT 
  record_id,
  training_title,
  participants,
  jsonb_array_length(COALESCE(participants, '[]'::jsonb)) as participant_count
FROM training_conducted
LIMIT 5;
