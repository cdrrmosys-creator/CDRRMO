# Design Document: CDRRMO Button Functions

## Overview

This feature implements all interactive button and UI element functionality for the CDRRMO Recording System — a Google Apps Script Web App served as a single `Index.html` file. The application is already fully styled; this design covers the wiring of every button, modal, search input, calendar, notification bell, and settings dropdown to real server-side persistence via `google.script.run`.

The system follows a thin-client architecture: all business logic and data storage live in `Code.gs` (Google Apps Script), while `Index.html` holds the entire frontend (HTML, CSS, JavaScript) in one file. Communication between the two layers is exclusively through `google.script.run` asynchronous calls. Data is persisted in a Google Spreadsheet identified by `SPREADSHEET_ID`.

### Key Design Goals

- Wire every button to its correct server call or client-side action with no dead UI elements remaining.
- Maintain a single in-memory state object (`appState`) that is the source of truth for all rendered tables and dropdowns.
- Use a generic, reusable modal pattern for all non-employee modules so new modules require only a field-definition array.
- Keep all changes within `Index.html` and `Code.gs`; no new files are introduced.

---

## Architecture

### Layer Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Index.html                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  HTML/CSS    │  │  appState    │  │  JS Handlers │  │
│  │  (screens,   │  │  (in-memory  │  │  (button     │  │
│  │   modals,    │  │   arrays,    │  │   wiring,    │  │
│  │   tables)    │  │   objects)   │  │   rendering) │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                          │                              │
│                  google.script.run                      │
└──────────────────────────┼──────────────────────────────┘
                           │ async RPC
┌──────────────────────────┼──────────────────────────────┐
│                     Code.gs                             │
│  validateLogin  changePassword  getEmployees            │
│  saveEmployee   deleteEmployee  saveModuleRecord        │
│  getModuleRecords              exportSheetToCSV         │
└─────────────────────────────────────────────────────────┘
                           │
                  Google Spreadsheet
                  (SPREADSHEET_ID)
```

### State Management

All mutable frontend state is consolidated into a single `appState` object:

```javascript
const appState = {
  currentUser: null,          // { username, role }
  employees: [],              // loaded from Employees sheet
  moduleRecords: {},          // { [moduleKey]: [...records] }
  notifications: [],          // last 5 records across all modules
  calendarState: {
    transport: { year, month, events: [] },
    venues:    { year, month, events: [] }
  },
  activeModule: 'home'
};
```

`localStorage` is used as a write-through cache for `moduleRecords` so that data survives page refreshes without a server round-trip on every navigation.

---

## Components and Interfaces

### 1. Navigation & Session (`goTo`, `setNav`, `doLogout`)

**`doLogout()`**
- Sets `appState.currentUser = null`.
- Calls `goTo('loginScreen')`.
- `goTo()` is extended: when the target is `loginScreen`, it clears `#username` and `#password` inputs.

**`setNav(el, page)`** (existing, extended)
- Hides all `[id^="page-"]` divs, shows `page-{page}`.
- Calls `loadPageData(page)` to fetch records for the newly visible page if not already cached.
- Updates `appState.activeModule`.

---

### 2. Topbar Search (`initTopbarSearch`)

The topbar `<input>` gets an `oninput` handler wired at `setupApp()` time.

```
onInput(query):
  rows = querySelectorAll('#page-{activeModule} .custom-table tbody tr')
  if rows.length === 0:
    show '#topbar-no-search-msg'
  else:
    hide '#topbar-no-search-msg'
    for each row:
      text = row.textContent.toLowerCase()
      row.style.display = text.includes(query.toLowerCase()) ? '' : 'none'
```

A `<div id="topbar-no-search-msg">` element is added below the topbar search bar and shown only when the active page has no table.

---

### 3. Notification Bell (`initNotificationBell`)

A `<div id="notifDropdown">` is appended to `.topbar-actions`. It is absolutely positioned below the bell button.

```
notifDropdown structure:
  <div id="notifDropdown" class="topbar-dropdown">
    <div class="dropdown-header">Recent Activity</div>
    <!-- up to 5 .notif-item divs -->
  </div>
```

**`updateNotifications(record, moduleKey)`** — called after every successful `saveModuleRecord`:
- Prepends `{ moduleKey, summary, timestamp }` to `appState.notifications`.
- Trims to 5 items.
- Re-renders `#notifDropdown`.

**Bell click**: toggles `notifDropdown.classList.toggle('open')`.
**Document click**: closes dropdown if click target is outside bell + dropdown.

---

### 4. Settings Dropdown (`initSettingsDropdown`)

A `<div id="settingsDropdown">` is appended to `.topbar-actions`.

```
settingsDropdown structure:
  <div id="settingsDropdown" class="topbar-dropdown">
    <div onclick="goTo('changePassScreen')">Change Password</div>
    <div onclick="openAboutModal()">About System</div>
  </div>
```

**`openAboutModal()`** — creates and shows a simple modal overlay with system name, version, and office information. The modal is destroyed on close.

**Settings button click**: toggles `settingsDropdown.classList.toggle('open')`.
**Document click**: closes dropdown if click target is outside settings button + dropdown.

---

### 5. Employee Modal (`employeeModal`)

The modal already exists in HTML. The following functions are wired or extended:

| Function | Trigger | Action |
|---|---|---|
| `addNewEmployee()` | Add Employee button | Opens modal blank, edit mode, hides Delete button |
| `openEmployeeProfile(id)` | Table row click | Opens modal with data, read mode |
| `toggleEditMode(editing)` | Edit Profile / Cancel | Switches display ↔ editable inputs |
| `saveEmployeeChanges()` | Save Changes button | Calls `google.script.run.saveEmployee(data)` |
| `deleteEmployeeProfile()` | Delete Profile button | Confirms, calls `google.script.run.deleteEmployee(id)` |
| `addChildrenInput(val)` | Add Child button | Appends input row to `#childrenEditList` |
| `addSeminarInputRow(sem)` | Add Seminar button | Appends 4-input row to `#seminarsEditBody` |

**Cancel logic**: if `currentEmployeeId` starts with `"EMP-NEW-"`, close modal; otherwise revert fields from the original employee object and call `toggleEditMode(false)`.

---

### 6. Generic Modal (`genericModal`)

The generic modal is the single reusable overlay for all non-employee modules.

```
genericModal structure:
  <div id="genericModal" class="modal-overlay">
    <div class="profile-modal" style="max-width:560px">
      <div class="profile-modal-header">
        <span id="genericModalTitle"></span>
        <button class="modal-close-btn" onclick="closeGenericModal()">×</button>
      </div>
      <div id="genericModalBody" class="profile-modal-body"></div>
      <div class="profile-modal-footer">
        <button id="genericModalCancelBtn" onclick="closeGenericModal()">Cancel</button>
        <button id="genericModalSaveBtn" onclick="saveGenericRecord()">Save Record</button>
      </div>
    </div>
  </div>
```

**`openGenericModal(title, moduleKey, fields, existingData)`**
- Sets title, sets `currentGenericModule = moduleKey`.
- If `existingData` is provided (view mode): renders read-only `<div>` values, hides Save button, shows only Close.
- Otherwise (create mode): renders `<input>` / `<select>` / `<textarea>` elements per field definition.

**Field definition schema:**
```javascript
{ key: 'incidentType', label: 'Incident Type', type: 'text', required: true }
{ key: 'severity',     label: 'Severity',       type: 'select',
  options: ['Low','Medium','High','Critical'],   required: true }
{ key: 'remarks',      label: 'Remarks',         type: 'textarea', required: false }
{ key: 'dateTime',     label: 'Date & Time',      type: 'datetime-local', required: true }
```

**`saveGenericRecord()`**
1. Collects all `input`, `select`, `textarea` values from `#genericModalBody` into a `data` object keyed by `name` attribute.
2. Validates required fields; shows Toast and returns early if any are empty.
3. Disables Save button, sets text to "Saving…".
4. Calls `google.script.run.withSuccessHandler(...).withFailureHandler(...).saveModuleRecord(moduleKey, data)`.
5. On success: re-enables button, closes modal, calls `prependTableRow(moduleKey, result)`, calls `updateNotifications(result, moduleKey)`.
6. On failure: re-enables button, shows error Toast, keeps modal open.

**`closeGenericModal()`**
- Removes `active` class from `#genericModal`.
- Clears all inputs in `#genericModalBody`.

---

### 7. Module Page Wiring

Each module page button is wired by calling `openGenericModal` with a module-specific field definition array. The table row `onclick` calls `openGenericModal` in view mode with the record's data.

#### Module Field Definitions

| Module | moduleKey | Sheet Name | Fields |
|---|---|---|---|
| Incidents Report | `incidents` | `Incidents` | Incident Type, Location, Date & Time, Severity, Remarks |
| Voucher Monitoring | `voucher` | `Vouchers` | Beneficiary Name, Amount, Purpose, Date, Status |
| Inventory | `inventory` | `Inventory` | Item Name, Category, Quantity, Condition, Date Acquired |
| Transportation Assistance | `transport` | `Transport` | Vehicle, Driver, Destination, Date & Time, Purpose |
| Training Venues | `venues` | `Venues` | Facility Name, Date, Start Time, End Time, Purpose, Booked By |
| CDRRMO Activities | `activities` | `Activities` | Activity Title, Date, Location, Participants, Description |
| Events Needed Assistance | `events-assistance` | `EventsAssistance` | Event Name, Date, Location, Type of Assistance, Requestor |
| Training Attended | `training-attended` | `TrainingAttended` | Training Title, Date, Venue, Conducted By, Attendees |
| Training Conducted | `training-conducted` | `TrainingConducted` | Training Title, Date, Venue, Facilitator, Participants |
| Accredited CDV | `volunteers` | `Volunteers` | Volunteer Name, Organization, Accreditation No., Date, Status |
| CDRRMC & SP Reso | `cdrrmc-reso` | `CDRRMCReso` | Resolution No., Title, Date Passed, Description |
| CDRRMC Meeting | `cdrrmc-meeting` | `CDRRMCMeeting` | Meeting No., Date, Agenda, Attendees, Minutes Summary |
| Maps Available | `maps-available` | `MapsAvailable` | Map Title, Type, Coverage Area, Date Updated, File URL |
| Pruning/Trimming | `pruning-trimming` | `PruningTrimming` | Location, Date, Trees Pruned, Conducted By, Remarks |
| History | `history` | `History` | Event Title, Date, Description, Category |
| Documentations | `documentations` | `Documentations` | Document Title, Date, Type, Description, File URL |
| Calendar Events | `calendar-events` | `CalendarEvents` | Event Title, Date, Notes |

#### Export Sheet Button (Inventory)

The Export Sheet button calls:
```javascript
google.script.run
  .withSuccessHandler(function(csvString) {
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'Inventory.csv'; a.click();
    URL.revokeObjectURL(url);
  })
  .exportSheetToCSV('Inventory');
```

---

### 8. Calendar Component (`renderCalendar`, `calNav`)

Two calendar instances exist: `transport-assistance` and `training-venues`. Each is driven by its own state entry in `appState.calendarState`.

**`renderCalendar(calendarId)`**
- Reads `appState.calendarState[calendarId].{ year, month, events }`.
- Writes the month/year label into `.cal-header h3`.
- Generates 7×6 grid of `.cal-day` cells.
- For each cell, checks `events` array for matching date; if found, appends a `.cal-event-label` span.
- Each `.cal-day` gets `onclick="calDayClick(calendarId, year, month, day)"`.

**`calNav(calendarId, direction)`** (direction: -1 or +1)
- Adjusts month/year in `appState.calendarState[calendarId]`.
- Calls `renderCalendar(calendarId)`.
- Sets a `_calNavInProgress` flag for 200 ms to prevent day-click race condition.

**`calDayClick(calendarId, year, month, day)`**
- Returns immediately if `_calNavInProgress` is true.
- Formats the date as `YYYY-MM-DD`.
- Calls `openGenericModal('Add Calendar Event', 'calendar-events', fields, null)` with the date field pre-filled.

**`loadCalendarEvents(calendarId)`**
- Calls `google.script.run.getModuleRecords('CalendarEvents')`.
- Filters events for the current month/year.
- Stores in `appState.calendarState[calendarId].events`.
- Calls `renderCalendar(calendarId)`.

---

## Data Models

### Employee (existing, unchanged)

```javascript
{
  id: "EMP-2021-0045",
  name: "Roel Santos",
  username: "roel.santos",
  designation: "Rescue Officer III",
  department: "Search and Rescue (SAR)",
  contact: "0917-888-1234",
  email: "roel.santos@palayan.gov.ph",
  dob: "1988-12-12",
  civilStatus: "Married",
  bloodType: "O+",
  pob: "Palayan City, Nueva Ecija",
  fatherName: "Mario A. Santos",
  motherName: "Elena B. Roxas",
  spouseName: "Clara M. Santos",
  children: ["Juanito Santos", "Sophia Santos"],
  education: "Bachelor of Science in Criminology",
  height: "175 cm", weight: "72 kg", waist: "32 inches",
  shirtSize: "Medium", shoeSize: "9.5",
  tin: "123-456-789-000", pagibig: "...", sss: "...", gsis: "...", philhealth: "...",
  office: "CDRRMO Headquarters",
  dutyStatus: "On Duty",
  photo: "",
  seminars: [{ title, date, conductedBy, venue }],
  others: "..."
}
```

### Module Record (generic)

```javascript
{
  id: "REC-1718000000000",   // timestamp-prefixed unique ID
  // ...all field keys from the field definition array
  _savedAt: "2025-01-15T10:30:00.000Z"
}
```

### Calendar Event

```javascript
{
  id: "REC-1718000000001",
  eventTitle: "Fire Drill",
  date: "2025-07-15",
  notes: "Annual fire drill for Barangay 1",
  _savedAt: "2025-07-01T08:00:00.000Z"
}
```

### Notification Item

```javascript
{
  moduleKey: "incidents",
  summary: "Incident: Fire — Brgy. 3",
  timestamp: 1718000000000
}
```

### Google Sheet Structure

Each module sheet has a header row auto-generated from the first record's keys:

```
| id | incidentType | location | dateTime | severity | remarks | _savedAt |
```

The `Employees` sheet retains its existing fixed schema.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

#### Reflection: Eliminating Redundancy

Before listing properties, redundancies are eliminated:

- **3.1 and 3.2** (employee search filter + clear): 3.2 is a round-trip of 3.1. They can be combined into one round-trip property.
- **5.3 and 5.9** (save employee adds to array / delete removes from array): These are distinct operations and are kept separate.
- **5.5** (cancel reverts fields) and **8.2** (cancel clears generic modal fields): Both are "cancel = original state" round-trips but for different modals. They can be combined into one general cancel-reverts property.
- **6.2 and 6.4** (delete child row / delete seminar row): Both are "delete row reduces count by 1". They can be combined into one property.
- **9.2, 10.2, 11.2** (prepend row on save): All are instances of the same property — "saving a record increases the table row count by 1". Combined into one general property.
- **11.3** (rollback on failure): Distinct from the success case; kept separate.
- **14.1 and 14.2** (prev/next month): These are inverses of each other and can be combined into one round-trip property.
- **15.1 and 15.2** (topbar filter + clear): Same round-trip pattern as 3.1/3.2. Combined.
- **14.5 and 14.6** (event dot on save / events on render): Both are about event display correctness. Combined.
- **19.3 and 20.2** (header row from keys / round-trip save+get): These are distinct; kept separate.

After reflection, the final property set is:

---

### Property 1: Login field clearing on navigation

*For any* navigation to `loginScreen` (from any screen state), the username and password input fields SHALL be empty after the navigation completes.

**Validates: Requirements 1.3**

---

### Property 2: Employee search filter correctness

*For any* employee array and any non-empty search string, every row rendered in the employee table SHALL contain the search string (case-insensitive) in at least one of: name, ID, designation, or department. Furthermore, clearing the search string SHALL restore all employees to the table.

**Validates: Requirements 3.1, 3.2**

---

### Property 3: Employee save round-trip

*For any* valid employee data object, after `saveEmployee` returns success, the in-memory `employees` array SHALL contain an entry whose fields match the saved data.

**Validates: Requirements 5.3**

---

### Property 4: Employee delete removes from array

*For any* employee ID present in the `employees` array, after `deleteEmployee` returns success for that ID, the `employees` array SHALL NOT contain any entry with that ID.

**Validates: Requirements 5.9**

---

### Property 5: Cancel reverts to original state

*For any* modal (Employee Modal or Generic Modal) that is opened with existing data and then placed into edit mode, clicking Cancel SHALL result in all displayed field values matching the values that were present when the modal was first opened.

**Validates: Requirements 5.5, 8.2**

---

### Property 6: List row deletion reduces count by exactly one

*For any* list builder (children list or seminars table) containing N rows, deleting any single row SHALL result in exactly N-1 rows remaining, with all other rows unchanged.

**Validates: Requirements 6.2, 6.4**

---

### Property 7: Generic modal field collection completeness

*For any* set of form fields rendered in `#genericModalBody`, the data object collected by `saveGenericRecord()` SHALL contain a key-value pair for every field, with the value matching what was entered in that field's input.

**Validates: Requirements 7.1**

---

### Property 8: Required field validation prevents submission

*For any* generic modal form where at least one required field is empty, calling `saveGenericRecord()` SHALL NOT invoke `google.script.run.saveModuleRecord`, and SHALL show a validation Toast.

**Validates: Requirements 7.6**

---

### Property 9: Successful save prepends a table row

*For any* module page and any valid record data, after `saveModuleRecord` returns success, the module's visible table SHALL contain exactly one more row than before the save, and the new row SHALL appear at the top of the table.

**Validates: Requirements 7.3, 9.2, 10.2, 11.2, 12.2, 13.2, 18.2**

---

### Property 10: Failed save leaves table unchanged

*For any* module page and any record data, if `saveModuleRecord` returns an error, the module's visible table SHALL contain the same number of rows as before the save attempt.

**Validates: Requirements 11.3, 12.3**

---

### Property 11: Calendar month navigation round-trip

*For any* calendar instance at any month/year, clicking the next-month button and then the previous-month button SHALL result in the calendar displaying the same month/year as before either click.

**Validates: Requirements 14.1, 14.2**

---

### Property 12: Calendar day click pre-fills date

*For any* day cell in a rendered calendar, clicking that cell SHALL open the Generic Modal with the date field pre-filled with the ISO date string (`YYYY-MM-DD`) corresponding to that cell's day.

**Validates: Requirements 14.3**

---

### Property 13: Calendar event display correctness

*For any* set of saved calendar events, when the calendar is rendered for the month containing those events, each event SHALL appear as a visible label or dot on its correct day cell, and no event SHALL appear on an incorrect day cell.

**Validates: Requirements 14.5, 14.6**

---

### Property 14: Topbar search filter and restore

*For any* module page with a visible table and any search string, every visible row after filtering SHALL contain the search string (case-insensitive) in its text content. Clearing the search string SHALL restore all rows to visible.

**Validates: Requirements 15.1, 15.2**

---

### Property 15: Notification bell shows 5 most recent records

*For any* set of N saved records (N ≥ 5) across all modules, the notification dropdown SHALL display exactly 5 items, and those 5 items SHALL be the 5 most recently saved records ordered by descending timestamp.

**Validates: Requirements 16.1**

---

### Property 16: `saveModuleRecord` header row matches data keys

*For any* data object passed to `saveModuleRecord` when the target sheet does not yet exist, the header row written to the new sheet SHALL contain exactly the keys of that data object (plus the auto-generated `id` key).

**Validates: Requirements 19.3**

---

### Property 17: `saveModuleRecord` generates unique IDs

*For any* two calls to `saveModuleRecord` (regardless of module or data), the `id` values returned SHALL be distinct.

**Validates: Requirements 19.4**

---

### Property 18: `getModuleRecords` round-trip with `saveModuleRecord`

*For any* set of records saved via `saveModuleRecord(moduleKey, data)`, a subsequent call to `getModuleRecords(moduleKey)` SHALL return an array containing all those records with their field values intact.

**Validates: Requirements 20.2**

---

### Property 19: `exportSheetToCSV` round-trip

*For any* array of objects saved to a sheet via `saveModuleRecord`, the CSV string returned by `exportSheetToCSV(sheetName)` SHALL be parseable back into an array of objects whose field values match the original saved data.

**Validates: Requirements 21.2**

---

## Error Handling

### `google.script.run` Failure Patterns

Every `google.script.run` call uses both `.withSuccessHandler` and `.withFailureHandler`. The failure handler always:
1. Re-enables any disabled button and restores its original label.
2. Calls `showToast("System error: Could not reach server.")`.
3. Leaves the modal open (if one was open).

### Server-Side Error Returns

Server functions return `{ success: false, error: "..." }` for expected failures (validation, not found, etc.) and let exceptions propagate to the `.withFailureHandler` for unexpected failures. The frontend checks `result.success` before proceeding.

### UI Rollback on Save Failure

For modules that optimistically prepend a row (Inventory, Transportation), the row is **not** prepended until the server confirms success. This avoids the need for a rollback step and keeps the UI consistent with the server state.

For the Incidents module (Requirement 9.2 specifies "immediately prepend"), the row is prepended optimistically and tagged with a `data-pending="true"` attribute. If the server call fails, the pending row is removed and an error Toast is shown.

### Validation

Client-side validation runs before any server call:
- Required fields: non-empty after `.trim()`.
- Numeric fields (Amount, Quantity): must parse as a positive number.
- Date fields: must be a valid date string.

Validation errors are shown via `showToast()` and do not submit.

### Calendar Navigation Race Condition

A module-level boolean `_calNavInProgress` is set to `true` when a nav button is clicked and reset to `false` after 200 ms. `calDayClick` checks this flag and returns early if it is `true`, preventing the modal from opening during a navigation animation.

---

## Testing Strategy

### Dual Testing Approach

This feature uses both **unit/example-based tests** and **property-based tests**. The frontend logic (field collection, filter functions, calendar rendering, state mutations) is pure enough to be extracted and tested in isolation using a Node.js test runner. The backend functions in `Code.gs` are tested using the Apps Script test utilities or a local mock of `SpreadsheetApp`.

### Property-Based Testing

The property-based testing library used is **[fast-check](https://github.com/dubzzz/fast-check)** (JavaScript). Each property test runs a minimum of **100 iterations**.

Each test is tagged with a comment in the format:
```
// Feature: cdrrmo-button-functions, Property N: <property text>
```

**Applicable properties and their test approach:**

| Property | Test Approach |
|---|---|
| P1: Login field clearing | Generate random screen states; call `goTo('loginScreen')`; assert fields empty |
| P2: Employee search filter | `fc.array(employeeArb)` + `fc.string()`; call `filterEmployees(query, list)`; assert all results match |
| P3: Employee save round-trip | `fc.record(employeeArb)`; simulate success callback; assert `employees` contains record |
| P4: Employee delete removes | `fc.array(employeeArb, {minLength:1})`; pick random ID; simulate success; assert not in array |
| P5: Cancel reverts state | `fc.record(employeeArb)`; open modal, mutate fields, cancel; assert fields match original |
| P6: List row deletion | `fc.array(fc.string(), {minLength:1})`; delete random index; assert length N-1 |
| P7: Field collection completeness | `fc.array(fieldArb)`; render fields with random values; collect; assert all keys present |
| P8: Required field validation | `fc.record` with at least one empty required field; assert `saveModuleRecord` not called |
| P9: Successful save prepends row | `fc.record(recordArb)`; simulate success; assert `tbody.rows.length` increased by 1 |
| P10: Failed save leaves table unchanged | `fc.record(recordArb)`; simulate failure; assert `tbody.rows.length` unchanged |
| P11: Calendar month nav round-trip | `fc.integer({min:0,max:11})` + `fc.integer({min:2000,max:2099})`; next then prev; assert same month/year |
| P12: Calendar day click pre-fills date | `fc.integer({min:1,max:28})`; click day; assert modal date field value |
| P13: Calendar event display | `fc.array(calEventArb)`; render calendar; assert each event on correct cell |
| P14: Topbar search filter | `fc.array(rowArb)` + `fc.string()`; filter; assert all visible rows match |
| P15: Notification bell 5 most recent | `fc.array(recordArb, {minLength:5})`; save all; assert dropdown shows 5 most recent |
| P16: Header row matches data keys | `fc.record(fc.dictionary(fc.string(), fc.string()))`; call `saveModuleRecord`; assert sheet header = keys |
| P17: Unique IDs | `fc.integer({min:2,max:20})`; save N records; assert all IDs distinct |
| P18: `getModuleRecords` round-trip | `fc.array(recordArb)`; save all; get all; assert deep equal |
| P19: `exportSheetToCSV` round-trip | `fc.array(recordArb)`; save; export; parse CSV; assert deep equal |

### Unit / Example-Based Tests

Unit tests cover:
- `doLogout()` clears `currentUser` and navigates to login screen.
- `addNewEmployee()` opens modal with blank fields and edit mode active.
- `openGenericModal()` in view mode hides the Save button.
- `closeGenericModal()` clears all inputs.
- Export Sheet button triggers a file download with the correct filename.
- Settings dropdown shows Change Password and About System options.
- About System modal appears only when selected from settings dropdown.
- Notification dropdown closes on outside click.
- Settings dropdown closes on outside click.

### Integration Tests

Integration tests (run against a real or sandboxed Google Spreadsheet) cover:
- `saveModuleRecord` creates a new sheet when the sheet does not exist.
- `getModuleRecords` returns an empty array for a non-existent sheet.
- `exportSheetToCSV` throws an error for a non-existent sheet name.
- `deleteEmployee` removes the correct row from the Employees sheet.
- `changePassword` updates the password column for the correct user.

These are run with 1–3 representative examples each, not property-based, due to the cost of Google Sheets API calls.
