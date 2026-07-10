-- public.logistic table definition
CREATE TABLE IF NOT EXISTS public.logistic (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_id VARCHAR NOT NULL UNIQUE,
    borrower_name VARCHAR NOT NULL,
    office VARCHAR,
    address TEXT,
    date_released DATE NOT NULL DEFAULT CURRENT_DATE,
    date_returned DATE,
    contact_no VARCHAR,
    item_type VARCHAR NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    item_condition VARCHAR NOT NULL DEFAULT 'Good',
    return_condition VARCHAR,
    return_photo_url TEXT,
    person_in_charge VARCHAR,
    status VARCHAR NOT NULL DEFAULT 'Pending',
    created_by TEXT,
    updated_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.logistic ENABLE ROW LEVEL SECURITY;

-- Create policies (select, insert, update, delete for all authenticated users)
DROP POLICY IF EXISTS "Allow read" ON public.logistic;
DROP POLICY IF EXISTS "Allow insert" ON public.logistic;
DROP POLICY IF EXISTS "Allow update" ON public.logistic;
DROP POLICY IF EXISTS "Allow delete" ON public.logistic;

CREATE POLICY "Allow read" ON public.logistic FOR SELECT USING (true);
CREATE POLICY "Allow insert" ON public.logistic FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update" ON public.logistic FOR UPDATE USING (true);
CREATE POLICY "Allow delete" ON public.logistic FOR DELETE USING (true);

-- Recreate set_record_editor to automatically set updated_at on update
CREATE OR REPLACE FUNCTION set_record_editor()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_by = get_current_user_email();
    NEW.updated_at = NOW();
    -- Preserve created_at and created_by during updates
    NEW.created_at = OLD.created_at;
    NEW.created_by = OLD.created_by;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop triggers if they exist
DROP TRIGGER IF EXISTS trigger_set_logistic_creator ON public.logistic;
DROP TRIGGER IF EXISTS trigger_set_logistic_editor ON public.logistic;

-- Create trigger for setting creator on INSERT
CREATE TRIGGER trigger_set_logistic_creator
BEFORE INSERT ON public.logistic
FOR EACH ROW
EXECUTE FUNCTION set_record_creator();

-- Create trigger for setting editor on UPDATE
CREATE TRIGGER trigger_set_logistic_editor
BEFORE UPDATE ON public.logistic
FOR EACH ROW
EXECUTE FUNCTION set_record_editor();
