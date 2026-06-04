/**
 * CDRRMO Recording System
 * Google Apps Script Web App (Backend)
 */

const SPREADSHEET_ID = '1jbD-4TU25d5y4nFQTUsDFDpfy9Sd1dGSr0qc97VmQWw';
const SHEET_EMPLOYEES = 'Employees';

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('CDRRMO Recording System')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// Utility function to get the sheet
function getEmployeesSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_EMPLOYEES);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_EMPLOYEES);
    const headers = ["ID", "Name", "Username", "Password", "Role", "Email", "Phone", "Status", "Photo",
                     "Duties", "Seminars", "Trainings", "Children", "Remarks",
                     "DOB", "POB", "CivilStatus", "BloodType", "Address",
                     "Height", "Weight", "Waist", "ShirtSize", "ShoeSize",
                     "FatherName", "MotherName", "SpouseName",
                     "Office", "TIN", "Pagibig", "SSS", "GSIS", "Philhealth",
                     "Education", "Department", "Joined"];
    sheet.appendRow(headers);
  }
  return sheet;
}

// Convert 2D sheet data to Array of Objects
function sheetDataToObjectArray(data) {
  if (data.length <= 1) return [];
  const headers = data[0];
  const rows = data.slice(1);
  return rows.map(row => {
    let obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] !== undefined && row[index] !== null ? row[index] : '';
    });
    return obj;
  });
}

/**
 * Server-side login validation.
 */
function validateLogin(username, password) {
  try {
    const sheet = getEmployeesSheet();
    const data = sheet.getDataRange().getValues();
    const employees = sheetDataToObjectArray(data);

    const key = String(username || '').toLowerCase();

    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i];
      if (String(emp.Username).toLowerCase() === key && String(emp.Password) === String(password)) {
        return { success: true, username: emp.Username, role: emp.SystemRole || emp.Role || 'User', empId: emp.ID, name: emp.Name };
      }
    }


    return { success: false, error: 'Invalid username or password.' };
  } catch (e) {
    return { success: false, error: 'System error: ' + e.message };
  }
}

/**
 * Server-side password change.
 */
function changePassword(username, currentPassword, newPassword) {
  try {
    const sheet = getEmployeesSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const passwordColIndex = headers.indexOf('Password');
    const usernameColIndex = headers.indexOf('Username');

    if (passwordColIndex === -1 || usernameColIndex === -1) return { success: false, error: 'Sheet configuration error.' };

    const key = String(username || '').toLowerCase();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][usernameColIndex]).toLowerCase() === key && String(data[i][passwordColIndex]) === String(currentPassword)) {
        sheet.getRange(i + 1, passwordColIndex + 1).setValue(newPassword);
        return { success: true };
      }
    }

    return { success: false, error: 'Current password is incorrect.' };
  } catch (e) {
    return { success: false, error: 'System error: ' + e.message };
  }
}

/**
 * Get all employees — returns full profile data for the frontend.
 */
function getEmployees() {
  try {
    const sheet = getEmployeesSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const employees = sheetDataToObjectArray(data);

    return employees.map(emp => {
      let safeEmp = {
        id:          String(emp.ID          || ''),
        name:        String(emp.Name        || ''),
        username:    String(emp.Username    || ''),
        designation: String(emp.Role        || ''),
        email:       String(emp.Email       || ''),
        contact:     String(emp.Phone       || ''),
        dutyStatus:  String(emp.Status      || ''),
        photo:       String(emp.Photo       || ''),
        remarks:     String(emp.Remarks     || ''),
        role:        String(emp.SystemRole  || 'User'),
        dob:         String(emp.DOB         || ''),

        pob:         String(emp.POB         || ''),
        civilStatus: String(emp.CivilStatus || ''),
        bloodType:   String(emp.BloodType   || ''),
        address:     String(emp.Address     || ''),
        height:      String(emp.Height      || ''),
        weight:      String(emp.Weight      || ''),
        waist:       String(emp.Waist       || ''),
        shirtSize:   String(emp.ShirtSize   || ''),
        shoeSize:    String(emp.ShoeSize    || ''),
        fatherName:  String(emp.FatherName  || ''),
        motherName:  String(emp.MotherName  || ''),
        spouseName:  String(emp.SpouseName  || ''),
        office:      String(emp.Office      || ''),
        tin:         String(emp.TIN         || ''),
        pagibig:     String(emp.Pagibig     || ''),
        sss:         String(emp.SSS         || ''),
        gsis:        String(emp.GSIS        || ''),
        philhealth:  String(emp.Philhealth  || ''),
        education:   String(emp.Education   || ''),
        department:  String(emp.Department  || ''),
        joined:      String(emp.Joined      || ''),
        others:      String(emp.Remarks     || '')
      };

      try { safeEmp.duties    = emp.Duties    ? JSON.parse(emp.Duties)    : []; } catch(e) { safeEmp.duties    = []; }
      try { safeEmp.seminars  = emp.Seminars  ? JSON.parse(emp.Seminars)  : []; } catch(e) { safeEmp.seminars  = []; }
      try { safeEmp.trainings = emp.Trainings ? JSON.parse(emp.Trainings) : []; } catch(e) { safeEmp.trainings = []; }
      try { safeEmp.children  = emp.Children  ? JSON.parse(emp.Children)  : []; } catch(e) { safeEmp.children  = []; }

      return safeEmp;
    });
  } catch(e) {
    Logger.log('getEmployees error: ' + e.message);
    return [];
  }
}

/**
 * Save an employee (create or update).
 */
function saveEmployee(empData) {
  try {
    Logger.log('saveEmployee called with data: ' + JSON.stringify(empData));

    if (!empData) {
      return { success: false, error: 'No employee data provided' };
    }

    const sheet = getEmployeesSheet();
    const sheetData = sheet.getDataRange().getValues();
    let headers = sheetData[0];

    // Rebuild headers if empty/invalid
    if (!headers || headers.length === 0 || headers[0] === '' || headers[0] === null) {
      headers = ["ID", "Name", "Username", "Password", "Role", "Email", "Phone", "Status", "Photo",
                 "Duties", "Seminars", "Trainings", "Children", "Remarks",
                 "DOB", "POB", "CivilStatus", "BloodType", "Address",
                 "Height", "Weight", "Waist", "ShirtSize", "ShoeSize",
                 "FatherName", "MotherName", "SpouseName",
                 "Office", "TIN", "Pagibig", "SSS", "GSIS", "Philhealth",
                 "Education", "Department", "Joined", "SystemRole"];
      sheet.clear();
      sheet.appendRow(headers);
    }

    const dutiesStr    = (empData.duties    && Array.isArray(empData.duties))    ? JSON.stringify(empData.duties)    : '[]';
    const seminarsStr  = (empData.seminars  && Array.isArray(empData.seminars))  ? JSON.stringify(empData.seminars)  : '[]';
    const trainingsStr = (empData.trainings && Array.isArray(empData.trainings)) ? JSON.stringify(empData.trainings) : '[]';
    const childrenStr  = (empData.children  && Array.isArray(empData.children))  ? JSON.stringify(empData.children)  : '[]';

    const joined = empData.joined || ('Joined ' + new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));

    const idColIndex = headers.indexOf('ID');

    // Helper to build a complete row from headers
    function buildRow(existingRow) {
      return headers.map(function(header) {
        switch(header) {
          case 'ID':          return empData.id || '';
          case 'Name':        return empData.name || '';
          case 'Username':    return empData.username || (existingRow ? existingRow[headers.indexOf('Username')] : '');
          case 'Password':    return existingRow ? existingRow[headers.indexOf('Password')] : '123456';
          case 'Role':        return empData.designation || '';
          case 'SystemRole':  return empData.role || 'User';
          case 'Email':       return empData.email || '';
          case 'Phone':       return empData.contact || '';
          case 'Status':      return empData.dutyStatus || 'On Duty';
          case 'Photo':       return empData.photo || '';
          case 'Duties':      return dutiesStr;
          case 'Seminars':    return seminarsStr;
          case 'Trainings':   return trainingsStr;
          case 'Children':    return childrenStr;
          case 'Remarks':     return empData.remarks || empData.others || '';
          case 'DOB':         return empData.dob || '';
          case 'POB':         return empData.pob || '';
          case 'CivilStatus': return empData.civilStatus || '';
          case 'BloodType':   return empData.bloodType || '';
          case 'Address':     return empData.address || '';
          case 'Height':      return empData.height || '';
          case 'Weight':      return empData.weight || '';
          case 'Waist':       return empData.waist || '';
          case 'ShirtSize':   return empData.shirtSize || '';
          case 'ShoeSize':    return empData.shoeSize || '';
          case 'FatherName':  return empData.fatherName || '';
          case 'MotherName':  return empData.motherName || '';
          case 'SpouseName':  return empData.spouseName || '';
          case 'Office':      return empData.office || '';
          case 'TIN':         return empData.tin || '';
          case 'Pagibig':     return empData.pagibig || '';
          case 'SSS':         return empData.sss || '';
          case 'GSIS':        return empData.gsis || '';
          case 'Philhealth':  return empData.philhealth || '';
          case 'Education':   return empData.education || '';
          case 'Department':  return empData.department || 'General Operations';
          case 'Joined':      return joined;
          default:            return existingRow ? (existingRow[headers.indexOf(header)] || '') : '';
        }
      });
    }

    // Update existing employee
    if (empData.id && !empData.id.startsWith('EMP-NEW')) {
      const freshData = sheet.getDataRange().getValues();
      for (let i = 1; i < freshData.length; i++) {
        if (String(freshData[i][idColIndex]) === String(empData.id)) {
          const updateRow = buildRow(freshData[i]);
          sheet.getRange(i + 1, 1, 1, headers.length).setValues([updateRow]);
          Logger.log('Employee updated at row ' + (i + 1));
          return { success: true, message: 'Employee updated successfully.', id: empData.id };
        }
      }
    }

    // New employee
    const newId = 'EMP-' + new Date().getTime();
    empData.id = newId;
    const newRow = buildRow(null);
    sheet.appendRow(newRow);
    Logger.log('Employee added with ID: ' + newId);
    return { success: true, message: 'Employee added successfully.', id: newId };

  } catch (e) {
    Logger.log('Error in saveEmployee: ' + e.message + '\n' + e.stack);
    return { success: false, error: 'System error: ' + e.message };
  }
}

/**
 * Delete an employee.
 */
function deleteEmployee(empId) {
  try {
    const sheet = getEmployeesSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idColIndex = headers.indexOf('ID');

    if (idColIndex === -1) return { success: false, error: 'Sheet configuration error.' };

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idColIndex]) === String(empId)) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Employee deleted successfully.' };
      }
    }

    return { success: false, error: 'Employee not found.' };
  } catch (e) {
    return { success: false, error: 'System error: ' + e.message };
  }
}

/**
 * Update only the duty status of an employee.
 * More efficient than re-saving the full record.
 */
function updateEmployeeDutyStatus(empId, newStatus) {
  try {
    const allowed = ['On Duty', 'Off Duty', 'Standby', 'On Leave'];
    if (!allowed.includes(newStatus)) {
      return { success: false, error: 'Invalid duty status value.' };
    }

    const sheet = getEmployeesSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idColIndex = headers.indexOf('ID');
    const statusColIndex = headers.indexOf('Status');

    if (idColIndex === -1 || statusColIndex === -1) {
      return { success: false, error: 'Sheet configuration error.' };
    }

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idColIndex]) === String(empId)) {
        sheet.getRange(i + 1, statusColIndex + 1).setValue(newStatus);
        return { success: true, message: 'Duty status updated to ' + newStatus };
      }
    }

    return { success: false, error: 'Employee not found.' };
  } catch (e) {
    return { success: false, error: 'System error: ' + e.message };
  }
}

/**
 * Save a module record (generic function for all modules).
 */
function saveModuleRecord(moduleKey, recordData) {
  try {
    Logger.log('saveModuleRecord called with moduleKey: ' + moduleKey);
    Logger.log('Data: ' + JSON.stringify(recordData));

    if (!recordData) return { success: false, error: 'No data provided' };

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    const sheetNameMap = {
      'incidents':          'Incidents',
      'voucher':            'Vouchers',
      'inventory':          'Inventory',
      'transport':          'Transport',
      'venues':             'Venues',
      'activities':         'Activities',
      'events-assistance':  'EventsAssistance',
      'training-attended':  'TrainingAttended',
      'training-conducted': 'TrainingConducted',
      'volunteers':         'Volunteers',
      'cdrrmc-reso':        'CDRRMCReso',
      'cdrrmc-meeting':     'CDRRMCMeeting',
      'maps-available':     'MapsAvailable',
      'pruning-trimming':   'PruningTrimming',
      'history':            'History',
      'documentations':     'Documentations',
      'calendar-events':    'CalendarEvents',
      'command-center':     'CommandCenter'
    };

    const sheetName = sheetNameMap[moduleKey] || moduleKey;
    Logger.log('Using sheet name: ' + sheetName);

    let sheet = ss.getSheetByName(sheetName);

    // Generate ID and timestamp before touching the sheet
    const newId = 'REC-' + Date.now();
    
    // Format timestamp as MM/DD/YYYY | HH:MM AM/PM
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const savedAt = month + '/' + day + '/' + year + ' | ' + String(hours).padStart(2, '0') + ':' + minutes + ' ' + ampm;

    // Clone recordData so we don't mutate the argument
    const payload = {};
    Object.keys(recordData).forEach(function(k) { payload[k] = recordData[k]; });
    payload['id'] = newId;
    payload['_savedAt'] = savedAt;

    if (!sheet) {
      // Create sheet with headers derived from payload keys
      Logger.log('Sheet does not exist, creating: ' + sheetName);
      sheet = ss.insertSheet(sheetName);
      const headers = Object.keys(payload);
      sheet.appendRow(headers);
      const row = headers.map(function(h) { return payload[h] !== undefined ? payload[h] : ''; });
      sheet.appendRow(row);
      Logger.log('Sheet created and first row appended.');
      return { success: true, id: newId };
    }

    // Sheet exists — read current headers
    const existingData = sheet.getDataRange().getValues();
    let headers = (existingData && existingData.length > 0) ? existingData[0].map(String) : [];

    // If sheet is empty or headers row is blank, write headers from payload
    if (headers.length === 0 || (headers.length === 1 && headers[0] === '')) {
      headers = Object.keys(payload);
      sheet.clear();
      sheet.appendRow(headers);
    } else {
      // Add any new keys from payload that aren't in headers yet
      const payloadKeys = Object.keys(payload);
      const newKeys = payloadKeys.filter(function(k) { return headers.indexOf(k) === -1; });
      if (newKeys.length > 0) {
        headers = headers.concat(newKeys);
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        Logger.log('Added new header columns: ' + JSON.stringify(newKeys));
      }
    }

    // Build row matching header order
    const row = headers.map(function(header) {
      return (payload[header] !== undefined && payload[header] !== null) ? payload[header] : '';
    });

    Logger.log('Row to append: ' + JSON.stringify(row));
    sheet.appendRow(row);
    Logger.log('Row appended successfully');

    return { success: true, id: newId };
  } catch (e) {
    Logger.log('Error in saveModuleRecord: ' + e.message + '\n' + e.stack);
    return { success: false, error: e.message };
  }
}

/**
 * Get all records for a module.
 * Robust: handles any column order, including legacy sheets where headers are scrambled.
 */
function getModuleRecords(moduleKey) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    var sheetNameMap = {
      'incidents':          'Incidents',
      'voucher':            'Vouchers',
      'inventory':          'Inventory',
      'transport':          'Transport',
      'venues':             'Venues',
      'activities':         'Activities',
      'events-assistance':  'EventsAssistance',
      'training-attended':  'TrainingAttended',
      'training-conducted': 'TrainingConducted',
      'volunteers':         'Volunteers',
      'cdrrmc-reso':        'CDRRMCReso',
      'cdrrmc-meeting':     'CDRRMCMeeting',
      'maps-available':     'MapsAvailable',
      'pruning-trimming':   'PruningTrimming',
      'history':            'History',
      'documentations':     'Documentations',
      'calendar-events':    'CalendarEvents',
      'command-center':     'CommandCenter'
    };

    var sheetName = sheetNameMap[moduleKey] || moduleKey;
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];

    var data = sheet.getDataRange().getValues();
    if (!data || data.length === 0) return [];

    var firstRow = data[0];

    // A row is a header if at least one cell is a pure string (not a number or Date object)
    // AND does not look like a REC- id or ISO timestamp.
    // This is the most reliable heuristic across all sheet states.
    var isHeaderRow = firstRow.some(function(cell) {
      if (cell instanceof Date) return false;
      var s = String(cell).trim();
      if (s === '') return false;
      if (/^REC-\d+$/.test(s)) return false;            // looks like a record ID
      if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return false;  // looks like ISO timestamp
      if (/^\d+(\.\d+)?$/.test(s)) return false;         // pure number
      return true; // string text → treat as header
    });

    if (!isHeaderRow) {
      Logger.log('No header row detected in ' + sheetName + ', inserting one');
      var hdrValues = firstRow.map(function(v) { return String(v); });
      sheet.insertRowBefore(1);
      sheet.getRange(1, 1, 1, hdrValues.length).setValues([hdrValues]);
      data = sheet.getDataRange().getValues();
    }

    if (data.length <= 1) return [];

    // Parse to objects — column order doesn't matter, keys come from the header row
    var headers = data[0].map(function(h) { return String(h).trim(); });
    var records = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      // Skip completely empty rows
      var isEmpty = row.every(function(c) { return c === '' || c === null || c === undefined; });
      if (isEmpty) continue;
      var obj = {};
      headers.forEach(function(header, idx) {
        var val = row[idx];
        obj[header] = (val instanceof Date) ? val.toISOString() : (val !== undefined && val !== null ? String(val) : '');
      });
      records.push(obj);
    }

    Logger.log('getModuleRecords(' + moduleKey + '): returning ' + records.length + ' records');
    return records;

  } catch (e) {
    Logger.log('getModuleRecords error: ' + e.message);
    return [];
  }
}


/**
 * Export a sheet to CSV format.
 */
function exportSheetToCSV(sheetName) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) throw new Error('Sheet "' + sheetName + '" not found.');

    const data = sheet.getDataRange().getValues();

    const csv = data.map(row => {
      return row.map(cell => {
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return '"' + cellStr.replace(/"/g, '""') + '"';
        }
        return cellStr;
      }).join(',');
    }).join('\n');

    return csv;
  } catch (e) {
    throw new Error('Export failed: ' + e.message);
  }
}

/**
 * Update a single field in a module record.
 */
function updateModuleRecord(moduleKey, recordId, fieldKey, newValue) {
  try {
    const sheetNameMap = {
      'incidents':          'Incidents',
      'voucher':            'Vouchers',
      'inventory':          'Inventory',
      'transport':          'Transport',
      'venues':             'Venues',
      'activities':         'Activities',
      'events-assistance':  'EventsAssistance',
      'training-attended':  'TrainingAttended',
      'training-conducted': 'TrainingConducted',
      'volunteers':         'Volunteers',
      'cdrrmc-reso':        'CDRRMCReso',
      'cdrrmc-meeting':     'CDRRMCMeeting',
      'maps-available':     'MapsAvailable',
      'pruning-trimming':   'PruningTrimming',
      'history':            'History',
      'documentations':     'Documentations',
      'calendar-events':    'CalendarEvents',
      'command-center':     'CommandCenter'
    };
    const sheetName = sheetNameMap[moduleKey] || moduleKey;
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, error: 'Sheet not found.' };

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(String);
    const idCol = headers.indexOf('id') !== -1 ? headers.indexOf('id') : headers.indexOf('Id');
    const fieldCol = headers.indexOf(fieldKey);

    if (idCol === -1) return { success: false, error: 'id column not found in sheet.' };
    if (fieldCol === -1) return { success: false, error: 'Field "' + fieldKey + '" not found in sheet.' };

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idCol]) === String(recordId)) {
        sheet.getRange(i + 1, fieldCol + 1).setValue(newValue);
        return { success: true };
      }
    }
    return { success: false, error: 'Record not found.' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── VEHICLES SHEET ─────────────────────────────────────────────────────────

function getVehiclesSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('Vehicles');
  if (!sheet) {
    sheet = ss.insertSheet('Vehicles');
    sheet.appendRow(['ID', 'Plate', 'Model', 'Manufacturer', 'Type', 'Status', 'Notes', 'DateAdded']);
  }
  return sheet;
}

function getVehicles() {
  try {
    const sheet = getVehiclesSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    const headers = data[0];
    return data.slice(1).map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = row[i] !== null && row[i] !== undefined ? row[i] : ''; });
      return obj;
    });
  } catch (e) {
    return [];
  }
}

function saveVehicle(vehicleData) {
  try {
    const sheet = getVehiclesSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idCol = headers.indexOf('ID');

    // Check duplicate plate on new
    if (!vehicleData.ID) {
      const plateCol = headers.indexOf('Plate');
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][plateCol]).toUpperCase() === String(vehicleData.Plate).toUpperCase()) {
          return { success: false, error: 'A vehicle with this plate number already exists.' };
        }
      }
      vehicleData.ID = 'VEH-' + Date.now();
      vehicleData.DateAdded = new Date().toLocaleDateString('en-US');
    }

    const row = headers.map(function(h) { return vehicleData[h] !== undefined ? vehicleData[h] : ''; });

    // Update existing
    for (var j = 1; j < data.length; j++) {
      if (String(data[j][idCol]) === String(vehicleData.ID)) {
        sheet.getRange(j + 1, 1, 1, headers.length).setValues([row]);
        return { success: true, id: vehicleData.ID };
      }
    }

    // New row
    sheet.appendRow(row);
    return { success: true, id: vehicleData.ID };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function deleteVehicle(vehicleId) {
  try {
    const sheet = getVehiclesSheet();
    const data = sheet.getDataRange().getValues();
    const idCol = data[0].indexOf('ID');
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idCol]) === String(vehicleId)) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { success: false, error: 'Vehicle not found.' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── DRIVERS SHEET ──────────────────────────────────────────────────────────

function getDriversSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('Drivers');
  if (!sheet) {
    sheet = ss.insertSheet('Drivers');
    sheet.appendRow(['ID', 'Name', 'LicenseNo', 'LicenseExpiry', 'Contact', 'Status', 'Notes', 'DateAdded']);
  }
  return sheet;
}

function getDrivers() {
  try {
    const sheet = getDriversSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    const headers = data[0];
    return data.slice(1).map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = row[i] !== null && row[i] !== undefined ? row[i] : ''; });
      return obj;
    });
  } catch (e) {
    return [];
  }
}

function saveDriver(driverData) {
  try {
    const sheet = getDriversSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idCol = headers.indexOf('ID');

    if (!driverData.ID) {
      driverData.ID = 'DRV-' + Date.now();
      driverData.DateAdded = new Date().toLocaleDateString('en-US');
    }

    const row = headers.map(function(h) { return driverData[h] !== undefined ? driverData[h] : ''; });

    // Update existing
    for (var j = 1; j < data.length; j++) {
      if (String(data[j][idCol]) === String(driverData.ID)) {
        sheet.getRange(j + 1, 1, 1, headers.length).setValues([row]);
        return { success: true, id: driverData.ID };
      }
    }

    // New row
    sheet.appendRow(row);
    return { success: true, id: driverData.ID };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function deleteDriver(driverId) {
  try {
    const sheet = getDriversSheet();
    const data = sheet.getDataRange().getValues();
    const idCol = data[0].indexOf('ID');
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idCol]) === String(driverId)) {
        sheet.deleteRow(i + 1);
        return { success: true };
      }
    }
    return { success: false, error: 'Driver not found.' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}



/**
 * Test function to verify saveEmployee works with sample data
 */
function testSaveEmployee() {
  const testData = {
    id: 'EMP-NEW-TEST',
    name: 'Test Employee',
    username: 'test.employee',
    designation: 'Test Officer',
    email: 'test@cdrrmo.gov.ph',
    contact: '0917-123-4567',
    dutyStatus: 'Active',
    photo: '',
    dob: '1990-01-15',
    pob: 'Palayan City',
    civilStatus: 'Single',
    bloodType: 'O+',
    address: 'Test Address, Palayan City',
    height: '170 cm',
    weight: '65 kg',
    duties: [],
    seminars: [],
    trainings: [],
    children: [],
    remarks: 'Test employee created for testing'
  };
  
  const result = saveEmployee(testData);
  Logger.log('Test result: ' + JSON.stringify(result));
  
  if (result.success) {
    Logger.log('✅ Employee saved successfully with ID: ' + result.id);
    Logger.log('Check your Employees sheet now!');
  } else {
    Logger.log('❌ Failed to save: ' + result.error);
  }
  
  return result;
}

/**
 * Test function to check if getEmployees returns data
 */
function testGetEmployees() {
  const employees = getEmployees();
  Logger.log('Number of employees found: ' + employees.length);
  
  if (employees.length > 0) {
    Logger.log('✅ Found employees:');
    employees.forEach(function(emp, index) {
      Logger.log((index + 1) + '. ' + emp.name + ' (' + emp.id + ')');
    });
  } else {
    Logger.log('❌ No employees found in the sheet');
  }
  
  return employees;
}

/**
 * Clear all employees (use with caution!)
 */
function clearAllEmployees() {
  const sheet = getEmployeesSheet();
  sheet.clear();
  const headers = ["ID", "Name", "Username", "Password", "Role", "Email", "Phone", "Status", "Photo", "Duties", "Seminars", "Trainings", "Children", "Remarks"];
  sheet.appendRow(headers);
  Logger.log('✅ All employees cleared. Headers recreated.');
  return { success: true, message: 'Employees sheet cleared' };
}


// ═══════════════════════════════════════════════════════════════════════════
// VEHICLES MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

const SHEET_VEHICLES = 'Vehicles';

function getVehiclesSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_VEHICLES);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_VEHICLES);
    const headers = ["ID", "Plate", "Model", "Manufacturer", "Year", "Type", "Capacity", "Status", "LastMaintenance", "Notes"];
    sheet.appendRow(headers);
  }
  return sheet;
}

/**
 * Get all vehicles
 */
function getVehicles() {
  try {
    const sheet = getVehiclesSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    
    const vehicles = sheetDataToObjectArray(data);
    
    return vehicles.map(v => ({
      ID: String(v.ID || ''),
      Plate: String(v.Plate || ''),
      Model: String(v.Model || ''),
      Manufacturer: String(v.Manufacturer || ''),
      Year: String(v.Year || ''),
      Type: String(v.Type || ''),
      Capacity: String(v.Capacity || ''),
      Status: String(v.Status || 'Available'),
      LastMaintenance: String(v.LastMaintenance || ''),
      Notes: String(v.Notes || '')
    }));
  } catch(e) {
    Logger.log('getVehicles error: ' + e.message);
    return [];
  }
}

/**
 * Save a vehicle (create or update)
 */
function saveVehicle(vehicleData) {
  try {
    Logger.log('saveVehicle called with: ' + JSON.stringify(vehicleData));
    
    if (!vehicleData) {
      return { success: false, error: 'No vehicle data provided' };
    }
    
    const sheet = getVehiclesSheet();
    const data = sheet.getDataRange().getValues();
    let headers = data[0];
    
    // Check if headers are empty or invalid
    if (!headers || headers.length === 0 || headers[0] === '' || headers[0] === null) {
      headers = ["ID", "Plate", "Model", "Manufacturer", "Year", "Type", "Capacity", "Status", "LastMaintenance", "Notes"];
      sheet.clear();
      sheet.appendRow(headers);
    }
    
    const idColIndex = headers.indexOf('ID');
    
    // Check if updating
    if (vehicleData.ID && !vehicleData.ID.startsWith("VEH-NEW")) {
      const searchId = vehicleData.ID;
      const sheetData = sheet.getDataRange().getValues();
      
      for (let i = 1; i < sheetData.length; i++) {
        if (String(sheetData[i][idColIndex]) === String(searchId)) {
          // Update existing row
          let updateRow = [];
          headers.forEach((header) => {
            if (header === 'ID') updateRow.push(searchId);
            else if (header === 'Plate') updateRow.push(vehicleData.Plate || '');
            else if (header === 'Model') updateRow.push(vehicleData.Model || '');
            else if (header === 'Manufacturer') updateRow.push(vehicleData.Manufacturer || '');
            else if (header === 'Year') updateRow.push(vehicleData.Year || '');
            else if (header === 'Type') updateRow.push(vehicleData.Type || '');
            else if (header === 'Capacity') updateRow.push(vehicleData.Capacity || '');
            else if (header === 'Status') updateRow.push(vehicleData.Status || 'Available');
            else if (header === 'LastMaintenance') updateRow.push(vehicleData.LastMaintenance || '');
            else if (header === 'Notes') updateRow.push(vehicleData.Notes || '');
            else updateRow.push(vehicleData[header] || sheetData[i][headers.indexOf(header)] || '');
          });
          sheet.getRange(i + 1, 1, 1, headers.length).setValues([updateRow]);
          Logger.log('Vehicle updated at row ' + (i + 1));
          return { success: true, message: 'Vehicle updated successfully.', id: searchId };
        }
      }
    }
    
    // If no ID or not found, append new row
    const newId = vehicleData.ID && !vehicleData.ID.startsWith("VEH-NEW") ? vehicleData.ID : 'VEH-' + new Date().getTime();
    Logger.log('Creating new vehicle with ID: ' + newId);
    
    let newRow = [];
    headers.forEach((header) => {
      if (header === 'ID') newRow.push(newId);
      else if (header === 'Plate') newRow.push(vehicleData.Plate || '');
      else if (header === 'Model') newRow.push(vehicleData.Model || '');
      else if (header === 'Manufacturer') newRow.push(vehicleData.Manufacturer || '');
      else if (header === 'Year') newRow.push(vehicleData.Year || '');
      else if (header === 'Type') newRow.push(vehicleData.Type || '');
      else if (header === 'Capacity') newRow.push(vehicleData.Capacity || '');
      else if (header === 'Status') newRow.push(vehicleData.Status || 'Available');
      else if (header === 'LastMaintenance') newRow.push(vehicleData.LastMaintenance || '');
      else if (header === 'Notes') newRow.push(vehicleData.Notes || '');
      else newRow.push(vehicleData[header] || '');
    });
    
    sheet.appendRow(newRow);
    Logger.log('Vehicle added successfully');
    
    return { success: true, message: 'Vehicle added successfully.', id: newId };
  } catch (e) {
    Logger.log('saveVehicle error: ' + e.message);
    return { success: false, error: 'System error: ' + e.message };
  }
}

/**
 * Delete a vehicle
 */
function deleteVehicle(vehicleId) {
  try {
    const sheet = getVehiclesSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idColIndex = headers.indexOf('ID');
    
    if (idColIndex === -1) return { success: false, error: 'Sheet configuration error.' };
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idColIndex]) === String(vehicleId)) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Vehicle deleted successfully.' };
      }
    }
    
    return { success: false, error: 'Vehicle not found.' };
  } catch (e) {
    return { success: false, error: 'System error: ' + e.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DRIVERS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

const SHEET_DRIVERS = 'Drivers';

function getDriversSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_DRIVERS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_DRIVERS);
    const headers = ["ID", "Name", "LicenseNo", "LicenseExpiry", "Contact", "Status", "Notes"];
    sheet.appendRow(headers);
  }
  return sheet;
}

/**
 * Get all drivers
 */
function getDrivers() {
  try {
    const sheet = getDriversSheet();
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    
    const drivers = sheetDataToObjectArray(data);
    
    return drivers.map(d => ({
      ID: String(d.ID || ''),
      Name: String(d.Name || ''),
      LicenseNo: String(d.LicenseNo || ''),
      LicenseExpiry: String(d.LicenseExpiry || ''),
      Contact: String(d.Contact || ''),
      Status: String(d.Status || 'Available'),
      Notes: String(d.Notes || '')
    }));
  } catch(e) {
    Logger.log('getDrivers error: ' + e.message);
    return [];
  }
}

/**
 * Save a driver (create or update)
 */
function saveDriver(driverData) {
  try {
    Logger.log('saveDriver called with: ' + JSON.stringify(driverData));
    
    if (!driverData) {
      return { success: false, error: 'No driver data provided' };
    }
    
    const sheet = getDriversSheet();
    const data = sheet.getDataRange().getValues();
    let headers = data[0];
    
    // Check if headers are empty or invalid
    if (!headers || headers.length === 0 || headers[0] === '' || headers[0] === null) {
      headers = ["ID", "Name", "LicenseNo", "LicenseExpiry", "Contact", "Status", "Notes"];
      sheet.clear();
      sheet.appendRow(headers);
    }
    
    const idColIndex = headers.indexOf('ID');
    
    // Check if updating
    if (driverData.ID && !driverData.ID.startsWith("DRV-NEW")) {
      const searchId = driverData.ID;
      const sheetData = sheet.getDataRange().getValues();
      
      for (let i = 1; i < sheetData.length; i++) {
        if (String(sheetData[i][idColIndex]) === String(searchId)) {
          // Update existing row
          let updateRow = [];
          headers.forEach((header) => {
            if (header === 'ID') updateRow.push(searchId);
            else if (header === 'Name') updateRow.push(driverData.Name || '');
            else if (header === 'LicenseNo') updateRow.push(driverData.LicenseNo || '');
            else if (header === 'LicenseExpiry') updateRow.push(driverData.LicenseExpiry || '');
            else if (header === 'Contact') updateRow.push(driverData.Contact || '');
            else if (header === 'Status') updateRow.push(driverData.Status || 'Available');
            else if (header === 'Notes') updateRow.push(driverData.Notes || '');
            else updateRow.push(driverData[header] || sheetData[i][headers.indexOf(header)] || '');
          });
          sheet.getRange(i + 1, 1, 1, headers.length).setValues([updateRow]);
          Logger.log('Driver updated at row ' + (i + 1));
          return { success: true, message: 'Driver updated successfully.', id: searchId };
        }
      }
    }
    
    // If no ID or not found, append new row
    const newId = driverData.ID && !driverData.ID.startsWith("DRV-NEW") ? driverData.ID : 'DRV-' + new Date().getTime();
    Logger.log('Creating new driver with ID: ' + newId);
    
    let newRow = [];
    headers.forEach((header) => {
      if (header === 'ID') newRow.push(newId);
      else if (header === 'Name') newRow.push(driverData.Name || '');
      else if (header === 'LicenseNo') newRow.push(driverData.LicenseNo || '');
      else if (header === 'LicenseExpiry') newRow.push(driverData.LicenseExpiry || '');
      else if (header === 'Contact') newRow.push(driverData.Contact || '');
      else if (header === 'Status') newRow.push(driverData.Status || 'Available');
      else if (header === 'Notes') newRow.push(driverData.Notes || '');
      else newRow.push(driverData[header] || '');
    });
    
    sheet.appendRow(newRow);
    Logger.log('Driver added successfully');
    
    return { success: true, message: 'Driver added successfully.', id: newId };
  } catch (e) {
    Logger.log('saveDriver error: ' + e.message);
    return { success: false, error: 'System error: ' + e.message };
  }
}

/**
 * Delete a driver
 */
function deleteDriver(driverId) {
  try {
    const sheet = getDriversSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const idColIndex = headers.indexOf('ID');
    
    if (idColIndex === -1) return { success: false, error: 'Sheet configuration error.' };
    
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idColIndex]) === String(driverId)) {
        sheet.deleteRow(i + 1);
        return { success: true, message: 'Driver deleted successfully.' };
      }
    }
    
    return { success: false, error: 'Driver not found.' };
  } catch (e) {
    return { success: false, error: 'System error: ' + e.message };
  }
}
