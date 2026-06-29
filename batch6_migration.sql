-- ============================================================
-- BATCH 6 SQL MIGRATION — Descriptions and Documentations
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Events Assistance
ALTER TABLE public.events_assistance
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS remarks text;

-- 2. CDRRMO Activities (ensure description exists)
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS description text;

-- 3. Transport (ensure descriptions/remarks exist)
ALTER TABLE public.transport
  ADD COLUMN IF NOT EXISTS description text;

-- 4. Venues (ensure description exists)
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS description text;
