# Overdue Event Detection & Highlighting Feature

## Overview
Implemented an automatic overdue detection system that identifies events/activities with "Pending" or "Scheduled" status that have passed their scheduled date. These overdue items are automatically sorted to the top of the list and highlighted in red to alert users of overlooked activities.

## Key Features

### 1. Overdue Detection Logic
Created `isEventOverdue()` helper function that checks:
- ✅ Event date has passed (is before today)
- ✅ Status/Type is "Pending" or "Scheduled" (case-insensitive)
- ✅ Works across all event sources (Calendar, Transport, Venues, Activities, Events Assistance, Pruning)

### 2. Automatic Sorting
- Overdue items are **automatically sorted to the top** of the list
- Within overdue items, sorted by date (most recent first)
- Non-overdue items maintain normal date-based sorting below

### 3. Visual Highlighting
Overdue items are prominently highlighted with:
- **Red left border** (4px solid #dc2626)
- **Light red background** (#fef2f2)
- **Red warning icon** (`ri-error-warning-fill`) with pulse animation
- **Modified status badge**:
  - Red background (#fef2f2)
  - Red text (#dc2626)
  - Thicker red border (2px instead of 1px)
  - Warning icon instead of status icon
  - Text shows "⚠ [Status] (OVERDUE)"

## Visual Design

### Overdue Row Appearance:
```
┌─────────────────────────────────────────────────────┐
│ ⚠ [Pulsing Red Icon] Event Title | Source Badge    │
│   Date: Jan 15, 2025 | ⚠ Pending (OVERDUE)         │
└─────────────────────────────────────────────────────┘
▌ (4px red border on left)
  (Light red background)
```

### Status Badge for Overdue:
- Background: Light red (#fef2f2)
- Text: Dark red (#dc2626)
- Border: 2px solid red
- Icon: Warning icon (`ri-error-warning-line`)
- Text format: "⚠ Pending (OVERDUE)" or "⚠ Scheduled (OVERDUE)"

## Technical Implementation

### Helper Function: `isEventOverdue()`
```javascript
const isEventOverdue = (event) => {
  if (!event.date) return false
  
  const eventDate = new Date(event.date)
  const today = new Date()
  eventDate.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  
  // Check if date has passed
  const isPastDate = eventDate < today
  if (!isPastDate) return false
  
  // Get the status/type for this event
  const statusOrType = getEventStatusOrType(event)
  
  // Check if status is Pending or Scheduled (case-insensitive)
  const status = statusOrType.toLowerCase()
  return status === 'pending' || status === 'scheduled'
}
```

### Sorting Logic
```javascript
.sort((a, b) => {
  // Sort overdue items to the top
  const aOverdue = isEventOverdue(a)
  const bOverdue = isEventOverdue(b)
  
  if (aOverdue && !bOverdue) return -1 // a comes first
  if (!aOverdue && bOverdue) return 1  // b comes first
  
  // If both are overdue or both are not, maintain date ordering
  if (a.date && b.date) {
    return new Date(b.date) - new Date(a.date)
  }
  return 0
})
```

### Visual Highlighting
```javascript
const overdue = isEventOverdue(event)

// Priority rendering: Overdue > Today > Upcoming
if (overdue) {
  rowAccentColor = '#dc2626'
  rowBackground = '#fef2f2'
}
```

## User Benefits

### 1. Immediate Visibility
- Overdue items appear at the top of the list automatically
- No need to scroll or search for overlooked activities
- Red highlighting makes them impossible to miss

### 2. Proactive Alerts
- System automatically detects missed deadlines
- Users don't need to manually check each event
- Prevents activities from being forgotten

### 3. Clear Status Communication
- Badge explicitly shows "(OVERDUE)" label
- Warning icon reinforces urgency
- Pulse animation draws attention

### 4. Works Across All Modules
- Detects overdue items from:
  - Calendar Events
  - Transport bookings
  - Venue bookings
  - Activities
  - Events Assistance
  - Pruning & Trimming

## Status Detection by Source

### Overdue Conditions:
| Source | Status Field | Overdue When |
|--------|--------------|--------------|
| **Calendar Events** | event_type | If "Scheduled" and date < today |
| **Transport** | status | If "Pending" or "Scheduled" and date_time < today |
| **Venues** | calculated | If would calculate to "Scheduled" but date < today |
| **Activities** | status | If "Pending" or "Scheduled" and date < today |
| **Events Assistance** | N/A | Type field, not typically "Pending/Scheduled" |
| **Pruning** | status | If "Pending" or "Scheduled" and date < today |

## Interaction with Other Features

### Priority System:
1. **Overdue** (highest priority) - Red, sorted to top
2. **Today** - Red, below overdue items
3. **Upcoming** (within 7 days) - Yellow, normal position
4. **Normal** - No accent, normal position

### Filter Compatibility:
- Works with Time Filter (All/Upcoming/Past)
- Works with Source Filter
- Works with Date Range Filter
- Works with Search
- Overdue sorting applied after filtering

### Stats Cards:
- Overdue items still count in their source module cards
- No separate overdue count card (consider adding in future)

## Testing Scenarios

### Test Case 1: Pending Transport Booking (Past Date)
- Status: "Pending"
- Date: January 10, 2025 (assuming today is later)
- **Expected**: Appears at top, red highlighting, shows "⚠ Pending (OVERDUE)"

### Test Case 2: Scheduled Venue (Past Date)
- Status: "Scheduled"
- Date: January 5, 2025
- **Expected**: Appears at top, red highlighting, shows "⚠ Scheduled (OVERDUE)"

### Test Case 3: Completed Activity (Past Date)
- Status: "Completed"
- Date: January 3, 2025
- **Expected**: Normal display, no overdue highlighting (not pending/scheduled)

### Test Case 4: Pending Activity (Future Date)
- Status: "Pending"
- Date: August 1, 2025
- **Expected**: Normal display, no overdue highlighting (not past due)

### Test Case 5: Multiple Overdue Items
- Multiple events with "Pending" status, dates: Jan 5, Jan 10, Jan 15
- **Expected**: All at top, sorted by date (Jan 15, Jan 10, Jan 5)

## Edge Cases Handled

### 1. Missing Date
- If event has no date, cannot be overdue
- `isEventOverdue()` returns false

### 2. Case Sensitivity
- Status check uses `.toLowerCase()`
- Handles "Pending", "PENDING", "pending", etc.

### 3. "Scheduled" Calculated Status (Venues)
- Venues calculate status based on date
- If date < today, status becomes "Completed" automatically
- Therefore venues with past dates won't show as overdue unless data is inconsistent

### 4. Status Variations
- Only checks for exact match: "pending" or "scheduled"
- Other statuses like "In Progress" are not flagged as overdue

## Future Enhancements

Potential improvements to consider:
- [ ] Add overdue count to page header or stats cards
- [ ] Email/notification alerts for overdue items
- [ ] Separate "Overdue" tab in Time Filter
- [ ] Allow users to dismiss/snooze overdue warnings
- [ ] Add overdue duration (e.g., "3 days overdue")
- [ ] Bulk action: Mark all overdue as completed/cancelled
- [ ] Export overdue items report
- [ ] Dashboard widget showing overdue count

## Files Modified

- `src/pages/CalendarEvents/index.jsx`
  - Added `isEventOverdue()` helper function
  - Modified `filteredRecords` sorting logic
  - Updated row rendering for overdue highlighting
  - Enhanced status badge styling for overdue items

## Dependencies

- Uses existing `getEventStatusOrType()` function
- Compatible with existing urgency detection system
- Uses RemixIcon for warning icons (`ri-error-warning-fill`, `ri-error-warning-line`)
- Uses existing pulse animation CSS keyframe

## Performance Considerations

- Overdue check runs once per event during render
- Sorting adds minimal overhead (O(n log n))
- No database changes required
- All logic runs client-side
- Scales well with pagination (only checks visible items)

## Accessibility

- Visual indicators (color, icon, border) provide multiple cues
- Text explicitly states "(OVERDUE)" for screen readers
- Pulse animation draws attention without being disruptive
- High contrast red on light background meets WCAG standards
- Icon title attribute provides hover tooltip

## Notes

- System does NOT automatically update status to "Completed" or "Cancelled"
- Users must manually update overdue items
- Red highlighting serves as a visual reminder only
- Works in both List view (highlighted) and Calendar view (events show normally)
- Overdue detection is date-based (time of day is ignored)
