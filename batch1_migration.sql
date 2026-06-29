-- ============================================================
-- BATCH 1 SQL MIGRATION — Quick Field Additions
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Pruning table — add status and date_of_request
ALTER TABLE public.pruning_trimming
  ADD COLUMN IF NOT EXISTS status        text NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'In Progress', 'Completed')),
  ADD COLUMN IF NOT EXISTS date_of_request date;

-- Backfill: treat existing date as date_of_request
UPDATE public.pruning_trimming SET date_of_request = date::date WHERE date_of_request IS NULL;

-- 2. Venues table — add conducted_by and end_date (inclusive date range)
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS conducted_by text,
  ADD COLUMN IF NOT EXISTS end_date     date;

-- 3. History table — add disaster type fields and statistics
ALTER TABLE public.history
  ADD COLUMN IF NOT EXISTS disaster_type       text,
  ADD COLUMN IF NOT EXISTS casualties          integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evacuees            integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS affected_families   integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damage_cost         numeric(15,2) DEFAULT 0;

-- Backfill disaster_type from old category column (if exists)
UPDATE public.history SET disaster_type = category WHERE disaster_type IS NULL AND category IS NOT NULL;
