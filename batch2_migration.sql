-- ============================================================
-- BATCH 2 SQL MIGRATION — Volunteers & Training
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Volunteers table — add 7 missing fields
ALTER TABLE public.volunteers
  ADD COLUMN IF NOT EXISTS birthdate              date,
  ADD COLUMN IF NOT EXISTS address               text,
  ADD COLUMN IF NOT EXISTS contact_no            text,
  ADD COLUMN IF NOT EXISTS civil_status          text,
  ADD COLUMN IF NOT EXISTS blood_type            text,
  ADD COLUMN IF NOT EXISTS emergency_contact_person text,
  ADD COLUMN IF NOT EXISTS emergency_contact_no  text;

-- 2. Training Attended — add date_end, change attendees to jsonb participants
ALTER TABLE public.training_attended
  ADD COLUMN IF NOT EXISTS date_end       date,
  ADD COLUMN IF NOT EXISTS participants   jsonb DEFAULT '[]'::jsonb;

-- Backfill: move existing attendees text into participants as a single name entry
UPDATE public.training_attended
SET participants = jsonb_build_array(jsonb_build_object('name', attendees))
WHERE attendees IS NOT NULL AND attendees != '' AND participants = '[]'::jsonb;

-- 3. Training Conducted — add participants jsonb (structured table)
ALTER TABLE public.training_conducted
  ADD COLUMN IF NOT EXISTS participants_data jsonb DEFAULT '[]'::jsonb;

-- Backfill old participants text into participants_data
UPDATE public.training_conducted
SET participants_data = jsonb_build_array(jsonb_build_object('name', participants))
WHERE participants IS NOT NULL AND participants != '' AND participants_data = '[]'::jsonb;
