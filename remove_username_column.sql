-- Remove the username column from the employees table
-- Run this once in Supabase SQL editor.

alter table public.employees
  drop column if exists username;
