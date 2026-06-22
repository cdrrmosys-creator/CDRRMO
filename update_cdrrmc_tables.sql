-- Run this in your Supabase SQL Editor

-- 1. Add photos column to cdrrmc_meeting
ALTER TABLE public.cdrrmc_meeting
ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

-- 2. Add files column to cdrrmc_reso
ALTER TABLE public.cdrrmc_reso
ADD COLUMN IF NOT EXISTS files JSONB DEFAULT '[]'::jsonb;


-- =========================================
-- MEETING PHOTOS BUCKET
-- =========================================

-- 3. Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-photos', 'meeting-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. Create policy to allow reading
CREATE POLICY "Public Read Access for Meeting Photos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'meeting-photos' );

-- 5. Create policy to allow uploading
CREATE POLICY "Allow Uploads for Meeting Photos"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'meeting-photos' );

-- 6. Create policy to allow deleting
CREATE POLICY "Allow Deletes for Meeting Photos"
ON storage.objects FOR DELETE
USING ( bucket_id = 'meeting-photos' );


-- =========================================
-- RESOLUTION FILES BUCKET
-- =========================================

-- 7. Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('reso-files', 'reso-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 8. Create policy to allow reading
CREATE POLICY "Public Read Access for Reso Files"
ON storage.objects FOR SELECT
USING ( bucket_id = 'reso-files' );

-- 9. Create policy to allow uploading
CREATE POLICY "Allow Uploads for Reso Files"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'reso-files' );

-- 10. Create policy to allow deleting
CREATE POLICY "Allow Deletes for Reso Files"
ON storage.objects FOR DELETE
USING ( bucket_id = 'reso-files' );
