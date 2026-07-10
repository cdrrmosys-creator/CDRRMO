-- Add updated_at tracking to all tables
-- This enables "Last edited" timestamp display in the UI

-- Temporarily disable ALL triggers to avoid conflicts
SET session_replication_role = replica;

-- Function to automatically set updated_at on UPDATE
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- List of all tables to add updated_at tracking
DO $$
DECLARE
  tbl_name TEXT;
  table_exists BOOLEAN;
  tables TEXT[] := ARRAY[
    'incidents',
    'drowning_incidents',
    'transport',
    'activities',
    'venues',
    'training_conducted',
    'training_attended',
    'training_registrations',
    'inventory',
    'vehicles',
    'drivers',
    'employees',
    'volunteers',
    'events_assistance',
    'pruning_trimming',
    'calendar_events',
    'vouchers',
    'cdrrmc_meeting',
    'cdrrmc_reso',
    'history',
    'cctv_documentations',
    'documentations',
    'drrm_office_training',
    'client_satisfaction'
  ];
BEGIN
  FOREACH tbl_name IN ARRAY tables
  LOOP
    -- Check if table exists
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = tbl_name
    ) INTO table_exists;
    
    IF NOT table_exists THEN
      RAISE NOTICE 'Table % does not exist, skipping...', tbl_name;
      CONTINUE;
    END IF;
    
    -- Add updated_at column
    EXECUTE format('
      ALTER TABLE %I 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ', tbl_name);
    
    -- Backfill updated_at with created_at for existing records
    -- Set them exactly equal so the UI won't show "edited"
    EXECUTE format('
      UPDATE %I 
      SET updated_at = created_at 
      WHERE updated_at IS NULL;
    ', tbl_name);
    
    -- Ensure timestamps are exactly identical by setting to the same value
    EXECUTE format('
      UPDATE %I 
      SET updated_at = created_at;
    ', tbl_name);
    
    -- Drop existing trigger if it exists
    EXECUTE format('
      DROP TRIGGER IF EXISTS trigger_set_%I_updated_at ON %I;
    ', tbl_name, tbl_name);
    
    -- Create trigger for setting updated_at on UPDATE
    EXECUTE format('
      CREATE TRIGGER trigger_set_%I_updated_at
      BEFORE UPDATE ON %I
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
    ', tbl_name, tbl_name);
    
    -- Add comment
    EXECUTE format('
      COMMENT ON COLUMN %I.updated_at IS ''Timestamp when this record was last modified'';
    ', tbl_name);
    
    RAISE NOTICE 'Added updated_at tracking to table: %', tbl_name;
  END LOOP;
END $$;

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION set_updated_at() TO authenticated;

-- Reload schema
NOTIFY pgrst, 'reload schema';
