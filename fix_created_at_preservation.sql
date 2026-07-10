-- Fix: Preserve created_at and created_by during updates
-- This prevents created_at from changing when a record is updated

-- Update the set_record_editor function to preserve creation data
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

-- Reload schema
NOTIFY pgrst, 'reload schema';
