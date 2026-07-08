-- =====================================================
-- FIX: Training Attended participants Column
-- =====================================================
-- This script adds the participants column as JSONB
-- and keeps the old attendees column for backward compatibility
-- Run this once in Supabase SQL Editor

-- Step 1: Add participants column as JSONB
ALTER TABLE training_attended 
ADD COLUMN IF NOT EXISTS participants JSONB DEFAULT '[]'::jsonb;

-- Step 2: Add remarks column if it doesn't exist
ALTER TABLE training_attended 
ADD COLUMN IF NOT EXISTS remarks TEXT;

-- Step 3: Add photos column if it doesn't exist
ALTER TABLE training_attended 
ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

-- Step 4: Add date_end column if it doesn't exist
ALTER TABLE training_attended 
ADD COLUMN IF NOT EXISTS date_end DATE;

-- Step 5: Migrate existing attendees TEXT data to participants JSONB (if needed)
-- Only migrate if participants is empty and attendees has data
UPDATE training_attended
SET participants = jsonb_build_array(jsonb_build_object('name', TRIM(attendees)))
WHERE attendees IS NOT NULL 
  AND TRIM(attendees) != ''
  AND (participants IS NULL OR participants = '[]'::jsonb);

-- Step 6: Verify the changes
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'training_attended'
  AND column_name IN ('participants', 'attendees', 'remarks', 'photos', 'date_end')
ORDER BY column_name;

-- Step 7: Show sample of data (LIMIT 5 is just for preview - doesn't limit how many you can add!)
SELECT 
  record_id,
  training_title,
  attendees as old_attendees_text,
  participants as new_participants_json,
  jsonb_array_length(COALESCE(participants, '[]'::jsonb)) as participant_count
FROM training_attended
LIMIT 5;
