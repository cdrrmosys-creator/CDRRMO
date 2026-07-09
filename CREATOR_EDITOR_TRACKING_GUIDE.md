# Creator & Editor Tracking - Implementation Guide

## Overview
This feature adds "Published by" and "Last edited by" information to all records across all modules, similar to Facebook's post attribution.

---

## Step 1: Run Database Migration

1. Open Supabase Dashboard
2. Go to SQL Editor
3. Run the SQL file: `add_creator_editor_tracking.sql`
4. This will add `created_by` and `updated_by` columns to all tables with automatic triggers

---

## Step 2: UI Implementation

### Display Location Options

You can display the creator/editor info in several places:

#### Option A: In View Modal (Recommended)
Display at the bottom of the modal when viewing a record:

```jsx
{isViewing && (
  <div style={{
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid var(--border-light)',
    display: 'flex',
    gap: '24px',
    fontSize: '12px',
    color: 'var(--text-muted)'
  }}>
    <div>
      <i className="ri-user-add-line" style={{ marginRight: '4px' }}></i>
      Published by: <strong>{formData.created_by || 'Unknown'}</strong>
    </div>
    <div>
      <i className="ri-edit-line" style={{ marginRight: '4px' }}></i>
      Last edited by: <strong>{formData.updated_by || 'Unknown'}</strong>
    </div>
  </div>
)}
```

#### Option B: In Table Row (Hover Tooltip)
Show on hover over a row:

```jsx
<tr 
  title={`Published by: ${record.created_by} | Last edited by: ${record.updated_by}`}
  onClick={() => handleViewDetails(record)}
  style={{ cursor: 'pointer' }}
>
```

#### Option C: As Separate Column
Add as a column in the table (takes up space):

```jsx
<th>Created By</th>
// ...
<td style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
  {record.created_by?.split('@')[0] || '-'}
</td>
```

---

## Step 3: Update handleOpenEdit Function

Make sure to include `created_by` and `updated_by` when loading record data:

```javascript
const handleOpenEdit = (rec) => {
  setIsEditing(true)
  setIsViewing(false)
  setSelectedId(rec.id)
  setFormData({
    // ... all other fields
    created_by: rec.created_by || '',
    updated_by: rec.updated_by || '',
  })
  setIsModalOpen(true)
}
```

---

## Step 4: Update INITIAL_FORM_STATE

Add the fields to the initial state:

```javascript
const INITIAL_FORM_STATE = {
  // ... existing fields
  created_by: '',
  updated_by: '',
}
```

---

## Example Implementation for Training Registration

### 1. Update INITIAL_FORM_STATE
```javascript
const INITIAL_FORM_STATE = {
  record_id: '',
  full_name: '',
  // ... other fields
  status: 'Pending',
  created_by: '',
  updated_by: '',
}
```

### 2. Update handleOpenEdit
```javascript
const handleOpenEdit = (rec) => {
  setIsEditing(true)
  setIsViewing(false)
  setSelectedId(rec.id)
  setFormData({
    record_id: rec.record_id || '',
    full_name: rec.full_name || '',
    // ... other fields
    status: rec.status || 'Pending',
    created_by: rec.created_by || '',
    updated_by: rec.updated_by || '',
  })
  setIsModalOpen(true)
}
```

### 3. Add Display in Modal
Add this before the closing `</form>` tag in the modal:

```jsx
{isViewing && (
  <div style={{
    marginTop: '24px',
    paddingTop: '16px',
    borderTop: '2px solid var(--border-light)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '12px',
    color: 'var(--text-muted)',
    background: 'var(--bg-app)',
    padding: '12px 16px',
    borderRadius: '8px'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <i className="ri-user-add-line" style={{ fontSize: '14px', color: 'var(--primary)' }}></i>
      <span>Published by:</span>
      <strong style={{ color: 'var(--text)' }}>
        {formData.created_by ? formData.created_by.split('@')[0] : 'Unknown'}
      </strong>
    </div>
    {formData.updated_by && formData.updated_by !== formData.created_by && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <i className="ri-edit-line" style={{ fontSize: '14px', color: 'var(--primary)' }}></i>
        <span>Last edited by:</span>
        <strong style={{ color: 'var(--text)' }}>
          {formData.updated_by.split('@')[0]}
        </strong>
      </div>
    )}
  </div>
)}
```

---

## Design Patterns

### Clean Email Display
```javascript
// Show only the name part before @
const displayName = email => email ? email.split('@')[0] : 'Unknown'

// Usage
<strong>{displayName(formData.created_by)}</strong>
```

### Conditional Display
Only show "Last edited by" if it's different from creator:

```javascript
{formData.updated_by && formData.updated_by !== formData.created_by && (
  <div>Last edited by: {displayName(formData.updated_by)}</div>
)}
```

---

## Modules to Update

Apply this pattern to all these modules:

- ✅ Incidents
- ✅ Drowning Incidents
- ✅ Transport
- ✅ Activities
- ✅ Venues
- ✅ Training Conducted
- ✅ Training Attended
- ✅ Training Registration
- ✅ Inventory
- ✅ Vehicles
- ✅ Drivers
- ✅ Employees
- ✅ Volunteers
- ✅ Events Assistance
- ✅ Pruning/Trimming
- ✅ Calendar Events
- ✅ Vouchers
- ✅ CDRRMC Meeting
- ✅ CDRRMC Reso
- ✅ History
- ✅ CCTV Reports

---

## Testing

1. Create a new record → Check if created_by is set
2. Edit the record → Check if updated_by is updated
3. View the record → Verify the display shows correct information
4. Different user edits → Verify updated_by changes

---

## Notes

- The database triggers automatically handle setting `created_by` and `updated_by`
- Existing records are backfilled with 'system@cdrrmo.local'
- Email is extracted from JWT token (authenticated user)
- No changes needed in save handlers - triggers handle everything automatically
