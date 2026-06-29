// ==========================================
// CDRRMO Incidents Sync to Supabase
// ==========================================
// Setup Instructions:
// 1. Open your Incidents Google Sheet.
// 2. Go to Extensions > Apps Script.
// 3. Delete any code there and paste this entire script.
// 4. Save the project.
// 5. Run 'importExistingIncidents' ONCE to push all existing data to Supabase.
// 6. Go to Triggers (clock icon on the left) > Add Trigger.
// 7. Choose 'onIncidentFormSubmit', Event source: 'From spreadsheet', Event type: 'On form submit'.
// 8. Save the trigger. Now, every new form response will auto-sync!

const SUPABASE_URL = 'https://bakohorlnjuvqgwslzfm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJha29ob3Jsbmp1dnFnd3NsemZtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDQ1MDk4MiwiZXhwIjoyMDk2MDI2OTgyfQ.44JPRxoof64uqa2PjJuyq3BhRQChrtICXKJ4EiceDwQ'; // Using service_role key to bypass RLS

/**
 * Trigger this on Form Submit
 */
function onIncidentFormSubmit(e) {
  try {
    const sheet = e.source.getActiveSheet();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const rowValues = e.values; // form submitted values
    
    // Map headers to values
    let rowData = {};
    for (let i = 0; i < headers.length; i++) {
      let header = String(headers[i]).trim();
      rowData[header] = rowValues[i] || '';
    }
    
    const payload = mapIncidentData(rowData);
    if (!payload) return;
    
    sendToSupabase([payload]);
  } catch (error) {
    Logger.log('Error in onIncidentFormSubmit: ' + error.message);
  }
}

/**
 * Run this function manually ONE TIME to import all existing data
 */
function importExistingIncidents() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    Logger.log("No data to import.");
    return;
  }
  
  const headers = data[0].map(h => String(h).trim());
  let payloads = [];
  
  for (let i = 1; i < data.length; i++) {
    let row = data[i];
    let isEmpty = row.every(cell => cell === '' || cell === null);
    if (isEmpty) continue;
    
    let rowData = {};
    headers.forEach((header, index) => {
      rowData[header] = row[index];
    });
    
    let payload = mapIncidentData(rowData);
    if (payload) {
      payloads.push(payload);
    }
  }
  
  // Bulk insert to Supabase in chunks of 50 to avoid timeout
  const chunkSize = 50;
  for (let i = 0; i < payloads.length; i += chunkSize) {
    let chunk = payloads.slice(i, i + chunkSize);
    sendToSupabase(chunk);
    Logger.log(`Imported rows ${i + 1} to ${i + chunk.length}`);
  }
  
  Logger.log("Import Complete!");
}

/**
 * Helper to send data to Supabase
 */
function sendToSupabase(dataArray) {
  const url = `${SUPABASE_URL}/rest/v1/incidents`;
  const options = {
    method: 'post',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    payload: JSON.stringify(dataArray),
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() >= 400) {
    Logger.log('Supabase Error: ' + response.getContentText());
  }
}

/**
 * Helper to map Google Sheets row data to Supabase schema
 */
function mapIncidentData(row) {
  // Generate a random record_id like INC-YYYY-XXXX
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  const record_id = `INC-${year}-${rand}-${Math.floor(Math.random() * 10000)}`;

  let dateVal = null;
  if (row['DATE']) {
    let d = new Date(row['DATE']);
    if (!isNaN(d.getTime())) {
      dateVal = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
  }

  let ageVal = parseInt(row['AGE'], 10);
  if (isNaN(ageVal)) ageVal = null;
  
  let refusedStr = String(row['REFUSED TO TRANSPORT TO HOSPITAL'] || '').toLowerCase();
  let refused = refusedStr.includes('yes') || refusedStr === 'true';

  let createdAt = new Date().toISOString();
  if (row['Timestamp']) {
    let d = new Date(row['Timestamp']);
    if (!isNaN(d.getTime())) {
      createdAt = d.toISOString();
    }
  }

  return {
    record_id: record_id,
    team: String(row['TEAM:'] || ''),
    date: dateVal,
    time_of_call: String(row['TME OF CALL'] || ''),
    time_of_arrival_at_scene: String(row['TIME OF ARRIVAL AT SCENE'] || ''),
    time_of_departure_at_scene: String(row['TIME OF DEPARTURE AT SCENE'] || ''),
    time_of_arrival_at_hosp: String(row['TME OF ARRIVAL AT HOSPITAL'] || ''),
    time_of_departure_at_hosp: String(row['TIME OF DEPARTURE AT HOSPITAL'] || ''),
    back_to_base: String(row['BACK TO BASE'] || ''),
    place_of_incident: String(row['PLACE OF INCIDENT'] || ''),
    nature_of_incident: String(row['NATURE OF INCIDENT'] || ''),
    name: String(row['NAME'] || ''),
    age: ageVal,
    address: String(row['ADDRESS'] || ''),
    injury_illness_complaint: String(row['INJURY, ILLNESS, COMPLAINT'] || ''),
    vehicle: String(row['PATIENT OF WHAT VEHICLE'] || ''),
    helmet: String(row['HELMET'] || ''),
    liquor: String(row['LIQUOR'] || ''),
    action_given: String(row['ACTION GIVEN'] || ''),
    transfer_from: String(row['TRANSFER FROM:'] || ''),
    transfer_to: String(row['TRANSFER TO:'] || ''),
    ambulance: String(row['AMBULANCE'] || ''),
    refused_transfer: refused,
    exact_place: String(row['EXACT PLACE OF INCIDENT'] || ''),
    severity: 'Low',
    created_at: createdAt
  };
}
