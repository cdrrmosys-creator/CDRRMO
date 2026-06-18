-- Run this in your Supabase SQL Editor to automatically create the bucket and allow uploads!

-- 1. Create the bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('incidents', 'incidents', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Create policy to allow anyone to read the photos
CREATE POLICY "Public Read Access for Incidents"
ON storage.objects FOR SELECT
USING ( bucket_id = 'incidents' );

-- 3. Create policy to allow uploading photos
CREATE POLICY "Allow Uploads for Incidents"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'incidents' );

-- 4. Create policy to allow deleting photos (if you remove them)
CREATE POLICY "Allow Deletes for Incidents"
ON storage.objects FOR DELETE
USING ( bucket_id = 'incidents' );

-- =========================================
-- INVENTORY BUCKET
-- =========================================

-- 1. Create the inventory bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('inventory', 'inventory', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Create policy to allow anyone to read the inventory photos
CREATE POLICY "Public Read Access for Inventory"
ON storage.objects FOR SELECT
USING ( bucket_id = 'inventory' );

-- 3. Create policy to allow uploading inventory photos
CREATE POLICY "Allow Uploads for Inventory"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'inventory' );

-- 4. Create policy to allow deleting inventory photos
CREATE POLICY "Allow Deletes for Inventory"
ON storage.objects FOR DELETE
USING ( bucket_id = 'inventory' );
