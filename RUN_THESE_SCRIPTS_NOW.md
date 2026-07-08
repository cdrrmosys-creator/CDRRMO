# 🎯 RUN THESE SQL SCRIPTS IN SUPABASE NOW

## Step-by-Step Instructions

### 1️⃣ Open Supabase Dashboard
1. Go to your Supabase project dashboard
2. Click **"SQL Editor"** in the left sidebar menu

---

### 2️⃣ Run Script #1 - Training Conducted

**Copy this entire script:**

```sql
-- =====================================================
-- FIX: Training Conducted participants Column
-- =====================================================
-- Step 1: Check current column type
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'training_conducted' AND column_name = 'participants'
  ) THEN
    ALTER TABLE training_conducted ADD COLUMN participants JSONB DEFAULT '[]'::jsonb;
    RAISE NOTICE 'Created participants column as JSONB';
  END IF;
END $$;

-- Step 2: If column exists but is wrong type, convert it
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_name = 'training_conducted' AND column_name = 'participants';
  
  IF col_type != 'jsonb' THEN
    -- Create backup column
    ALTER TABLE training_conducted ADD COLUMN IF NOT EXISTS participants_backup TEXT;
    
    -- Copy data to backup
    UPDATE training_conducted
    SET participants_backup = 
      CASE 
        WHEN participants::text = '' THEN NULL
        WHEN participants::text IS NULL THEN NULL
        ELSE participants::text
      END;
    
    -- Drop old column and create new JSONB column
    ALTER TABLE training_conducted DROP COLUMN participants;
    ALTER TABLE training_conducted ADD COLUMN participants JSONB DEFAULT '[]'::jsonb;
    
    -- Migrate data from backup
    UPDATE training_conducted
    SET participants = '[]'::jsonb
    WHERE participants_backup IS NULL OR participants_backup = '';
    
    UPDATE training_conducted
    SET participants = participants_backup::jsonb
    WHERE participants_backup IS NOT NULL 
      AND participants_backup != ''
      AND participants_backup ~ '^\s*\[';
    
    UPDATE training_conducted
    SET participants = jsonb_build_array(jsonb_build_object('name', participants_backup))
    WHERE participants_backup IS NOT NULL 
      AND participants_backup != ''
      AND participants_backup !~ '^\s*\[';
    
    -- Drop backup column
    ALTER TABLE training_conducted DROP COLUMN IF EXISTS participants_backup;
    
    RAISE NOTICE 'Converted participants to JSONB';
  ELSE
    RAISE NOTICE 'participants column is already JSONB';
  END IF;
END $$;

-- Step 3: Ensure all NULL values are empty arrays
UPDATE training_conducted
SET participants = '[]'::jsonb
WHERE participants IS NULL;

-- Step 4: Add additional columns
ALTER TABLE training_conducted 
ADD COLUMN IF NOT EXISTS remarks TEXT;

ALTER TABLE training_conducted 
ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

-- Step 5: Verify changes
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'training_conducted'
  AND column_name IN ('participants', 'remarks', 'photos')
ORDER BY column_name;

-- Step 6: Show sample (LIMIT 5 = preview only, unlimited participants allowed!)
SELECT 
  record_id,
  training_title,
  participants,
  jsonb_array_length(COALESCE(participants, '[]'::jsonb)) as participant_count
FROM training_conducted
LIMIT 5;
```

**Then:**
1. Paste into Supabase SQL Editor
2. Click the green **"Run"** button (or press `Ctrl+Enter`)
3. Wait for success message ✅

---

### 3️⃣ Run Script #2 - Training Attended

**Copy this entire script:**

```sql
-- =====================================================
-- FIX: Training Attended participants Column
-- =====================================================
ALTER TABLE training_attended 
ADD COLUMN IF NOT EXISTS participants JSONB DEFAULT '[]'::jsonb;

ALTER TABLE training_attended 
ADD COLUMN IF NOT EXISTS remarks TEXT;

ALTER TABLE training_attended 
ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;

ALTER TABLE training_attended 
ADD COLUMN IF NOT EXISTS date_end DATE;

-- Migrate existing attendees to participants
UPDATE training_attended
SET participants = jsonb_build_array(jsonb_build_object('name', TRIM(attendees)))
WHERE attendees IS NOT NULL 
  AND TRIM(attendees) != ''
  AND (participants IS NULL OR participants = '[]'::jsonb);

-- Verify changes
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'training_attended'
  AND column_name IN ('participants', 'attendees', 'remarks', 'photos', 'date_end')
ORDER BY column_name;

-- Show sample (LIMIT 5 = preview only, you can add unlimited participants!)
SELECT 
  record_id,
  training_title,
  attendees as old_attendees_text,
  participants as new_participants_json,
  jsonb_array_length(COALESCE(participants, '[]'::jsonb)) as participant_count
FROM training_attended
LIMIT 5;
```

**Then:**
1. Paste into Supabase SQL Editor (clear previous query first)
2. Click the green **"Run"** button (or press `Ctrl+Enter`)
3. Wait for success message ✅

---

### 4️⃣ Test It Works!

1. Go to your app → **Training Conducted** module
2. Click **"Log Training Conducted"**
3. Fill in the form
4. Add **3 participants** with different names:
   - Click "Add" button
   - Enter: "John Doe"
   - Click "Add" button again
   - Enter: "Jane Smith"
   - Click "Add" button again
   - Enter: "Bob Johnson"
5. Click **"Save"**
6. Click on the record you just created
7. **Verify all 3 names are saved** ✅
8. In the table view, you should see: **"John Doe, Jane Smith (+1)"** ✅

---

## ✅ What These Scripts Do

### Script #1 (Training Conducted)
- Converts `participants` column from TEXT → JSONB
- Migrates any existing data safely
- Adds `remarks` and `photos` columns if missing

### Script #2 (Training Attended)
- Adds new `participants` JSONB column
- Keeps old `attendees` column for backward compatibility
- Adds `remarks`, `photos`, and `date_end` columns if missing

---

## 🎉 After Running

You'll be able to:
- ✅ Add multiple participants (just names)
- ✅ All participants will save correctly
- ✅ See "Name1, Name2 (+N)" in table view
- ✅ Export all names to PDF/Excel

---

## ⚠️ Important Notes

- These scripts are **safe to run** - they use `IF NOT EXISTS` checks
- Your existing data will be **preserved**
- If a column already exists, it won't be duplicated
- The scripts take **~5 seconds** to complete
- You only need to run each script **once**
- **LIMIT 5** at the end is just for displaying a preview - **you can add unlimited participants!**

---

## 🆘 Troubleshooting

**Q: I see an error "column already exists"**  
A: That's okay! It means part of the fix was already applied. Continue anyway.

**Q: The script seems to do nothing**  
A: Check if you see any output at the bottom. Even "0 rows affected" is success.

**Q: Participants still not saving**  
A: Make sure you ran BOTH scripts (Training Conducted AND Training Attended).

---

**Ready?** Copy the first script above and paste it into Supabase SQL Editor right now! 🚀
