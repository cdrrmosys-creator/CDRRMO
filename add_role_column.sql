-- Add role column to employees table
-- Run this once in Supabase SQL editor.

alter table public.employees
  add column if not exists role text default 'user';
