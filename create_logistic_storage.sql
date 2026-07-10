-- ============================================================
-- Storage Bucket: logistic-returns
-- Purpose: Store photo evidence of returned borrowed items
-- Run this in Supabase SQL Editor AFTER creating the logistic table
-- ============================================================

-- Create the bucket (public so photos can be viewed without auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('logistic-returns', 'logistic-returns', true)
ON CONFLICT (id) DO NOTHING;

-- Allow any authenticated user to upload photos
DROP POLICY IF EXISTS "Allow authenticated uploads to logistic-returns" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to logistic-returns"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'logistic-returns');

-- Allow public read access (so photo URLs can be displayed)
DROP POLICY IF EXISTS "Allow public read from logistic-returns" ON storage.objects;
CREATE POLICY "Allow public read from logistic-returns"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'logistic-returns');

-- Allow authenticated users to update/replace their uploads
DROP POLICY IF EXISTS "Allow authenticated update in logistic-returns" ON storage.objects;
CREATE POLICY "Allow authenticated update in logistic-returns"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'logistic-returns');

-- Allow authenticated users to delete from this bucket
DROP POLICY IF EXISTS "Allow authenticated delete from logistic-returns" ON storage.objects;
CREATE POLICY "Allow authenticated delete from logistic-returns"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'logistic-returns');

-- ============================================================
-- If the logistic table already exists, add return_photo_url:
-- ============================================================
ALTER TABLE public.logistic
ADD COLUMN IF NOT EXISTS return_photo_url TEXT;

-- ============================================================
-- Recreate set_record_editor to automatically set updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION set_record_editor()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_by = get_current_user_email();
    NEW.updated_at = NOW();
    -- Preserve created_at and created_by during updates
    NEW.created_at = OLD.created_at;
    NEW.created_by = OLD.created_by;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists and recreate
DROP TRIGGER IF EXISTS trigger_set_logistic_editor ON public.logistic;
CREATE TRIGGER trigger_set_logistic_editor
BEFORE UPDATE ON public.logistic
FOR EACH ROW
EXECUTE FUNCTION set_record_editor();
