-- Add status column to transport table (for dispatch status tracking)
-- Run this once in Supabase SQL editor.

alter table public.transport
  add column if not exists status text default 'Scheduled'::text;
