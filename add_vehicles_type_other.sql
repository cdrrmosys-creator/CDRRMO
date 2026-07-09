-- Add type_other column to vehicles table
-- This allows users to specify a custom vehicle type when "Other" is selected

ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS type_other TEXT;

-- Add comment to the column
COMMENT ON COLUMN vehicles.type_other IS 'Custom vehicle type specification when type is set to Other';
