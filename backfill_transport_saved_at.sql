-- Backfill saved_at for transport records that have NULL saved_at
-- This updates old records to have saved_at populated

-- For transport records, use date_time as the saved_at value
-- If date_time is also null, use created_at
UPDATE transport
SET saved_at = COALESCE(date_time, created_at)
WHERE saved_at IS NULL;

-- Verify the update
SELECT 
  COUNT(*) as total_records,
  COUNT(saved_at) as records_with_saved_at,
  COUNT(*) - COUNT(saved_at) as records_without_saved_at
FROM transport;
