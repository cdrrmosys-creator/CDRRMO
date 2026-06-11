-- =====================================================
-- CDRRMO Recording System - Schema Update 02
-- =====================================================
-- Run this SQL in your Supabase SQL Editor to apply updates.

-- 1. Add avatar_url to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Create the "avatars" storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set up Storage Security Policies for "avatars" bucket
-- Allow public access to read the files
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated Users can upload avatars" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'avatars');

-- Allow authenticated users to update their avatars
CREATE POLICY "Authenticated Users can update avatars" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'avatars');

-- Allow authenticated users to delete avatars
CREATE POLICY "Authenticated Users can delete avatars" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'avatars');
