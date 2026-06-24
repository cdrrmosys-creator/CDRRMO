-- ─────────────────────────────────────────────────────────────────
-- Add new profile columns to the employees table
-- Run this once in Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────

alter table public.employees
  add column if not exists sex                      text,
  add column if not exists emergency_contact_person text,
  add column if not exists emergency_contact_no     text,
  add column if not exists medical_condition        text,
  add column if not exists elementary               text,
  add column if not exists highschool               text,
  add column if not exists college                  text,
  add column if not exists eligibility              text,
  add column if not exists father_name              text,
  add column if not exists mother_name              text,
  add column if not exists spouse_name              text,
  add column if not exists children                 jsonb default '[]'::jsonb,
  add column if not exists work_experience          jsonb default '[]'::jsonb,
  add column if not exists trainings_attended       jsonb default '[]'::jsonb;
