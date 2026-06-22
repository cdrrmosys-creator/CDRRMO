-- Run this in your Supabase SQL Editor

-- 1. Add new columns to the transport table
ALTER TABLE public.transport
ADD COLUMN IF NOT EXISTS contact_person TEXT,
ADD COLUMN IF NOT EXISTS remarks TEXT,
ADD COLUMN IF NOT EXISTS is_rescheduled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reschedule_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

-- 2. Create the transport-photos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('transport-photos', 'transport-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Create policy to allow anyone to read the photos
CREATE POLICY "Public Read Access for Transport Photos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'transport-photos' );

-- 4. Create policy to allow uploading photos
CREATE POLICY "Allow Uploads for Transport Photos"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'transport-photos' );

-- 5. Create policy to allow deleting photos
CREATE POLICY "Allow Deletes for Transport Photos"
ON storage.objects FOR DELETE
USING ( bucket_id = 'transport-photos' );
