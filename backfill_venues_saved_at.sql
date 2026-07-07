-- =====================================================
-- Backfill saved_at for existing venues records
-- =====================================================
-- Run this once in Supabase SQL Editor to populate
-- saved_at for old records that have NULL values

-- Update venues records with NULL saved_at
-- Use created_at if available, otherwise use date as fallback
UPDATE venues
SET saved_at = COALESCE(created_at, date::timestamp with time zone)
WHERE saved_at IS NULL;

-- Verify the backfill
SELECT 
  COUNT(*) as total_records,
  COUNT(saved_at) as records_with_saved_at,
  COUNT(*) - COUNT(saved_at) as records_without_saved_at
FROM venues;

-- Show sample of updated records
SELECT 
  id,
  facility_name,
  date,
  created_at,
  saved_at,
  CASE 
    WHEN saved_at = created_at THEN 'Used created_at'
    WHEN saved_at::date = date THEN 'Used date'
    ELSE 'Other'
  END as saved_at_source
FROM venues
ORDER BY date DESC
LIMIT 10;
