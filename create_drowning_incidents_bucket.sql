    -- Run this in your Supabase SQL Editor to create the drowning-incidents storage bucket

    -- =========================================
    -- DROWNING INCIDENTS PHOTOS BUCKET
    -- =========================================

    -- 1. Create the bucket
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('drowning-incidents', 'drowning-incidents', true)
    ON CONFLICT (id) DO UPDATE SET public = true;

    -- 2. Create policy to allow public read access
    CREATE POLICY "Public Read Access for Drowning Incident Photos"
    ON storage.objects FOR SELECT
    USING ( bucket_id = 'drowning-incidents' );

    -- 3. Create policy to allow uploading photos
    CREATE POLICY "Allow Uploads for Drowning Incident Photos"
    ON storage.objects FOR INSERT
    WITH CHECK ( bucket_id = 'drowning-incidents' );

    -- 4. Create policy to allow deleting photos
    CREATE POLICY "Allow Deletes for Drowning Incident Photos"
    ON storage.objects FOR DELETE
    USING ( bucket_id = 'drowning-incidents' );

    -- Verify the bucket was created
    SELECT * FROM storage.buckets WHERE id = 'drowning-incidents';
