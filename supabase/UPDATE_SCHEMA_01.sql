-- =====================================================
-- CDRRMO Recording System - Schema Update 01
-- =====================================================
-- Run this SQL in your Supabase SQL Editor to apply updates.

-- 1. Fix documentations table
ALTER TABLE documentations RENAME COLUMN document_title TO title;
ALTER TABLE documentations RENAME COLUMN type TO document_type;
ALTER TABLE documentations RENAME COLUMN date TO date_filed;
ALTER TABLE documentations ADD COLUMN filed_by TEXT;

-- 2. Fix calendar_events table
ALTER TABLE calendar_events RENAME COLUMN date TO start_date;
ALTER TABLE calendar_events RENAME COLUMN notes TO description;
ALTER TABLE calendar_events ADD COLUMN event_type TEXT;
ALTER TABLE calendar_events ADD COLUMN end_date DATE;
ALTER TABLE calendar_events ADD COLUMN location TEXT;
ALTER TABLE calendar_events ADD COLUMN organizer TEXT;

-- 3. Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  record_id TEXT,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated insert access" ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated read access" ON audit_logs FOR SELECT TO authenticated USING (true);
