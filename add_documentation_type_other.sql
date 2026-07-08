-- Add document_type_other column to documentations table
-- This column stores custom document types when "Other" is selected
-- Also removes the unused files_url column

-- Step 1: Add document_type_other column
ALTER TABLE documentations 
  ADD COLUMN IF NOT EXISTS document_type_other TEXT;

-- Step 2: Remove unused files_url column (files column is used for array of URLs)
ALTER TABLE documentations 
  DROP COLUMN IF EXISTS files_url;

-- Verify the columns
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'documentations'
  AND column_name IN ('document_type_other', 'files', 'files_url')
ORDER BY column_name;

-- Show sample records
SELECT 
  id,
  record_id,
  title,
  document_type,
  document_type_other,
  date_filed,
  files
FROM documentations 
ORDER BY date_filed DESC 
LIMIT 5;
