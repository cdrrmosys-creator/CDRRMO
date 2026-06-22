-- Run this in your Supabase SQL Editor

-- 1. Create the cctv_documentations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.cctv_documentations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_id VARCHAR NOT NULL,
    report_title VARCHAR NOT NULL DEFAULT 'Weekly Report',
    date_start DATE NOT NULL DEFAULT CURRENT_DATE,
    date_end DATE NOT NULL DEFAULT CURRENT_DATE,
    prepared_by VARCHAR,
    summary TEXT,
    files JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CLEANUP: If you ran the old script, this removes the outdated columns
ALTER TABLE public.cctv_documentations 
  DROP COLUMN IF EXISTS incident_date,
  DROP COLUMN IF EXISTS location,
  DROP COLUMN IF EXISTS camera_id,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS requested_by,
  DROP COLUMN IF EXISTS status;

-- 3. Ensure the new columns exist (if the table was already created by the old script)
ALTER TABLE public.cctv_documentations 
  ADD COLUMN IF NOT EXISTS report_title VARCHAR NOT NULL DEFAULT 'Weekly Report',
  ADD COLUMN IF NOT EXISTS date_start DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS date_end DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS prepared_by VARCHAR,
  ADD COLUMN IF NOT EXISTS summary TEXT;

-- =========================================
-- CCTV FILES BUCKET
-- =========================================

-- 4. Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('cctv-files', 'cctv-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 5. Create policy to allow reading
CREATE POLICY "Public Read Access for CCTV Files"
ON storage.objects FOR SELECT
USING ( bucket_id = 'cctv-files' );

-- 6. Create policy to allow uploading
CREATE POLICY "Allow Uploads for CCTV Files"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'cctv-files' );

-- 7. Create policy to allow deleting
CREATE POLICY "Allow Deletes for CCTV Files"
ON storage.objects FOR DELETE
USING ( bucket_id = 'cctv-files' );
