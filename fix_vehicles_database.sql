-- 1. Ensure the new columns exist (just in case)
ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS orcr TEXT,
ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}';

-- 2. Fix Vehicles Table RLS Policies
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated insert access" ON public.vehicles;
DROP POLICY IF EXISTS "Allow authenticated update access" ON public.vehicles;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON public.vehicles;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.vehicles;

CREATE POLICY "Allow authenticated insert access" ON public.vehicles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update access" ON public.vehicles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete access" ON public.vehicles FOR DELETE TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access" ON public.vehicles FOR SELECT TO authenticated USING (true);

-- 3. Ensure the Storage Bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicles', 'vehicles', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. Fix Storage RLS Policies for the 'vehicles' bucket
DROP POLICY IF EXISTS "vehicles_public_read" ON storage.objects;
DROP POLICY IF EXISTS "vehicles_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "vehicles_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "vehicles_auth_delete" ON storage.objects;

CREATE POLICY "vehicles_public_read" ON storage.objects FOR SELECT TO public USING (bucket_id = 'vehicles');
CREATE POLICY "vehicles_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'vehicles');
CREATE POLICY "vehicles_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'vehicles');
CREATE POLICY "vehicles_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'vehicles');
