# Requirements Document

## Introduction

The CDRRMO Recording System is a Google Apps Script Web App used by the City Disaster Risk Reduction and Management Office of Palayan City. The UI is fully built; this feature implements real, working functionality for every button and interactive element across the entire application. All data must persist to Google Sheets via `google.script.run` server-side calls. The backend already exposes `validateLogin`, `changePassword`, `getEmployees`, `saveEmployee`, and `deleteEmployee`. New server-side functions must be added for every other module (Incidents, Voucher, Inventory, Transportation, Venues, and all remaining record-keeping pages).

## Glossary

- **System**: The CDRRMO Recording System web application.
- **User**: An authenticated CDRRMO staff member operating the system.
- **Admin**: A User with the Administrator role.
- **Generic Modal**: The reusable `#genericModal` overlay used by all non-employee modules to collect and save new records.
- **Employee Modal**: The `#employeeModal` overlay used to view, create, edit, and delete employee profiles.
- **Module**: A named section of the application (Incidents, Voucher, Inventory, Transportation, Venues, Training Attended, Training Conducted, Accredited CDV, CDRRMO Activities, Events Needed Assistance, CDRRMC & SP Reso, CDRRMC Meeting, Maps Available, Pruning/Trimming, History, Documentations).
- **Sheet**: A named tab inside the Google Spreadsheet identified by `SPREADSHEET_ID` in `Code.gs`.
- **Record**: A single row of data saved to a Sheet.
- **Calendar**: The month-view calendar component used on Transportation Assistance and Training Venues pages.
- **Topbar**: The horizontal bar at the top of the dashboard containing the search input, notification bell, settings button, and logout button.
- **Toast**: The `#toast` notification element used to display brief status messages.

---

## Requirements

### Requirement 1: Logout Button

**User Story:** As a User, I want to click the Logout button in the topbar, so that I am securely returned to the login screen and my session is cleared.

#### Acceptance Criteria

1. WHEN the User clicks the Logout button, THE System SHALL clear the `currentUser` session variable.
2. WHEN the User clicks the Logout button, THE System SHALL navigate to `loginScreen`.
3. WHEN the System navigates to `loginScreen` by any means, THE System SHALL clear the username and password input fields.

---

### Requirement 2: Forgot Password Link

**User Story:** As a User, I want to click the Forgot Password link on the login screen, so that I am taken to the Change Password screen.

#### Acceptance Criteria

1. WHEN the User clicks the Forgot Password link, THE System SHALL navigate to `changePassScreen`.
2. IF navigation to `changePassScreen` fails due to a system error, THEN THE System SHALL show an error Toast and remain on the current screen.

---

### Requirement 3: Employee Search and Filter

**User Story:** As a User, I want to type in the search box on the Employees Profile page, so that the employee table is filtered in real time to show only matching records.

#### Acceptance Criteria

1. WHEN the User types in the employee search input, THE System SHALL re-render the employee table showing only rows where the employee name, ID, designation, or department contains the search string (case-insensitive).
2. WHEN the search input is cleared, THE System SHALL display all employees.
3. THE System SHALL perform the filter without making a new server call.
4. WHILE a search filter is active, THE System SHALL hide rows for employees whose searchable fields (name, ID, designation, department) are null or empty.

---

### Requirement 4: Add Employee Button

**User Story:** As a User, I want to click the Add Employee button on the Employees Profile page, so that a blank Employee Modal opens in edit mode ready for data entry.

#### Acceptance Criteria

1. WHEN the User clicks the Add Employee button, THE System SHALL open the Employee Modal with all fields blank and in edit mode.
2. WHEN the Employee Modal opens for a new employee, THE System SHALL display "New Employee" as the header name.
3. WHEN the Employee Modal opens for a new employee, THE System SHALL hide the Delete Profile button.

---

### Requirement 5: Employee Profile Modal — Edit, Save, Cancel, Delete

**User Story:** As a User, I want to view, edit, save, cancel, and delete employee profiles from the Employee Modal, so that personnel records are kept accurate and up to date.

#### Acceptance Criteria

1. WHEN the User clicks Edit Profile in the Employee Modal, THE System SHALL switch all display fields to editable inputs.
2. WHEN the User clicks Save Changes in the Employee Modal, THE System SHALL call `saveEmployee` with the current field values via `google.script.run`.
3. WHEN `saveEmployee` returns success, THE System SHALL update the in-memory `employees` array, re-render the employee table, close the modal, and show a success Toast.
4. IF `saveEmployee` returns an error, THEN THE System SHALL show the error message in a Toast without closing the modal.
5. WHEN the User clicks Cancel in edit mode for an existing employee, THE System SHALL revert all fields to their last saved values and return to read mode.
6. WHEN the User clicks Cancel in edit mode for a new employee, THE System SHALL close the Employee Modal.
7. WHEN the User clicks Delete Profile, THE System SHALL display a confirmation prompt before proceeding.
8. WHEN the User confirms deletion, THE System SHALL call `deleteEmployee` with the employee ID via `google.script.run`.
9. WHEN `deleteEmployee` returns success, THE System SHALL remove the employee from the in-memory array, re-render the table, close the modal, and show a success Toast.
10. IF `deleteEmployee` returns an error, THEN THE System SHALL show the error message in a Toast.

---

### Requirement 6: Add Child and Add Seminar Row in Employee Modal

**User Story:** As a User, I want to add children and seminar rows inside the Employee Modal edit mode, so that family and training history are fully captured.

#### Acceptance Criteria

1. WHEN the User clicks Add Child in the Employee Modal edit mode, THE System SHALL append a new text input row to the children list builder.
2. WHEN the User clicks the delete icon on a child row, THE System SHALL remove that row from the list builder.
3. WHEN the User clicks Add Seminar in the Employee Modal edit mode, THE System SHALL append a new row with Title, Date, Conducted By, and Venue inputs to the seminars table builder.
4. WHEN the User clicks the delete icon on a seminar row, THE System SHALL remove that row from the table builder.

---

### Requirement 7: Generic Modal — Save Record (All Modules)

**User Story:** As a User, I want to click Save Record in the Generic Modal, so that the entered data is persisted to the corresponding Google Sheet for the active module.

#### Acceptance Criteria

1. WHEN the User clicks Save Record in the Generic Modal, THE System SHALL collect all field values from `#genericModalBody` inputs.
2. WHEN the User clicks Save Record, THE System SHALL call the server-side function `saveModuleRecord(moduleKey, data)` via `google.script.run`.
3. WHEN `saveModuleRecord` returns success, THE System SHALL close the Generic Modal, show a success Toast, and append the new record to the visible table for the active module without a full page reload.
4. IF `saveModuleRecord` returns an error, THEN THE System SHALL show the error message in a Toast without closing the modal.
5. WHILE the save operation is in progress, THE System SHALL disable the Save Record button and display "Saving…" text.
6. THE System SHALL validate that required fields are not empty before calling the server; IF a required field is empty, THEN THE System SHALL show a validation Toast and not submit.

---

### Requirement 8: Generic Modal — Cancel Button

**User Story:** As a User, I want to click Cancel in the Generic Modal, so that the modal closes without saving any data.

#### Acceptance Criteria

1. WHEN the User clicks Cancel in the Generic Modal, THE System SHALL close the modal without calling any server function.
2. WHEN the Generic Modal closes via Cancel, THE System SHALL clear all input fields inside the modal body.

---

### Requirement 9: Incidents Report — Report Incident and Table Row Click

**User Story:** As a User, I want to report a new incident and view existing incident details, so that all emergency events are recorded and accessible.

#### Acceptance Criteria

1. WHEN the User clicks Report Incident, THE System SHALL open the Generic Modal titled "Report Incident" with fields: Incident Type, Location, Date & Time, Severity, and Remarks.
2. WHEN the User saves a new incident record, THE System SHALL immediately prepend a new row to the incidents table and then attempt to persist it to the "Incidents" Sheet.
3. WHEN the User clicks a row in the incidents table, THE System SHALL open the Generic Modal in view mode displaying that record's details.

---

### Requirement 10: Voucher Monitoring — Issue Voucher and Table Row Click

**User Story:** As a User, I want to issue a new voucher and view existing voucher details, so that financial assistance records are tracked.

#### Acceptance Criteria

1. WHEN the User clicks Issue Voucher, THE System SHALL open the Generic Modal titled "Issue Voucher" with fields: Beneficiary Name, Amount, Purpose, Date, and Status.
2. WHEN the User saves a new voucher record, THE System SHALL persist it to the "Vouchers" Sheet and prepend a new row to the voucher table.
3. WHEN the User clicks a row in the voucher table, THE System SHALL open the Generic Modal in view mode displaying that record's details.

---

### Requirement 11: Inventory — Register Gear, Export Sheet, and Table Row Click

**User Story:** As a User, I want to register new gear, export the inventory list, and view gear details, so that equipment assets are properly managed.

#### Acceptance Criteria

1. WHEN the User clicks Register Gear, THE System SHALL open the Generic Modal titled "Register Gear" with fields: Item Name, Category, Quantity, Condition, and Date Acquired.
2. WHEN the User saves a new inventory record and persistence succeeds, THE System SHALL prepend a new row to the inventory table.
3. IF persistence of an inventory record fails, THEN THE System SHALL show an error Toast and roll back any UI changes, keeping the table unchanged.
4. WHEN the User clicks Export Sheet, THE System SHALL call the server-side function `exportSheetToCSV('Inventory')` and trigger a file download of the sheet data as a CSV file.
5. WHEN the User clicks a row in the inventory table, THE System SHALL open the Generic Modal in view mode displaying that record's details.

---

### Requirement 12: Transportation Assistance — Dispatch Vehicle and Table Row Click

**User Story:** As a User, I want to dispatch a vehicle and view dispatch records, so that transportation assistance is logged.

#### Acceptance Criteria

1. WHEN the User clicks Dispatch Vehicle, THE System SHALL open the Generic Modal titled "Dispatch Vehicle" with fields: Vehicle, Driver, Destination, Date & Time, and Purpose.
2. WHEN the User saves a new dispatch record and persistence succeeds, THE System SHALL prepend a new row to the transport table.
3. IF persistence of a dispatch record fails, THEN THE System SHALL show an error Toast and roll back the row addition, keeping the table unchanged.
4. WHEN the User clicks a row in the transport table, THE System SHALL open the Generic Modal in view mode displaying that record's details.

---

### Requirement 13: Training Venues — Book Facility

**User Story:** As a User, I want to book a training facility, so that venue reservations are recorded.

#### Acceptance Criteria

1. WHEN the User clicks Book Facility, THE System SHALL open the Generic Modal titled "Book Facility" with fields: Facility Name, Date, Start Time, End Time, Purpose, and Booked By.
2. WHEN the User saves a new booking record and persistence succeeds, THE System SHALL prepend a new row to the venues table.
3. IF persistence of a booking record fails, THEN THE System SHALL show an error Toast and allow the User to retry without closing the modal.

---

### Requirement 14: Calendar Navigation and Day Click

**User Story:** As a User, I want to navigate between months and click on calendar days to add events, so that scheduled activities are visible and manageable.

#### Acceptance Criteria

1. WHEN the User clicks the previous month button on a Calendar, THE System SHALL re-render the calendar grid showing the previous month.
2. WHEN the User clicks the next month button on a Calendar, THE System SHALL re-render the calendar grid showing the next month.
3. WHEN the User clicks a day cell on a Calendar, THE System SHALL open the Generic Modal pre-filled with the selected date, titled "Add Calendar Event", with fields: Event Title, Date, and Notes, provided no calendar navigation button click is in progress.
4. IF a calendar navigation button click is in progress, THEN THE System SHALL not open the Generic Modal for a day cell click.
4. WHEN the User saves a calendar event, THE System SHALL persist it to the "CalendarEvents" Sheet and display a dot or label on the corresponding day cell.
5. THE System SHALL display existing calendar events on the correct day cells when the calendar is rendered.

---

### Requirement 15: Topbar Search

**User Story:** As a User, I want to type in the topbar search bar, so that I can quickly find records across the system.

#### Acceptance Criteria

1. WHEN the User types in the topbar search input, THE System SHALL filter the currently visible page's table rows to show only rows containing the search string (case-insensitive).
2. WHEN the topbar search input is cleared, THE System SHALL restore all rows in the currently visible table.
3. WHERE the active page has no table, THE System SHALL display a "No searchable content on this page" message below the search bar immediately upon navigating to that page.

---

### Requirement 16: Topbar Notification Bell

**User Story:** As a User, I want to click the notification bell, so that I can see recent system alerts.

#### Acceptance Criteria

1. WHEN the User clicks the notification bell, THE System SHALL display a dropdown panel listing the 5 most recent records saved across all modules.
2. WHEN the User clicks outside the notification dropdown, THE System SHALL close the dropdown.

---

### Requirement 17: Topbar Settings Button

**User Story:** As a User, I want to click the Settings button, so that I can access system configuration options.

#### Acceptance Criteria

1. WHEN the User clicks the Settings button, THE System SHALL display a settings dropdown with options: Change Password and About System.
2. WHEN the User selects Change Password from the settings dropdown, THE System SHALL navigate to `changePassScreen`.
3. WHEN the User selects About System, THE System SHALL display a modal with the system name, version, and office information, and this modal SHALL only appear when explicitly selected by the User from the settings dropdown.
4. WHEN the User clicks outside the settings dropdown, THE System SHALL close the dropdown.

---

### Requirement 18: Remaining Record Pages — Add/New Record Buttons

**User Story:** As a User, I want to add new records on the CDRRMO Activities, Events Needed Assistance, Training Attended, Training Conducted, Accredited CDV, CDRRMC & SP Reso, CDRRMC Meeting, Maps Available, Pruning/Trimming, History, and Documentations pages, so that all operational data is captured.

#### Acceptance Criteria

1. WHEN the User clicks the Add/New Record button on any of the listed pages, THE System SHALL open the Generic Modal with fields appropriate to that module.
2. WHEN the User saves a record from any of the listed pages, THE System SHALL persist it to the corresponding Sheet named after the module and prepend a new row to the visible table; IF persistence fails, THEN THE System SHALL show an error Toast and allow the User to retry.
3. THE System SHALL use the following Sheet names: "Activities", "EventsAssistance", "TrainingAttended", "TrainingConducted", "Volunteers", "CDRRMCReso", "CDRRMCMeeting", "MapsAvailable", "PruningTrimming", "History", "Documentations".

---

### Requirement 19: Server-Side `saveModuleRecord` Function

**User Story:** As a developer, I want a single server-side function that handles saving records for all non-employee modules, so that the backend is maintainable and consistent.

#### Acceptance Criteria

1. THE `saveModuleRecord` function SHALL accept a `moduleKey` string and a `data` object as parameters.
2. WHEN called, THE `saveModuleRecord` function SHALL open or create the Sheet corresponding to `moduleKey`.
3. WHEN the Sheet does not exist, THE `saveModuleRecord` function SHALL create it and write a header row derived from the keys of the `data` object.
4. THE `saveModuleRecord` function SHALL generate a unique ID for each record using a timestamp prefix.
5. WHEN the record is saved successfully, THE `saveModuleRecord` function SHALL return `{ success: true, id: newId }`.
6. IF an exception occurs at any step (including ID generation or response formatting), THEN THE `saveModuleRecord` function SHALL return `{ success: false, error: errorMessage }`.

---

### Requirement 20: Server-Side `getModuleRecords` Function

**User Story:** As a developer, I want a server-side function that retrieves all records for a given module, so that tables can be populated on page load.

#### Acceptance Criteria

1. THE `getModuleRecords` function SHALL accept a `moduleKey` string as a parameter.
2. WHEN called, THE `getModuleRecords` function SHALL return an array of objects representing all rows in the corresponding Sheet.
3. IF the Sheet does not exist or is empty, THEN THE `getModuleRecords` function SHALL return an empty array.

---

### Requirement 21: Server-Side `exportSheetToCSV` Function

**User Story:** As a developer, I want a server-side function that returns sheet data as a CSV string, so that the Export Sheet button can trigger a file download.

#### Acceptance Criteria

1. THE `exportSheetToCSV` function SHALL accept a `sheetName` string as a parameter.
2. WHEN called, THE `exportSheetToCSV` function SHALL return the sheet data as a properly escaped CSV string.
3. IF the Sheet named `sheetName` does not exist, THEN THE `exportSheetToCSV` function SHALL throw an error to distinguish a missing sheet from an empty sheet.

---

### Requirement 22: Table Row Click — View Record Detail

**User Story:** As a User, I want to click any table row on module pages, so that I can view the full details of that record.

#### Acceptance Criteria

1. WHEN the User clicks a table row on a module page, THE System SHALL open the Generic Modal in read-only view mode displaying all fields of that record.
2. WHEN the Generic Modal is in view mode, THE System SHALL display only a Close button and hide the Save Record button.
3. WHEN the User clicks Close in view mode, THE System SHALL close the Generic Modal.
