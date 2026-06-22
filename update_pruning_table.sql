-- Run this in your Supabase SQL Editor

-- 1. Add photos column to pruning_trimming
ALTER TABLE public.pruning_trimming
ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

-- =========================================
-- PRUNING PHOTOS BUCKET
-- =========================================

-- 2. Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('pruning-photos', 'pruning-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Create policy to allow reading
CREATE POLICY "Public Read Access for Pruning Photos"
ON storage.objects FOR SELECT
USING ( bucket_id = 'pruning-photos' );

-- 4. Create policy to allow uploading
CREATE POLICY "Allow Uploads for Pruning Photos"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'pruning-photos' );

-- 5. Create policy to allow deleting
CREATE POLICY "Allow Deletes for Pruning Photos"
ON storage.objects FOR DELETE
USING ( bucket_id = 'pruning-photos' );
