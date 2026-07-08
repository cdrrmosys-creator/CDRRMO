# Excel Export Fix - Calendar Events Only

## Issue
The Excel export in the Calendar Events module was potentially exporting aggregated events from multiple sources instead of only calendar_events table data.

## Root Cause
The `records` state variable contains only calendar_events data, which is correct for export. However, there was a bug where the update handler was using `filteredRecords` (which contains aggregated events) instead of `records` when updating the state after editing.

## Changes Made

### 1. Fixed Update Handler (Line 515)
**Before:**
```javascript
setRecords(filteredRecords.map(rec => rec.id === selectedId ? data[0] : rec))
```

**After:**
```javascript
setRecords(records.map(rec => rec.id === selectedId ? data[0] : rec))
await loadAggregatedEvents() // Refresh aggregated events after update
```

### 2. Enhanced Insert Handler (Line 526)
**Before:**
```javascript
setRecords([data[0], ...records])
```

**After:**
```javascript
setRecords([data[0], ...records])
await loadAggregatedEvents() // Refresh aggregated events after insert
```

### 3. Enhanced Delete Handler (Line 550)
**Before:**
```javascript
setRecords(records.filter(rec => rec.id !== id))
```

**After:**
```javascript
setRecords(records.filter(rec => rec.id !== id))
await loadAggregatedEvents() // Refresh aggregated events after delete
```

## Data Flow Clarification

### Two Separate Data States:

1. **`records`** - Contains ONLY calendar_events table data
   - Loaded from: `supabase.from('calendar_events').select('*')`
   - Used for: Excel export, Add/Edit/Delete operations
   - Format: Direct database records from calendar_events table

2. **`aggregatedEvents`** - Contains ALL events from 6 sources
   - Loaded from: `loadAggregatedEvents()` function
   - Includes: calendar_events, transport, venues, activities, events_assistance, pruning_trimming
   - Used for: List view display, Calendar view, filtering
   - Format: Normalized objects with unified structure

### Excel Export Configuration

```javascript
<ExportModal
  isOpen={isExportOpen}
  onClose={() => setIsExportOpen(false)}
  records={records}  // ← Only calendar_events data
  filename="calendarevents_report.xlsx"
  sheetName="Calendar Events"
  dateField="start_date"
  onSuccess={(count) => toast.success(`Exported ${count} records successfully.`)}
  onError={(msg) => toast.error(msg)}
/>
```

### What Gets Exported

The Excel export will include:
- ✅ All records from `calendar_events` table
- ✅ Fields: record_id, event_title, event_type, event_type_other, start_date, end_date, location, organizer, description
- ❌ NOT included: Transport, Venues, Activities, Events Assistance, Pruning data

## Benefits of This Approach

### 1. Consistent Exports
- Excel export always exports calendar_events table data
- Predictable column structure
- All calendar-specific fields are included

### 2. Separate Display vs Export
- **Display (List/Calendar)**: Shows aggregated events from all sources
- **Export**: Only exports actual calendar_events records
- This separation makes sense because:
  - Calendar events have their own specific fields (event_type, organizer, etc.)
  - Other modules have their own export functionality
  - Mixing data structures in one export would be confusing

### 3. Performance
- Smaller export file (only calendar_events, not all 6 sources)
- Faster export generation
- More maintainable code

## Alternative Approach (If Needed)

If users want to export ALL aggregated events from all sources, you could:

1. Create a separate "Export All Events" button
2. Use `filteredRecords` instead of `records`
3. Map aggregated events to unified export format:
```javascript
const exportRecords = filteredRecords.map(event => ({
  title: event.title,
  source: EVENT_SOURCES[event.source]?.label,
  date: event.date,
  type_status: getEventStatusOrType(event),
  location: event.data?.location || event.data?.destination || event.data?.facility_name,
  // ... other normalized fields
}))
```

4. Use different filename: `all_events_report.xlsx`

## Testing Checklist

### Excel Export Tests:
- [ ] Export with no filters shows all calendar_events records
- [ ] Export respects active filters (search, date range, etc.) - CHECK IF THIS IS INTENDED
- [ ] Export includes all calendar_events fields
- [ ] Export does NOT include transport/venues/activities/etc. records
- [ ] File downloads with correct filename: `calendarevents_report.xlsx`
- [ ] Sheet name is "Calendar Events"

### CRUD Operation Tests:
- [ ] Add new calendar event → appears in both list and export
- [ ] Edit calendar event → updates in both list and export
- [ ] Delete calendar event → removes from both list and export
- [ ] Add/Edit/Delete refreshes aggregated events display correctly

### Data Integrity Tests:
- [ ] Calendar events count matches export record count
- [ ] Aggregated events include all 6 sources
- [ ] Stats cards show correct counts per source
- [ ] Overdue detection works after CRUD operations

## Important Notes

### Current Behavior:
- **Excel Export** → Only calendar_events table data
- **List View** → Aggregated events from all 6 sources
- **Calendar View** → Aggregated events from all 6 sources
- **PDF Export** → Aggregated events (uses `filteredRecords`)

### Consistency Note:
There's an inconsistency between Excel and PDF export:
- **Excel**: Only calendar_events
- **PDF**: All aggregated events

This may be intentional (PDF for viewing/printing all events, Excel for calendar data management), but document this for users.

## Files Modified

- `src/pages/CalendarEvents/index.jsx`
  - Fixed update handler to use `records` instead of `filteredRecords`
  - Added `loadAggregatedEvents()` calls after CRUD operations
  - Maintained ExportModal configuration (no changes needed)

## Future Enhancements

Potential improvements:
- [ ] Add "Export All Events" button for aggregated data
- [ ] Add export format selector (Calendar Only / All Sources)
- [ ] Add source filter to export options
- [ ] Standardize PDF and Excel export behavior
- [ ] Add export progress indicator for large datasets
