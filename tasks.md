# Implementation Plan: CDRRMO Button Functions

## Overview

Wire every interactive element in `Index.html` to real functionality and add the three missing
server-side functions to `Code.gs`. All changes stay within these two files. Communication with
the server uses `google.script.run` exclusively. A single `appState` object is the in-memory
source of truth; `localStorage` is used as a write-through cache for module records.

## Tasks

- [x] 1. Add server-side functions to Code.gs
  - [x] 1.1 Implement `saveModuleRecord(moduleKey, data)` in Code.gs
    - Open or create the sheet whose name matches `moduleKey` (use the sheet-name map from the design)
    - If the sheet is new, write a header row derived from the keys of `data` plus `id` and `_savedAt`
    - Generate a unique ID with a timestamp prefix (`REC-` + `Date.now()`)
    - Append the data row and return `{ success: true, id: newId }`
    - Wrap everything in try/catch and return `{ success: false, error: e.message }` on failure
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_

  - [x] 1.2 Implement `getModuleRecords(moduleKey)` in Code.gs
    - Open the spreadsheet; if the named sheet does not exist return `[]`
    - Use the existing `sheetDataToObjectArray` helper to convert rows to objects
    - Return the array; return `[]` on any exception
    - _Requirements: 20.1, 20.2, 20.3_

  - [x] 1.3 Implement `exportSheetToCSV(sheetName)` in Code.gs
    - Open the spreadsheet; throw a descriptive Error if the sheet does not exist
    - Read all values, escape commas/quotes per RFC 4180, join rows with `\n`
    - Return the CSV string
    - _Requirements: 21.1, 21.2, 21.3_


- [x] 2. Establish `appState` and core navigation wiring in Index.html
  - [x] 2.1 Declare `appState` object and extend `goTo` / `doLogout`
    - Add the `appState` object (currentUser, employees, moduleRecords, notifications,
      calendarState, activeModule) near the top of the `<script>` block
    - Extend `goTo(screenId)`: when target is `loginScreen`, clear `#username` and `#password`
    - Implement `doLogout()`: set `appState.currentUser = null`, call `goTo('loginScreen')`
    - Wire the Logout button's `onclick` to `doLogout()`
    - Wire the Forgot Password link's `onclick` to `goTo('changePassScreen')`
    - _Requirements: 1.1, 1.2, 1.3, 2.1_

  - [ ] 2.2 Write property test for login field clearing (Property 1)
    - **Property 1: Login field clearing on navigation**
    - **Validates: Requirements 1.3**

  - [x] 2.3 Extend `setNav(el, page)` to call `loadPageData(page)`
    - After showing the target page div, call `loadPageData(page)` if records for that page
      are not already cached in `appState.moduleRecords`
    - Update `appState.activeModule` on every nav change
    - _Requirements: 1.2_


- [ ] 3. Implement topbar search in Index.html
  - [-] 3.1 Add `initTopbarSearch()` and wire it in `setupApp()`
    - Attach an `oninput` handler to the topbar `<input>` element
    - On each keystroke, query all `tbody tr` rows inside the currently active page div
    - Show rows whose `textContent` contains the query (case-insensitive); hide others
    - Add `<div id="topbar-no-search-msg">` below the search bar; show it when the active
      page has no table, hide it otherwise
    - When the input is cleared, restore all rows to visible
    - _Requirements: 15.1, 15.2, 15.3_

  - [ ] 3.2 Write property test for topbar search filter and restore (Property 14)
    - **Property 14: Topbar search filter and restore**
    - **Validates: Requirements 15.1, 15.2**


- [ ] 4. Implement notification bell and settings dropdown in Index.html
  - [-] 4.1 Build notification bell dropdown HTML and `initNotificationBell()`
    - Append `<div id="notifDropdown" class="topbar-dropdown">` to `.topbar-actions`
    - Implement `updateNotifications(record, moduleKey)`: prepend a notification item to
      `appState.notifications`, trim to 5, re-render `#notifDropdown`
    - Wire bell button click to toggle `notifDropdown.classList.toggle('open')`
    - Add document-level click listener to close dropdown when clicking outside
    - Call `initNotificationBell()` from `setupApp()`
    - _Requirements: 16.1, 16.2_

  - [ ] 4.2 Write property test for notification bell 5 most recent (Property 15)
    - **Property 15: Notification bell shows 5 most recent records**
    - **Validates: Requirements 16.1**

  - [-] 4.3 Build settings dropdown HTML and `initSettingsDropdown()`
    - Append `<div id="settingsDropdown" class="topbar-dropdown">` with two items:
      "Change Password" (calls `goTo('changePassScreen')`) and "About System"
      (calls `openAboutModal()`)
    - Implement `openAboutModal()`: create and show a modal overlay with system name,
      version, and office info; destroy it on close
    - Wire settings button click to toggle `settingsDropdown.classList.toggle('open')`
    - Add document-level click listener to close dropdown when clicking outside
    - Call `initSettingsDropdown()` from `setupApp()`
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

- [~] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 6. Complete employee modal wiring in Index.html
  - [-] 6.1 Verify and complete employee search filter
    - Confirm the employee search `<input>` on the Employees page has an `oninput` handler
      that filters the employee table by name, ID, designation, and department
    - If missing, implement `filterEmployeeTable(query)` and wire it
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ] 6.2 Write property test for employee search filter correctness (Property 2)
    - **Property 2: Employee search filter correctness**
    - **Validates: Requirements 3.1, 3.2**

  - [ ] 6.3 Verify Add Employee button and `addNewEmployee()` completeness
    - Confirm `addNewEmployee()` opens the modal blank, in edit mode, with "New Employee"
      header and Delete button hidden — patch any gaps found
    - _Requirements: 4.1, 4.2, 4.3_

  - [~] 6.4 Verify `saveProfileEdit()` and `deleteEmployee()` completeness
    - Confirm `saveProfileEdit()` calls `google.script.run.saveEmployee(data)`, updates
      `appState.employees`, re-renders the table, closes the modal, and shows a Toast
    - Confirm `deleteEmployee()` calls `google.script.run.deleteEmployee(id)`, removes the
      entry from `appState.employees`, re-renders the table, closes the modal, and shows a Toast
    - Patch any gaps; ensure failure handlers re-enable buttons and show error Toasts
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.7, 5.8, 5.9, 5.10_

  - [ ] 6.5 Write property test for employee save round-trip (Property 3)
    - **Property 3: Employee save round-trip**
    - **Validates: Requirements 5.3**

  - [ ] 6.6 Write property test for employee delete removes from array (Property 4)
    - **Property 4: Employee delete removes from array**
    - **Validates: Requirements 5.9**

  - [~] 6.7 Implement cancel-reverts logic for employee modal
    - In `cancelProfileEdit()`: if editing an existing employee, re-open the profile from
      the original object in `appState.employees` (restoring all field values) and call
      `toggleEditMode(false)`; if new employee, close the modal
    - _Requirements: 5.5, 5.6_

  - [ ] 6.8 Write property test for cancel reverts to original state (Property 5)
    - **Property 5: Cancel reverts to original state**
    - **Validates: Requirements 5.5, 5.6_

  - [~] 6.9 Verify Add Child and Add Seminar row deletion
    - Confirm delete-icon buttons on child rows and seminar rows call `.parentElement.remove()`
      (or equivalent) and that the list count decreases by exactly 1
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 6.10 Write property test for list row deletion reduces count by one (Property 6)
    - **Property 6: List row deletion reduces count by exactly one**
    - **Validates: Requirements 6.2, 6.4**


- [ ] 7. Rebuild generic modal with full server wiring in Index.html
  - [~] 7.1 Redesign `openGenericModal(title, moduleKey, fields, existingData)`
    - Accept an optional `existingData` parameter
    - If `existingData` is provided (view mode): render read-only `<div>` values, hide Save
      button, show only Close button
    - Otherwise (create mode): render `<input>` / `<select>` / `<textarea>` elements per
      field definition with `name` attribute set to `field.key`
    - Set `currentGenericModule = moduleKey`
    - _Requirements: 7.1, 22.1, 22.2_

  - [ ] 7.2 Write property test for generic modal field collection completeness (Property 7)
    - **Property 7: Generic modal field collection completeness**
    - **Validates: Requirements 7.1**

  - [~] 7.3 Implement `saveGenericRecord()` with `google.script.run` call
    - Rename/replace the existing `saveGenericModal()` stub
    - Collect all `input`, `select`, `textarea` values from `#genericModalBody` into a
      `data` object keyed by each element's `name` attribute
    - Validate required fields (non-empty after `.trim()`); show Toast and return early if any fail
    - Disable Save button, set text to "Saving…"
    - Call `google.script.run.withSuccessHandler(...).withFailureHandler(...).saveModuleRecord(moduleKey, data)`
    - On success: re-enable button, close modal, call `prependTableRow(moduleKey, result)`,
      call `updateNotifications(result, moduleKey)`, show success Toast
    - On failure: re-enable button, show error Toast, keep modal open
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ] 7.4 Write property test for required field validation prevents submission (Property 8)
    - **Property 8: Required field validation prevents submission**
    - **Validates: Requirements 7.6**

  - [~] 7.5 Implement `prependTableRow(moduleKey, record)` helper
    - Look up the `<tbody>` for the given moduleKey's table
    - Build a `<tr>` from the record's field values and insert it at index 0
    - _Requirements: 7.3_

  - [ ] 7.6 Write property test for successful save prepends a table row (Property 9)
    - **Property 9: Successful save prepends a table row**
    - **Validates: Requirements 7.3, 9.2, 10.2, 11.2, 12.2, 13.2, 18.2**

  - [ ] 7.7 Write property test for failed save leaves table unchanged (Property 10)
    - **Property 10: Failed save leaves table unchanged**
    - **Validates: Requirements 11.3, 12.3**

  - [~] 7.8 Implement `closeGenericModal()` with full field clearing
    - Remove `active` class from `#genericModal`
    - Clear all inputs, selects, and textareas inside `#genericModalBody`
    - _Requirements: 8.1, 8.2_


- [x] 8. Implement `loadPageData(page)` and table population in Index.html
  - [x] 8.1 Implement `loadPageData(page)` using `getModuleRecords`
    - Map each page name to its `moduleKey` and sheet name
    - If `appState.moduleRecords[moduleKey]` is already populated, skip the server call
    - Otherwise call `google.script.run.withSuccessHandler(...).getModuleRecords(moduleKey)`
    - On success: store records in `appState.moduleRecords[moduleKey]`, write through to
      `localStorage`, call `renderModuleTable(moduleKey, records)`
    - _Requirements: 20.1, 20.2, 20.3_

  - [x] 8.2 Implement `renderModuleTable(moduleKey, records)` helper
    - Clear the target `<tbody>`, then for each record build a `<tr>` with the relevant
      column values and an `onclick` that calls
      `openGenericModal(title, moduleKey, fields, record)` (view mode)
    - _Requirements: 22.1, 22.2, 22.3_

- [~] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 10. Wire primary module pages (Incidents, Voucher, Inventory, Transport, Venues)
  - [~] 10.1 Wire Incidents Report page buttons and table rows
    - Wire "Report Incident" button to `openGenericModal('Report Incident', 'incidents', fields)`
      with fields: Incident Type (text, required), Location (text, required),
      Date & Time (datetime-local, required), Severity (select, required), Remarks (textarea)
    - Wire existing table row `onclick` stubs to `openGenericModal` in view mode
    - For this module, prepend the row optimistically (tag with `data-pending="true"`);
      remove the pending row on server failure
    - _Requirements: 9.1, 9.2, 9.3_

  - [~] 10.2 Wire Voucher Monitoring page buttons and table rows
    - Wire "Issue Voucher" button to `openGenericModal('Issue Voucher', 'voucher', fields)`
      with fields: Beneficiary Name (text, required), Amount (number, required),
      Purpose (text, required), Date (date, required), Status (select, required)
    - Wire table row `onclick` stubs to view mode
    - _Requirements: 10.1, 10.2, 10.3_

  - [~] 10.3 Wire Inventory page buttons and table rows
    - Wire "Register Gear" button to `openGenericModal('Register Gear', 'inventory', fields)`
      with fields: Item Name (text, required), Category (text, required),
      Quantity (number, required), Condition (select, required), Date Acquired (date, required)
    - Wire "Export Sheet" button to call `google.script.run.exportSheetToCSV('Inventory')`
      and trigger a CSV file download via Blob + anchor click
    - Wire table row `onclick` stubs to view mode
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [~] 10.4 Wire Transportation Assistance page buttons and table rows
    - Wire "Dispatch Vehicle" button to `openGenericModal('Dispatch Vehicle', 'transport', fields)`
      with fields: Vehicle (text, required), Driver (text, required),
      Destination (text, required), Date & Time (datetime-local, required), Purpose (text)
    - Wire table row `onclick` stubs to view mode
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [~] 10.5 Wire Training Venues page buttons and table rows
    - Wire "Book Facility" button to `openGenericModal('Book Facility', 'venues', fields)`
      with fields: Facility Name (text, required), Date (date, required),
      Start Time (time, required), End Time (time, required), Purpose (text), Booked By (text, required)
    - Wire table row `onclick` stubs to view mode
    - _Requirements: 13.1, 13.2, 13.3_


- [ ] 11. Wire remaining 11 record module pages in Index.html
  - [~] 11.1 Wire CDRRMO Activities, Events Needed Assistance, Training Attended, Training Conducted
    - Activities: fields — Activity Title (text, required), Date (date, required),
      Location (text), Participants (number), Description (textarea)
    - Events Assistance: fields — Event Name (text, required), Date (date, required),
      Location (text), Type of Assistance (text, required), Requestor (text)
    - Training Attended: update existing partial `openGenericModal` call to use full field
      definition matching design: Training Title, Date, Venue, Conducted By, Attendees
    - Training Conducted: update existing partial call: Training Title, Date, Venue,
      Facilitator, Participants
    - Wire all table row `onclick` stubs to view mode for each page
    - _Requirements: 18.1, 18.2, 18.3_

  - [~] 11.2 Wire Accredited CDV, CDRRMC & SP Reso, CDRRMC Meeting, Maps Available
    - Volunteers: update existing partial call: Volunteer Name, Organization,
      Accreditation No. (text, required), Date (date), Status (select)
    - CDRRMC Reso: fields — Resolution No. (text, required), Title (text, required),
      Date Passed (date, required), Description (textarea)
    - CDRRMC Meeting: fields — Meeting No. (text, required), Date (date, required),
      Agenda (textarea, required), Attendees (text), Minutes Summary (textarea)
    - Maps Available: fields — Map Title (text, required), Type (text), Coverage Area (text),
      Date Updated (date), File URL (text)
    - Wire all table row `onclick` stubs to view mode
    - _Requirements: 18.1, 18.2, 18.3_

  - [~] 11.3 Wire Pruning/Trimming, History, and Documentations pages
    - Pruning/Trimming: fields — Location (text, required), Date (date, required),
      Trees Pruned (number), Conducted By (text), Remarks (textarea)
    - History: replace `showToast` stub on "Add Record" button with
      `openGenericModal('Add History Record', 'history', fields)`;
      fields — Event Title (text, required), Date (date, required),
      Description (textarea, required), Category (text)
    - Documentations: fields — Document Title (text, required), Date (date, required),
      Type (text), Description (textarea), File URL (text)
    - Wire all table row `onclick` stubs to view mode
    - _Requirements: 18.1, 18.2, 18.3_

- [~] 12. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


- [ ] 13. Implement calendar component in Index.html
  - [~] 13.1 Implement `renderCalendar(calendarId)` and `calNav(calendarId, direction)`
    - Read `appState.calendarState[calendarId].{ year, month, events }`
    - Write month/year label into the calendar's `.cal-header h3`
    - Generate 7×6 grid of `.cal-day` cells; mark today, other-month days
    - For each cell, check `events` for matching date; append `.cal-event-label` spans
    - Each `.cal-day` gets `onclick="calDayClick('calendarId', year, month, day)"`
    - `calNav`: adjust month/year in state, call `renderCalendar`, set `_calNavInProgress`
      flag for 200 ms
    - Wire prev/next buttons on both calendar instances to `calNav`
    - _Requirements: 14.1, 14.2_

  - [ ] 13.2 Write property test for calendar month navigation round-trip (Property 11)
    - **Property 11: Calendar month navigation round-trip**
    - **Validates: Requirements 14.1, 14.2**

  - [~] 13.3 Implement `calDayClick(calendarId, year, month, day)` and `loadCalendarEvents`
    - `calDayClick`: return early if `_calNavInProgress`; format date as `YYYY-MM-DD`;
      call `openGenericModal('Add Calendar Event', 'calendar-events', fields, null)` with
      the date field pre-filled; fields — Event Title (text, required), Date (date, required),
      Notes (textarea)
    - `loadCalendarEvents(calendarId)`: call `google.script.run.getModuleRecords('CalendarEvents')`,
      filter for current month/year, store in `appState.calendarState[calendarId].events`,
      call `renderCalendar(calendarId)`
    - Call `loadCalendarEvents` for both calendar instances when their pages are navigated to
    - _Requirements: 14.3, 14.4, 14.5, 14.6_

  - [ ] 13.4 Write property test for calendar day click pre-fills date (Property 12)
    - **Property 12: Calendar day click pre-fills date**
    - **Validates: Requirements 14.3**

  - [ ] 13.5 Write property test for calendar event display correctness (Property 13)
    - **Property 13: Calendar event display correctness**
    - **Validates: Requirements 14.5, 14.6**


- [ ] 14. Integration wiring — connect all pieces in `setupApp()` and verify end-to-end
  - [~] 14.1 Update `setupApp()` to call all init functions
    - Call `initTopbarSearch()`, `initNotificationBell()`, `initSettingsDropdown()` from
      `setupApp()` after `initEmployees()`
    - Initialise `appState.calendarState` for both `transport` and `venues` with the
      current month/year and empty events arrays
    - _Requirements: 15.1, 16.1, 17.1_

  - [ ] 14.2 Write property test for `saveModuleRecord` generates unique IDs (Property 17)
    - **Property 17: `saveModuleRecord` generates unique IDs**
    - **Validates: Requirements 19.4**

  - [ ] 14.3 Write property test for `getModuleRecords` round-trip (Property 18)
    - **Property 18: `getModuleRecords` round-trip with `saveModuleRecord`**
    - **Validates: Requirements 20.2**

  - [ ] 14.4 Write property test for `exportSheetToCSV` round-trip (Property 19)
    - **Property 19: `exportSheetToCSV` round-trip**
    - **Validates: Requirements 21.2**

  - [ ] 14.5 Write property test for `saveModuleRecord` header row matches data keys (Property 16)
    - **Property 16: `saveModuleRecord` header row matches data keys**
    - **Validates: Requirements 19.3**

- [~] 15. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All code changes go into `Index.html` and `Code.gs` only — no new files
- `google.script.run` is the only mechanism for calling server functions from the frontend
- The sheet-name map (moduleKey → sheet name) lives in `saveModuleRecord` in `Code.gs`
- Property tests use **fast-check** (JavaScript) with a minimum of 100 iterations each
- Unit tests cover: `doLogout`, `addNewEmployee`, `openGenericModal` view mode, `closeGenericModal`,
  Export Sheet download trigger, settings dropdown options, About System modal, and dropdown
  outside-click close behaviour
- Integration tests (1–3 examples each, against a real/sandboxed spreadsheet) cover:
  `saveModuleRecord` creating a new sheet, `getModuleRecords` on a non-existent sheet,
  `exportSheetToCSV` on a missing sheet, `deleteEmployee`, and `changePassword`
- Checkpoints at tasks 5, 9, 12, and 15 ensure incremental validation throughout

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.3"] },
    { "id": 2, "tasks": ["2.2", "3.1", "4.1", "4.3", "6.1", "6.3"] },
    { "id": 3, "tasks": ["3.2", "4.2", "6.2", "6.4", "6.7", "6.9", "7.1"] },
    { "id": 4, "tasks": ["6.5", "6.6", "6.8", "6.10", "7.2", "7.3", "7.5", "7.8"] },
    { "id": 5, "tasks": ["7.4", "7.6", "7.7", "8.1"] },
    { "id": 6, "tasks": ["8.2", "10.1", "10.2", "10.3", "10.4", "10.5"] },
    { "id": 7, "tasks": ["11.1", "11.2", "11.3", "13.1"] },
    { "id": 8, "tasks": ["13.2", "13.3"] },
    { "id": 9, "tasks": ["13.4", "13.5", "14.1"] },
    { "id": 10, "tasks": ["14.2", "14.3", "14.4", "14.5"] }
  ]
}
```
