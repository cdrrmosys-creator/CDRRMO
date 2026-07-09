-- Add status column to training_registrations table (Training Registration)
-- This allows tracking whether a registered participant has completed the training

ALTER TABLE training_registrations
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending';

-- Update any existing records to have 'Pending' status if they don't have one
UPDATE training_registrations
SET status = 'Pending'
WHERE status IS NULL;

-- Add a comment to document the column
COMMENT ON COLUMN training_registrations.status IS 'Training completion status: Pending, Completed, Cancelled';
