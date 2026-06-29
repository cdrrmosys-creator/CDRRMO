-- ============================================================
-- BATCH 3 SQL MIGRATION — Transport & Command Center
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Transport table — add patient info and responder fields
ALTER TABLE public.transport
  ADD COLUMN IF NOT EXISTS team              text,
  ADD COLUMN IF NOT EXISTS responder         text,
  ADD COLUMN IF NOT EXISTS patient_name      text,
  ADD COLUMN IF NOT EXISTS patient_age       text,
  ADD COLUMN IF NOT EXISTS patient_address   text,
  ADD COLUMN IF NOT EXISTS patient_contact   text,
  ADD COLUMN IF NOT EXISTS person_notified   text,
  ADD COLUMN IF NOT EXISTS emergency_contact text,
  ADD COLUMN IF NOT EXISTS injury_illness    text,
  ADD COLUMN IF NOT EXISTS action_given      text,
  ADD COLUMN IF NOT EXISTS others_specify    text,
  ADD COLUMN IF NOT EXISTS patients          jsonb DEFAULT '[]'::jsonb;

-- 2. CCTV/Command Center table — add all monthly report fields
ALTER TABLE public.cctv_documentations
  ADD COLUMN IF NOT EXISTS operator           text,
  ADD COLUMN IF NOT EXISTS asst_operator      text,
  ADD COLUMN IF NOT EXISTS client_name        text,
  ADD COLUMN IF NOT EXISTS client_contact     text,
  ADD COLUMN IF NOT EXISTS client_address     text,
  ADD COLUMN IF NOT EXISTS exact_place        text,
  ADD COLUMN IF NOT EXISTS nature_of_incident text,
  ADD COLUMN IF NOT EXISTS time_of_incident   text,
  ADD COLUMN IF NOT EXISTS others             text;
