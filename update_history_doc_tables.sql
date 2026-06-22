-- Run this in your Supabase SQL Editor

-- 1. Add files column to history and documentations tables
ALTER TABLE public.history
ADD COLUMN IF NOT EXISTS files JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.documentations
ADD COLUMN IF NOT EXISTS files JSONB DEFAULT '[]'::jsonb;

-- =========================================
-- HISTORY FILES BUCKET
-- =========================================

-- 2. Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('history-files', 'history-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Create policy to allow reading
CREATE POLICY "Public Read Access for History Files"
ON storage.objects FOR SELECT
USING ( bucket_id = 'history-files' );

-- 4. Create policy to allow uploading
CREATE POLICY "Allow Uploads for History Files"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'history-files' );

-- 5. Create policy to allow deleting
CREATE POLICY "Allow Deletes for History Files"
ON storage.objects FOR DELETE
USING ( bucket_id = 'history-files' );


-- =========================================
-- DOCUMENTATION FILES BUCKET
-- =========================================

-- 6. Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('doc-files', 'doc-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 7. Create policy to allow reading
CREATE POLICY "Public Read Access for Documentation Files"
ON storage.objects FOR SELECT
USING ( bucket_id = 'doc-files' );

-- 8. Create policy to allow uploading
CREATE POLICY "Allow Uploads for Documentation Files"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'doc-files' );

-- 9. Create policy to allow deleting
CREATE POLICY "Allow Deletes for Documentation Files"
ON storage.objects FOR DELETE
USING ( bucket_id = 'doc-files' );
