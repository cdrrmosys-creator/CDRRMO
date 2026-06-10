-- =========================================================================
-- RUN THIS SQL IN YOUR SUPABASE SQL EDITOR TO ENABLE EDIT/DELETE FOR ALL TABLES
-- =========================================================================

-- incidents
DROP POLICY IF EXISTS "Allow authenticated update access" ON incidents;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON incidents;
DROP POLICY IF EXISTS "Allow authenticated update" ON incidents;
DROP POLICY IF EXISTS "Allow authenticated delete" ON incidents;
CREATE POLICY "Allow authenticated update access" ON incidents FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete access" ON incidents FOR DELETE TO authenticated USING (true);

-- vouchers
DROP POLICY IF EXISTS "Allow authenticated update access" ON vouchers;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON vouchers;
DROP POLICY IF EXISTS "Allow authenticated update" ON vouchers;
DROP POLICY IF EXISTS "Allow authenticated delete" ON vouchers;
CREATE POLICY "Allow authenticated update access" ON vouchers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete access" ON vouchers FOR DELETE TO authenticated USING (true);

-- inventory
DROP POLICY IF EXISTS "Allow authenticated update access" ON inventory;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON inventory;
DROP POLICY IF EXISTS "Allow authenticated update" ON inventory;
DROP POLICY IF EXISTS "Allow authenticated delete" ON inventory;
CREATE POLICY "Allow authenticated update access" ON inventory FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete access" ON inventory FOR DELETE TO authenticated USING (true);

-- transport
DROP POLICY IF EXISTS "Allow authenticated update access" ON transport;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON transport;
DROP POLICY IF EXISTS "Allow authenticated update" ON transport;
DROP POLICY IF EXISTS "Allow authenticated delete" ON transport;
CREATE POLICY "Allow authenticated update access" ON transport FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete access" ON transport FOR DELETE TO authenticated USING (true);

-- venues
DROP POLICY IF EXISTS "Allow authenticated update access" ON venues;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON venues;
DROP POLICY IF EXISTS "Allow authenticated update" ON venues;
DROP POLICY IF EXISTS "Allow authenticated delete" ON venues;
CREATE POLICY "Allow authenticated update access" ON venues FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete access" ON venues FOR DELETE TO authenticated USING (true);

-- activities
DROP POLICY IF EXISTS "Allow authenticated update access" ON activities;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON activities;
DROP POLICY IF EXISTS "Allow authenticated update" ON activities;
DROP POLICY IF EXISTS "Allow authenticated delete" ON activities;
CREATE POLICY "Allow authenticated update access" ON activities FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete access" ON activities FOR DELETE TO authenticated USING (true);

-- events_assistance
DROP POLICY IF EXISTS "Allow authenticated update access" ON events_assistance;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON events_assistance;
DROP POLICY IF EXISTS "Allow authenticated update" ON events_assistance;
DROP POLICY IF EXISTS "Allow authenticated delete" ON events_assistance;
CREATE POLICY "Allow authenticated update access" ON events_assistance FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete access" ON events_assistance FOR DELETE TO authenticated USING (true);

-- training_attended
DROP POLICY IF EXISTS "Allow authenticated update access" ON training_attended;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON training_attended;
DROP POLICY IF EXISTS "Allow authenticated update" ON training_attended;
DROP POLICY IF EXISTS "Allow authenticated delete" ON training_attended;
CREATE POLICY "Allow authenticated update access" ON training_attended FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete access" ON training_attended FOR DELETE TO authenticated USING (true);

-- training_conducted
DROP POLICY IF EXISTS "Allow authenticated update access" ON training_conducted;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON training_conducted;
DROP POLICY IF EXISTS "Allow authenticated update" ON training_conducted;
DROP POLICY IF EXISTS "Allow authenticated delete" ON training_conducted;
CREATE POLICY "Allow authenticated update access" ON training_conducted FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete access" ON training_conducted FOR DELETE TO authenticated USING (true);

-- volunteers
DROP POLICY IF EXISTS "Allow authenticated update access" ON volunteers;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON volunteers;
DROP POLICY IF EXISTS "Allow authenticated update" ON volunteers;
DROP POLICY IF EXISTS "Allow authenticated delete" ON volunteers;
CREATE POLICY "Allow authenticated update access" ON volunteers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete access" ON volunteers FOR DELETE TO authenticated USING (true);

-- cdrrmc_reso
DROP POLICY IF EXISTS "Allow authenticated update access" ON cdrrmc_reso;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON cdrrmc_reso;
DROP POLICY IF EXISTS "Allow authenticated update" ON cdrrmc_reso;
DROP POLICY IF EXISTS "Allow authenticated delete" ON cdrrmc_reso;
CREATE POLICY "Allow authenticated update access" ON cdrrmc_reso FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete access" ON cdrrmc_reso FOR DELETE TO authenticated USING (true);

-- cdrrmc_meeting
DROP POLICY IF EXISTS "Allow authenticated update access" ON cdrrmc_meeting;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON cdrrmc_meeting;
DROP POLICY IF EXISTS "Allow authenticated update" ON cdrrmc_meeting;
DROP POLICY IF EXISTS "Allow authenticated delete" ON cdrrmc_meeting;
CREATE POLICY "Allow authenticated update access" ON cdrrmc_meeting FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete access" ON cdrrmc_meeting FOR DELETE TO authenticated USING (true);

-- maps_available
DROP POLICY IF EXISTS "Allow authenticated update access" ON maps_available;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON maps_available;
DROP POLICY IF EXISTS "Allow authenticated update" ON maps_available;
DROP POLICY IF EXISTS "Allow authenticated delete" ON maps_available;
CREATE POLICY "Allow authenticated update access" ON maps_available FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete access" ON maps_available FOR DELETE TO authenticated USING (true);

-- pruning_trimming
DROP POLICY IF EXISTS "Allow authenticated update access" ON pruning_trimming;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON pruning_trimming;
DROP POLICY IF EXISTS "Allow authenticated update" ON pruning_trimming;
DROP POLICY IF EXISTS "Allow authenticated delete" ON pruning_trimming;
CREATE POLICY "Allow authenticated update access" ON pruning_trimming FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete access" ON pruning_trimming FOR DELETE TO authenticated USING (true);

-- history
DROP POLICY IF EXISTS "Allow authenticated update access" ON history;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON history;
DROP POLICY IF EXISTS "Allow authenticated update" ON history;
DROP POLICY IF EXISTS "Allow authenticated delete" ON history;
CREATE POLICY "Allow authenticated update access" ON history FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete access" ON history FOR DELETE TO authenticated USING (true);

-- documentations
DROP POLICY IF EXISTS "Allow authenticated update access" ON documentations;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON documentations;
DROP POLICY IF EXISTS "Allow authenticated update" ON documentations;
DROP POLICY IF EXISTS "Allow authenticated delete" ON documentations;
CREATE POLICY "Allow authenticated update access" ON documentations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete access" ON documentations FOR DELETE TO authenticated USING (true);

-- calendar_events
DROP POLICY IF EXISTS "Allow authenticated update access" ON calendar_events;
DROP POLICY IF EXISTS "Allow authenticated delete access" ON calendar_events;
DROP POLICY IF EXISTS "Allow authenticated update" ON calendar_events;
DROP POLICY IF EXISTS "Allow authenticated delete" ON calendar_events;
CREATE POLICY "Allow authenticated update access" ON calendar_events FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete access" ON calendar_events FOR DELETE TO authenticated USING (true);
