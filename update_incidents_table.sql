-- =====================================================
-- Update incidents table with all missing columns
-- =====================================================
-- Run this in Supabase SQL Editor to update the incidents table

-- Add all missing columns to incidents table
ALTER TABLE incidents
ADD COLUMN IF NOT EXISTS team TEXT,
ADD COLUMN IF NOT EXISTS team_other TEXT,
ADD COLUMN IF NOT EXISTS date DATE,
ADD COLUMN IF NOT EXISTS time_of_call TEXT,
ADD COLUMN IF NOT EXISTS time_of_arrival_at_scene TEXT,
ADD COLUMN IF NOT EXISTS time_of_departure_at_scene TEXT,
ADD COLUMN IF NOT EXISTS time_of_arrival_at_hosp TEXT,
ADD COLUMN IF NOT EXISTS time_of_departure_at_hosp TEXT,
ADD COLUMN IF NOT EXISTS back_to_base TEXT,
ADD COLUMN IF NOT EXISTS place_of_incident TEXT,
ADD COLUMN IF NOT EXISTS nature_of_incident TEXT,
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS injury_illness_complaint TEXT,
ADD COLUMN IF NOT EXISTS vehicle TEXT,
ADD COLUMN IF NOT EXISTS vehicle_other TEXT,
ADD COLUMN IF NOT EXISTS helmet TEXT,
ADD COLUMN IF NOT EXISTS liquor TEXT,
ADD COLUMN IF NOT EXISTS action_given TEXT,
ADD COLUMN IF NOT EXISTS transfer_from TEXT,
ADD COLUMN IF NOT EXISTS transfer_to TEXT,
ADD COLUMN IF NOT EXISTS transfer_to_other TEXT,
ADD COLUMN IF NOT EXISTS ambulance TEXT,
ADD COLUMN IF NOT EXISTS refused_transfer BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS exact_place TEXT,
ADD COLUMN IF NOT EXISTS specific_location TEXT,
ADD COLUMN IF NOT EXISTS caller_name TEXT,
ADD COLUMN IF NOT EXISTS caller_contact TEXT,
ADD COLUMN IF NOT EXISTS casualties INTEGER,
ADD COLUMN IF NOT EXISTS fatalities INTEGER,
ADD COLUMN IF NOT EXISTS photos TEXT[];

-- Remove old columns that are no longer used
ALTER TABLE incidents
DROP COLUMN IF EXISTS incident_type,
DROP COLUMN IF EXISTS location,
DROP COLUMN IF EXISTS date_time;

COMMENT ON TABLE incidents IS 'Incident reports with detailed patient and response information';
