-- Add category_other column to inventory table
-- This allows users to specify a custom category when "Other" is selected

ALTER TABLE inventory
ADD COLUMN IF NOT EXISTS category_other TEXT;

-- Add comment to the column
COMMENT ON COLUMN inventory.category_other IS 'Custom category specification when category is set to Other';
