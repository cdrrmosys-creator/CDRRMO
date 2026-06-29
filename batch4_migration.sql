-- ============================================================
-- BATCH 4 SQL MIGRATION — Incidents + Drowning
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Incidents table — ensure all needed columns exist
ALTER TABLE public.incidents
  ADD COLUMN IF NOT EXISTS incident_type     text,
  ADD COLUMN IF NOT EXISTS specific_location text,
  ADD COLUMN IF NOT EXISTS latitude          numeric,
  ADD COLUMN IF NOT EXISTS longitude         numeric,
  ADD COLUMN IF NOT EXISTS caller_name       text,
  ADD COLUMN IF NOT EXISTS caller_contact    text,
  ADD COLUMN IF NOT EXISTS action_taken      text,
  ADD COLUMN IF NOT EXISTS casualties        integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fatalities        integer DEFAULT 0;

-- 2. Drowning Incidents — new table
CREATE TABLE IF NOT EXISTS public.drowning_incidents (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_id         text UNIQUE NOT NULL,
  date              date NOT NULL,
  time_of_incident  time,
  location          text,
  latitude          numeric,
  longitude         numeric,
  victim_name       text,
  victim_age        text,
  victim_gender     text,
  victim_address    text,
  water_body        text,
  cause             text,
  response_time     text,
  responders        text,
  outcome           text,
  remarks           text,
  photos            jsonb DEFAULT '[]'::jsonb,
  created_at        timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.drowning_incidents ENABLE ROW LEVEL SECURITY;

-- RLS policies (adjust based on your auth setup)
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.drowning_incidents;
CREATE POLICY "Allow all for authenticated" ON public.drowning_incidents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
