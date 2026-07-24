-- Batch 7 Migration: Create employee_attendance table
CREATE TABLE IF NOT EXISTS public.employee_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id TEXT,
  employee_id TEXT,
  employee_name TEXT,
  designation TEXT,
  office TEXT,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Present',
  duty_status TEXT DEFAULT 'On Duty',
  remarks TEXT,
  time_in TIME,
  time_out TIME,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.employee_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for all users" ON public.employee_attendance
  FOR ALL USING (true) WITH CHECK (true);
