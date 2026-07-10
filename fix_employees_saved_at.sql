-- =====================================================
-- FIX: employees saved_at Column
-- =====================================================
-- The employees table is missing the saved_at column
-- but the trigger trg_saved_at_employees was already
-- applied, causing: "record 'new' has no field 'saved_at'"
-- Run this once in the Supabase SQL Editor.

-- Step 1: Add saved_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'saved_at'
  ) THEN
    ALTER TABLE employees ADD COLUMN saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    RAISE NOTICE 'Created saved_at column on employees table';
  ELSE
    RAISE NOTICE 'saved_at column already exists on employees table';
  END IF;
END $$;

-- Step 2: Ensure the trigger is properly set up
DROP TRIGGER IF EXISTS trg_saved_at_employees ON employees;
CREATE TRIGGER trg_saved_at_employees
BEFORE INSERT OR UPDATE ON employees
FOR EACH ROW EXECUTE FUNCTION set_saved_at();

DO $$ BEGIN RAISE NOTICE 'Done: employees saved_at column and trigger are ready.'; END $$;
