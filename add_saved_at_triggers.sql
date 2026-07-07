-- ============================================================
-- Trigger function: sets saved_at = NOW() on every INSERT and UPDATE
-- ============================================================
CREATE OR REPLACE FUNCTION set_saved_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.saved_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Apply trigger to every table that has a saved_at column.
-- Each block is idempotent (DROP IF EXISTS before CREATE).
-- ============================================================

-- vouchers (already existed, recreate to cover INSERT too)
DROP TRIGGER IF EXISTS trg_saved_at_vouchers ON vouchers;
CREATE TRIGGER trg_saved_at_vouchers
BEFORE INSERT OR UPDATE ON vouchers
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- volunteers
DROP TRIGGER IF EXISTS trg_saved_at_volunteers ON volunteers;
CREATE TRIGGER trg_saved_at_volunteers
BEFORE INSERT OR UPDATE ON volunteers
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- venues
DROP TRIGGER IF EXISTS trg_saved_at_venues ON venues;
CREATE TRIGGER trg_saved_at_venues
BEFORE INSERT OR UPDATE ON venues
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- vehicles
DROP TRIGGER IF EXISTS trg_saved_at_vehicles ON vehicles;
CREATE TRIGGER trg_saved_at_vehicles
BEFORE INSERT OR UPDATE ON vehicles
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- transport
DROP TRIGGER IF EXISTS trg_saved_at_transport ON transport;
CREATE TRIGGER trg_saved_at_transport
BEFORE INSERT OR UPDATE ON transport
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- training_conducted
DROP TRIGGER IF EXISTS trg_saved_at_training_conducted ON training_conducted;
CREATE TRIGGER trg_saved_at_training_conducted
BEFORE INSERT OR UPDATE ON training_conducted
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- training_attended
DROP TRIGGER IF EXISTS trg_saved_at_training_attended ON training_attended;
CREATE TRIGGER trg_saved_at_training_attended
BEFORE INSERT OR UPDATE ON training_attended
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- training_registrations
DROP TRIGGER IF EXISTS trg_saved_at_training_registrations ON training_registrations;
CREATE TRIGGER trg_saved_at_training_registrations
BEFORE INSERT OR UPDATE ON training_registrations
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- pruning_trimming
DROP TRIGGER IF EXISTS trg_saved_at_pruning_trimming ON pruning_trimming;
CREATE TRIGGER trg_saved_at_pruning_trimming
BEFORE INSERT OR UPDATE ON pruning_trimming
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- maps_available
DROP TRIGGER IF EXISTS trg_saved_at_maps_available ON maps_available;
CREATE TRIGGER trg_saved_at_maps_available
BEFORE INSERT OR UPDATE ON maps_available
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- inventory
DROP TRIGGER IF EXISTS trg_saved_at_inventory ON inventory;
CREATE TRIGGER trg_saved_at_inventory
BEFORE INSERT OR UPDATE ON inventory
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- incidents
DROP TRIGGER IF EXISTS trg_saved_at_incidents ON incidents;
CREATE TRIGGER trg_saved_at_incidents
BEFORE INSERT OR UPDATE ON incidents
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- history
DROP TRIGGER IF EXISTS trg_saved_at_history ON history;
CREATE TRIGGER trg_saved_at_history
BEFORE INSERT OR UPDATE ON history
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- events_assistance
DROP TRIGGER IF EXISTS trg_saved_at_events_assistance ON events_assistance;
CREATE TRIGGER trg_saved_at_events_assistance
BEFORE INSERT OR UPDATE ON events_assistance
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- employees
DROP TRIGGER IF EXISTS trg_saved_at_employees ON employees;
CREATE TRIGGER trg_saved_at_employees
BEFORE INSERT OR UPDATE ON employees
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- drowning_incidents
DROP TRIGGER IF EXISTS trg_saved_at_drowning_incidents ON drowning_incidents;
CREATE TRIGGER trg_saved_at_drowning_incidents
BEFORE INSERT OR UPDATE ON drowning_incidents
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- drivers
DROP TRIGGER IF EXISTS trg_saved_at_drivers ON drivers;
CREATE TRIGGER trg_saved_at_drivers
BEFORE INSERT OR UPDATE ON drivers
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- documentations
DROP TRIGGER IF EXISTS trg_saved_at_documentations ON documentations;
CREATE TRIGGER trg_saved_at_documentations
BEFORE INSERT OR UPDATE ON documentations
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- drrm_office_training
DROP TRIGGER IF EXISTS trg_saved_at_drrm_office_training ON drrm_office_training;
CREATE TRIGGER trg_saved_at_drrm_office_training
BEFORE INSERT OR UPDATE ON drrm_office_training
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- client_satisfaction
DROP TRIGGER IF EXISTS trg_saved_at_client_satisfaction ON client_satisfaction;
CREATE TRIGGER trg_saved_at_client_satisfaction
BEFORE INSERT OR UPDATE ON client_satisfaction
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- cdrrmc_reso
DROP TRIGGER IF EXISTS trg_saved_at_cdrrmc_reso ON cdrrmc_reso;
CREATE TRIGGER trg_saved_at_cdrrmc_reso
BEFORE INSERT OR UPDATE ON cdrrmc_reso
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- cdrrmc_meeting
DROP TRIGGER IF EXISTS trg_saved_at_cdrrmc_meeting ON cdrrmc_meeting;
CREATE TRIGGER trg_saved_at_cdrrmc_meeting
BEFORE INSERT OR UPDATE ON cdrrmc_meeting
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- cctv_documentations
DROP TRIGGER IF EXISTS trg_saved_at_cctv_documentations ON cctv_documentations;
CREATE TRIGGER trg_saved_at_cctv_documentations
BEFORE INSERT OR UPDATE ON cctv_documentations
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- calendar_events
DROP TRIGGER IF EXISTS trg_saved_at_calendar_events ON calendar_events;
CREATE TRIGGER trg_saved_at_calendar_events
BEFORE INSERT OR UPDATE ON calendar_events
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

-- activities
DROP TRIGGER IF EXISTS trg_saved_at_activities ON activities;
CREATE TRIGGER trg_saved_at_activities
BEFORE INSERT OR UPDATE ON activities
FOR EACH ROW EXECUTE FUNCTION set_saved_at();
