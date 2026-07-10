  -- Add creator and editor tracking to all tables
  -- This enables "Published by" and "Last edited by" functionality across all modules

  -- Temporarily disable ALL triggers to avoid conflicts
  SET session_replication_role = replica;

  -- Function to get current user's email from JWT
  CREATE OR REPLACE FUNCTION get_current_user_email()
  RETURNS TEXT AS $$
  BEGIN
    RETURN COALESCE(
      current_setting('request.jwt.claims', true)::json->>'email',
      'system@cdrrmo.local'
    );
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  -- Function to automatically set creator on INSERT
  CREATE OR REPLACE FUNCTION set_record_creator()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.created_by = get_current_user_email();
    NEW.updated_by = get_current_user_email();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  -- Function to automatically set editor on UPDATE
  CREATE OR REPLACE FUNCTION set_record_editor()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_by = get_current_user_email();
    -- Preserve created_at and created_by during updates
    NEW.created_at = OLD.created_at;
    NEW.created_by = OLD.created_by;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  -- List of all tables to add tracking
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
      -- Add created_by column
      EXECUTE format('
        ALTER TABLE %I 
        ADD COLUMN IF NOT EXISTS created_by TEXT;
      ', tbl_name);
      
      -- Add updated_by column
      EXECUTE format('
        ALTER TABLE %I 
        ADD COLUMN IF NOT EXISTS updated_by TEXT;
      ', tbl_name);
      
      -- Backfill created_by with system for existing records
      EXECUTE format('
        UPDATE %I 
        SET created_by = ''system@cdrrmo.local'' 
        WHERE created_by IS NULL;
      ', tbl_name);
      
      -- Backfill updated_by with system for existing records
      EXECUTE format('
        UPDATE %I 
        SET updated_by = ''system@cdrrmo.local'' 
        WHERE updated_by IS NULL;
      ', tbl_name);
      
      -- Drop existing triggers if they exist
      EXECUTE format('
        DROP TRIGGER IF EXISTS trigger_set_%I_creator ON %I;
      ', tbl_name, tbl_name);
      
      EXECUTE format('
        DROP TRIGGER IF EXISTS trigger_set_%I_editor ON %I;
      ', tbl_name, tbl_name);
      
      -- Create trigger for setting creator on INSERT
      EXECUTE format('
        CREATE TRIGGER trigger_set_%I_creator
        BEFORE INSERT ON %I
        FOR EACH ROW
        EXECUTE FUNCTION set_record_creator();
      ', tbl_name, tbl_name);
      
      -- Create trigger for setting editor on UPDATE
      EXECUTE format('
        CREATE TRIGGER trigger_set_%I_editor
        BEFORE UPDATE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION set_record_editor();
      ', tbl_name, tbl_name);
      
      -- Add comments
      EXECUTE format('
        COMMENT ON COLUMN %I.created_by IS ''Email of user who created this record'';
      ', tbl_name);
      
      EXECUTE format('
        COMMENT ON COLUMN %I.updated_by IS ''Email of user who last modified this record'';
      ', tbl_name);
      
      RAISE NOTICE 'Added creator/editor tracking to table: %', tbl_name;
    END LOOP;
  END $$;

  -- Re-enable triggers
  SET session_replication_role = DEFAULT;

  -- Grant execute permissions
  GRANT EXECUTE ON FUNCTION get_current_user_email() TO authenticated;
  GRANT EXECUTE ON FUNCTION set_record_creator() TO authenticated;
  GRANT EXECUTE ON FUNCTION set_record_editor() TO authenticated;
