-- Update Incidents Table to match incidentRecordEntry.txt fields
-- You can run this script directly in your Supabase SQL Editor.

ALTER TABLE public.incidents
ADD COLUMN IF NOT EXISTS team text,
ADD COLUMN IF NOT EXISTS date date,
ADD COLUMN IF NOT EXISTS time_of_call text,
ADD COLUMN IF NOT EXISTS time_of_arrival_at_scene text,
ADD COLUMN IF NOT EXISTS time_of_departure_at_scene text,
ADD COLUMN IF NOT EXISTS time_of_arrival_at_hosp text,
ADD COLUMN IF NOT EXISTS time_of_departure_at_hosp text,
ADD COLUMN IF NOT EXISTS back_to_base text,
ADD COLUMN IF NOT EXISTS place_of_incident text,
ADD COLUMN IF NOT EXISTS nature_of_incident text,
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS age integer,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS injury_illness_complaint text,
ADD COLUMN IF NOT EXISTS vehicle text,
ADD COLUMN IF NOT EXISTS vehicle_other text,
ADD COLUMN IF NOT EXISTS helmet text,
ADD COLUMN IF NOT EXISTS liquor text,
ADD COLUMN IF NOT EXISTS action_given text,
ADD COLUMN IF NOT EXISTS transfer_from text,
ADD COLUMN IF NOT EXISTS transfer_to text,
ADD COLUMN IF NOT EXISTS transfer_to_other text,
ADD COLUMN IF NOT EXISTS ambulance text,
ADD COLUMN IF NOT EXISTS refused_transfer boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS exact_place text,
ADD COLUMN IF NOT EXISTS photos jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS severity text DEFAULT 'Low';

-- Drop old columns that are no longer used
ALTER TABLE public.incidents
DROP COLUMN IF EXISTS incident_type,
DROP COLUMN IF EXISTS location,
DROP COLUMN IF EXISTS date_time;
