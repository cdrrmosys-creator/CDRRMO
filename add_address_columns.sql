-- Add structured address columns to employees table
-- Run this once in Supabase SQL editor.

alter table public.employees
  add column if not exists addr_province      text default '',
  add column if not exists addr_province_code text default '',
  add column if not exists addr_city          text default '',
  add column if not exists addr_city_code     text default '',
  add column if not exists addr_barangay      text default '',
  add column if not exists addr_barangay_code text default '',
  add column if not exists addr_street        text default '';
