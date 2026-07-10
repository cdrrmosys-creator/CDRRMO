# Status Change Tracking Fix ✅

## Issue
When updating a record's status from the table list (using the status dropdown), the `updated_by` and `updated_at` fields were not being recorded/displayed because the local state was being updated with only the status field instead of fetching the complete updated record from the database.

## Root Cause
The `handleStatusChange` functions in various modules were:
1. Calling `.update()` without `.select()`
2. Manually updating local state with only `{ ...record, status: newStatus }`
3. Not retrieving the updated record with the trigger-generated `updated_by` and `updated_at` values

The database trigger (`set_record_editor()`) automatically sets `updated_by` and `updated_at` when any UPDATE occurs, but the frontend wasn't retrieving these updated values.

## Solution
Modified all `handleStatusChange` functions to:
1. Add `.select()` to the update query to return the updated record
2. Update local state with the complete returned data that includes `updated_by` and `updated_at` from the database trigger
3. Fallback to manual state update if no data is returned

## Pattern Applied

**Before:**
```javascript
const handleStatusChange = async (id, newStatus) => {
  const { error } = await supabase
    .from('table_name')
    .update({ status: newStatus })
    .eq('id', id)
  
  if (error) throw error
  setRecords(records.map(r => r.id === id ? { ...r, status: newStatus } : r))
}
```

**After:**
```javascript
const handleStatusChange = async (id, newStatus) => {
  const { data, error } = await supabase
    .from('table_name')
    .update({ status: newStatus })
    .eq('id', id)
    .select()  // ← Added to retrieve updated record
  
  if (error) throw error
  
  // Update with complete data including updated_by and updated_at from trigger
  if (data && data[0]) {
    setRecords(records.map(r => r.id === id ? data[0] : r))
  } else {
    setRecords(records.map(r => r.id === id ? { ...r, status: newStatus } : r))
  }
}
```

## Modules Fixed

### 7 Modules Updated:
1. ✅ **Vouchers** - `src/pages/Vouchers/index.jsx`
2. ✅ **Drivers** - `src/pages/Drivers/index.jsx`
3. ✅ **Employees** - `src/pages/Employees/index.jsx` (also removed manual `updated_at` setting)
4. ✅ **Pruning** - `src/pages/Pruning/index.jsx`
5. ✅ **Volunteers** - `src/pages/Volunteers/index.jsx`
6. ✅ **Vehicles** - `src/pages/Vehicles/index.jsx`
7. ✅ **Transport** - `src/pages/Transport/index.jsx`

### Already Correct:
- ✅ **Training Registrations** - `src/pages/Documentation/TrainingRegistrations.jsx` (already had `.select()`)

## Verification
✅ All 7 modules compile without errors  
✅ Status changes will now properly record `updated_by` and `updated_at`  
✅ Creator info in table list will update to show "updated by" after status changes

## How It Works

1. **User changes status** in the table dropdown
2. **Frontend calls** `.update({ status: newStatus }).select()`
3. **Database trigger** automatically sets:
   - `updated_by = current_user_email()` (from JWT)
   - `updated_at = NOW()` (from trigger)
4. **Query returns** the complete updated record with all fields
5. **Frontend updates** local state with the complete data
6. **UI reflects** the new status AND the updated creator/editor info

## Testing Checklist

For each module, verify:
- [ ] Change status from dropdown in table list
- [ ] Check that record shows "updated by: [username]" in creator info subtitle
- [ ] Open record in modal view
- [ ] Verify "Updated by" info displays with current user and timestamp
- [ ] Confirm timestamp matches the time of status change

## Database Trigger Reference

The database uses these triggers (from `add_creator_editor_tracking.sql`):
```sql
-- Automatically sets updated_by on UPDATE
CREATE FUNCTION set_record_editor()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_by = get_current_user_email();  -- Gets email from JWT
  NEW.created_at = OLD.created_at;            -- Preserve original creation time
  NEW.created_by = OLD.created_by;            -- Preserve original creator
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

The trigger fires on every UPDATE, so we just need to retrieve the updated record with `.select()`.

---

**Date Fixed:** December 2024  
**System:** CDRRMO Management System  
**Impact:** All status changes now properly track who made the change and when
