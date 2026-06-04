-- =====================================================
-- CLEANUP SCRIPT - Run this FIRST if you get errors
-- This will drop all existing tables and policies
-- =====================================================

-- WARNING: This will DELETE ALL DATA in these tables!
-- Only run this if you want to start fresh

-- Drop all policies first
DROP POLICY IF EXISTS "Allow authenticated read access" ON employees CASCADE;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON employees CASCADE;
DROP POLICY IF EXISTS "Allow authenticated update access" ON employees CASCADE;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON employees CASCADE;

DROP POLICY IF EXISTS "Allow authenticated read access" ON incidents CASCADE;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON incidents CASCADE;

DROP POLICY IF EXISTS "Allow authenticated read access" ON vouchers CASCADE;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON vouchers CASCADE;

DROP POLICY IF EXISTS "Allow authenticated read access" ON inventory CASCADE;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON inventory CASCADE;

DROP POLICY IF EXISTS "Allow authenticated read access" ON transport CASCADE;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON transport CASCADE;

DROP POLICY IF EXISTS "Allow authenticated read access" ON venues CASCADE;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON venues CASCADE;

DROP POLICY IF EXISTS "Allow authenticated read access" ON activities CASCADE;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON activities CASCADE;

DROP POLICY IF EXISTS "Allow authenticated read access" ON events_assistance CASCADE;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON events_assistance CASCADE;

DROP POLICY IF EXISTS "Allow authenticated read access" ON training_attended CASCADE;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON training_attended CASCADE;

DROP POLICY IF EXISTS "Allow authenticated read access" ON training_conducted CASCADE;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON training_conducted CASCADE;

DROP POLICY IF EXISTS "Allow authenticated read access" ON volunteers CASCADE;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON volunteers CASCADE;

DROP POLICY IF EXISTS "Allow authenticated read access" ON cdrrmc_reso CASCADE;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON cdrrmc_reso CASCADE;

DROP POLICY IF EXISTS "Allow authenticated read access" ON cdrrmc_meeting CASCADE;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON cdrrmc_meeting CASCADE;

DROP POLICY IF EXISTS "Allow authenticated read access" ON maps_available CASCADE;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON maps_available CASCADE;

DROP POLICY IF EXISTS "Allow authenticated read access" ON pruning_trimming CASCADE;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON pruning_trimming CASCADE;

DROP POLICY IF EXISTS "Allow authenticated read access" ON history CASCADE;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON history CASCADE;

DROP POLICY IF EXISTS "Allow authenticated read access" ON documentations CASCADE;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON documentations CASCADE;

DROP POLICY IF EXISTS "Allow authenticated read access" ON calendar_events CASCADE;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON calendar_events CASCADE;

DROP POLICY IF EXISTS "Allow authenticated read access" ON vehicles CASCADE;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON vehicles CASCADE;
DROP POLICY IF EXISTS "Allow authenticated update access" ON vehicles CASCADE;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON vehicles CASCADE;

DROP POLICY IF EXISTS "Allow authenticated read access" ON drivers CASCADE;
DROP POLICY IF EXISTS "Allow authenticated insert access" ON drivers CASCADE;
DROP POLICY IF EXISTS "Allow authenticated update access" ON drivers CASCADE;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON drivers CASCADE;

-- Drop all tables
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS incidents CASCADE;
DROP TABLE IF EXISTS vouchers CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS transport CASCADE;
DROP TABLE IF EXISTS venues CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS events_assistance CASCADE;
DROP TABLE IF EXISTS training_attended CASCADE;
DROP TABLE IF EXISTS training_conducted CASCADE;
DROP TABLE IF EXISTS volunteers CASCADE;
DROP TABLE IF EXISTS cdrrmc_reso CASCADE;
DROP TABLE IF EXISTS cdrrmc_meeting CASCADE;
DROP TABLE IF EXISTS maps_available CASCADE;
DROP TABLE IF EXISTS pruning_trimming CASCADE;
DROP TABLE IF EXISTS history CASCADE;
DROP TABLE IF EXISTS documentations CASCADE;
DROP TABLE IF EXISTS calendar_events CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS drivers CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE 'Cleanup complete! Now run schema.sql to recreate tables.';
END $$;
