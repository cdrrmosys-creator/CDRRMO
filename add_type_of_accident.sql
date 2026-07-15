-- Migration: Add type_of_accident column to incidents table
-- Run this in your Supabase SQL Editor

ALTER TABLE incidents
ADD COLUMN IF NOT EXISTS type_of_accident TEXT;
