-- =====================================================
-- QUICK RESET - One-Command Database Reset
-- =====================================================
-- This will:
-- 1. Drop all existing CDRRMO tables and policies
-- 2. Recreate all tables fresh
-- 3. Set up all security policies
--
-- COPY AND RUN THIS ENTIRE FILE IN SUPABASE SQL EDITOR
-- =====================================================

-- Step 1: Drop all policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%') 
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END $$;

-- Step 2: Recreate extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 3: Create all tables

-- EMPLOYEES
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  designation TEXT,
  email TEXT,
  contact TEXT,
  duty_status TEXT DEFAULT 'Off Duty',
  photo TEXT,
  dob DATE,
  pob TEXT,
  civil_status TEXT,
  blood_type TEXT,
  address TEXT,
  height TEXT,
  weight TEXT,
  waist TEXT,
  shirt_size TEXT,
  shoe_size TEXT,
  father_name TEXT,
  mother_name TEXT,
  spouse_name TEXT,
  office TEXT,
  tin TEXT,
  pagibig TEXT,
  sss TEXT,
  gsis TEXT,
  philhealth TEXT,
  education TEXT,
  department TEXT,
  joined TEXT,
  duties JSONB DEFAULT '[]'::jsonb,
  seminars JSONB DEFAULT '[]'::jsonb,
  trainings JSONB DEFAULT '[]'::jsonb,
  children JSONB DEFAULT '[]'::jsonb,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INCIDENTS
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT UNIQUE NOT NULL,
  incident_type TEXT NOT NULL,
  location TEXT NOT NULL,
  date_time TIMESTAMP WITH TIME ZONE NOT NULL,
  severity TEXT NOT NULL,
  remarks TEXT,
  saved_at TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- VOUCHERS
CREATE TABLE vouchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT UNIQUE NOT NULL,
  beneficiary_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  purpose TEXT NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL,
  saved_at TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INVENTORY
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT UNIQUE NOT NULL,
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  condition TEXT NOT NULL,
  date_acquired DATE NOT NULL,
  saved_at TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TRANSPORT
CREATE TABLE transport (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT UNIQUE NOT NULL,
  vehicle TEXT NOT NULL,
  driver TEXT NOT NULL,
  destination TEXT NOT NULL,
  date_time TIMESTAMP WITH TIME ZONE NOT NULL,
  purpose TEXT,
  saved_at TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- VENUES
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT UNIQUE NOT NULL,
  facility_name TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  purpose TEXT,
  booked_by TEXT NOT NULL,
  saved_at TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ACTIVITIES
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT UNIQUE NOT NULL,
  activity_title TEXT NOT NULL,
  date DATE NOT NULL,
  location TEXT,
  participants INTEGER,
  description TEXT,
  saved_at TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- EVENTS_ASSISTANCE
CREATE TABLE events_assistance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT UNIQUE NOT NULL,
  event_name TEXT NOT NULL,
  date DATE NOT NULL,
  location TEXT,
  type_of_assistance TEXT NOT NULL,
  requestor TEXT,
  saved_at TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TRAINING_ATTENDED
CREATE TABLE training_attended (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT UNIQUE NOT NULL,
  training_title TEXT NOT NULL,
  date DATE NOT NULL,
  venue TEXT,
  conducted_by TEXT,
  attendees TEXT,
  saved_at TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TRAINING_CONDUCTED
CREATE TABLE training_conducted (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT UNIQUE NOT NULL,
  training_title TEXT NOT NULL,
  date DATE NOT NULL,
  venue TEXT,
  facilitator TEXT,
  participants TEXT,
  saved_at TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- VOLUNTEERS
CREATE TABLE volunteers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT UNIQUE NOT NULL,
  volunteer_name TEXT NOT NULL,
  organization TEXT,
  accreditation_no TEXT NOT NULL,
  date DATE,
  status TEXT,
  saved_at TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CDRRMC_RESO
CREATE TABLE cdrrmc_reso (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT UNIQUE NOT NULL,
  resolution_no TEXT NOT NULL,
  title TEXT NOT NULL,
  date_passed DATE NOT NULL,
  description TEXT,
  saved_at TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CDRRMC_MEETING
CREATE TABLE cdrrmc_meeting (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT UNIQUE NOT NULL,
  meeting_no TEXT NOT NULL,
  date DATE NOT NULL,
  agenda TEXT NOT NULL,
  attendees TEXT,
  minutes_summary TEXT,
  saved_at TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MAPS_AVAILABLE
CREATE TABLE maps_available (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT UNIQUE NOT NULL,
  map_title TEXT NOT NULL,
  type TEXT,
  coverage_area TEXT,
  date_updated DATE,
  file_url TEXT,
  saved_at TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PRUNING_TRIMMING
CREATE TABLE pruning_trimming (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT UNIQUE NOT NULL,
  location TEXT NOT NULL,
  date DATE NOT NULL,
  trees_pruned INTEGER,
  conducted_by TEXT,
  remarks TEXT,
  saved_at TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- HISTORY
CREATE TABLE history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT UNIQUE NOT NULL,
  event_title TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  saved_at TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DOCUMENTATIONS
CREATE TABLE documentations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT UNIQUE NOT NULL,
  document_title TEXT NOT NULL,
  date DATE NOT NULL,
  type TEXT,
  description TEXT,
  file_url TEXT,
  saved_at TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CALENDAR_EVENTS
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  record_id TEXT UNIQUE NOT NULL,
  event_title TEXT NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  saved_at TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- VEHICLES
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vehicle_id TEXT UNIQUE NOT NULL,
  plate TEXT NOT NULL,
  model TEXT NOT NULL,
  manufacturer TEXT,
  year TEXT,
  type TEXT,
  capacity TEXT,
  status TEXT DEFAULT 'Available',
  last_maintenance DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DRIVERS
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  license_no TEXT,
  license_expiry DATE,
  contact TEXT,
  status TEXT DEFAULT 'Available',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create indexes
CREATE INDEX idx_employees_employee_id ON employees(employee_id);
CREATE INDEX idx_employees_username ON employees(username);
CREATE INDEX idx_incidents_date_time ON incidents(date_time DESC);
CREATE INDEX idx_vouchers_date ON vouchers(date DESC);
CREATE INDEX idx_inventory_category ON inventory(category);
CREATE INDEX idx_transport_date_time ON transport(date_time DESC);
CREATE INDEX idx_vehicles_vehicle_id ON vehicles(vehicle_id);
CREATE INDEX idx_drivers_driver_id ON drivers(driver_id);

-- Step 5: Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE events_assistance ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_attended ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_conducted ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdrrmc_reso ENABLE ROW LEVEL SECURITY;
ALTER TABLE cdrrmc_meeting ENABLE ROW LEVEL SECURITY;
ALTER TABLE maps_available ENABLE ROW LEVEL SECURITY;
ALTER TABLE pruning_trimming ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- Step 6: Create policies (READ)
CREATE POLICY "Allow authenticated read" ON employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON incidents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON vouchers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON transport FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON venues FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON events_assistance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON training_attended FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON training_conducted FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON volunteers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON cdrrmc_reso FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON cdrrmc_meeting FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON maps_available FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON pruning_trimming FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON documentations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON calendar_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON drivers FOR SELECT TO authenticated USING (true);

-- Step 7: Create policies (INSERT/UPDATE/DELETE)
CREATE POLICY "Allow authenticated insert" ON employees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON employees FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON employees FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON incidents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON incidents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON incidents FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON vouchers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON vouchers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON vouchers FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON inventory FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON inventory FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON inventory FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON transport FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON transport FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON transport FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON venues FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON venues FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON venues FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON activities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON activities FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON activities FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON events_assistance FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON events_assistance FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON events_assistance FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON training_attended FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON training_attended FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON training_attended FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON training_conducted FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON training_conducted FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON training_conducted FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON volunteers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON volunteers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON volunteers FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON cdrrmc_reso FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON cdrrmc_reso FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON cdrrmc_reso FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON cdrrmc_meeting FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON cdrrmc_meeting FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON cdrrmc_meeting FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON maps_available FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON maps_available FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON maps_available FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON pruning_trimming FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON pruning_trimming FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON pruning_trimming FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON history FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON history FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON documentations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON documentations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON documentations FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON calendar_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON calendar_events FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON calendar_events FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON vehicles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON vehicles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON vehicles FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert" ON drivers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON drivers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete" ON drivers FOR DELETE TO authenticated USING (true);

-- Step 8: Create trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 9: Create triggers
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle auto-creation of employee when user registers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_emp_id TEXT;
  base_username TEXT;
  final_username TEXT;
  username_suffix INT := 1;
BEGIN
  -- Generate a unique employee_id in the format: EMP-YYYY-XXXX (where XXXX is a random 4-digit number)
  LOOP
    new_emp_id := 'EMP-' || to_char(now(), 'YYYY') || '-' || floor(random() * 9000 + 1000)::text;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.employees WHERE employee_id = new_emp_id);
  END LOOP;

  -- Generate a unique username from email
  base_username := COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  final_username := base_username;
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.employees WHERE username = final_username);
    final_username := base_username || username_suffix::text;
    username_suffix := username_suffix + 1;
  END LOOP;

  -- Only create employee if not created via app form to avoid duplicates
  IF COALESCE(new.raw_user_meta_data->>'created_via_app', 'false') <> 'true' THEN
    INSERT INTO public.employees (
      id,
      employee_id,
      name,
      username,
      email,
      designation,
      duty_status,
      created_at,
      updated_at
    )
    VALUES (
      new.id,
      new_emp_id,
      COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
      final_username,
      new.email,
      COALESCE(new.raw_user_meta_data->>'designation', 'Staff'),
      'Off Duty',
      NOW(),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute the function on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- Step 10: Sample data
INSERT INTO employees (employee_id, name, username, designation, email, contact, duty_status)
VALUES ('EMP-2026-001', 'Admin User', 'admin', 'Administrator', 'admin@cdrrmo.gov.ph', '0917-000-0000', 'On Duty')
ON CONFLICT (employee_id) DO NOTHING;

-- Success!
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Database reset complete! All 21 tables created successfully.';
END $$;
