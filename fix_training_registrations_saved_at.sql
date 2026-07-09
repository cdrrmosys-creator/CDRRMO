-- Add saved_at column to training_registrations table
-- This column tracks when each record was last modified

ALTER TABLE training_registrations
ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill existing records with their created_at timestamp or current time
UPDATE training_registrations
SET saved_at = COALESCE(created_at, NOW())
WHERE saved_at IS NULL;

-- Create a trigger to automatically update saved_at on record updates
CREATE OR REPLACE FUNCTION update_training_registrations_saved_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.saved_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_training_registrations_saved_at ON training_registrations;

CREATE TRIGGER trigger_update_training_registrations_saved_at
BEFORE UPDATE ON training_registrations
FOR EACH ROW
EXECUTE FUNCTION update_training_registrations_saved_at();

-- Add comment
COMMENT ON COLUMN training_registrations.saved_at IS 'Timestamp of last modification';
