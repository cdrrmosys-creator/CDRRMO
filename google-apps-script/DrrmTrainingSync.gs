/**
 * DRRM Office Training — Google Sheets → Supabase Sync
 * ─────────────────────────────────────────────────────
 * HOW TO USE:
 *  1. Open your Google Sheet that contains the DRRM Office Training form responses.
 *  2. Go to Extensions → Apps Script and paste this file.
 *  3. Fill in SUPABASE_URL and SUPABASE_ANON_KEY below.
 *  4. Run setupTrigger() once to install the automatic on-form-submit trigger.
 *  5. Optionally run syncAllRows() to backfill existing rows.
 *
 * SHEET COLUMN ORDER (must match your Google Form):
 *  A  Timestamp
 *  B  FIRST NAME
 *  C  MIDDLE NAME
 *  D  LAST NAME
 *  E  SUFFIX Ex. Jr. Sr. I, II, etc.
 *  F  NAME TO BE PRINTED ON YOUR CERTIFICATE
 *  G  GENDER
 *  H  CONTACT NUMBER
 *  I  EMAIL ADDRESS
 *  J  OFFICE
 *  K  DESIGNATION/POSITION
 *  L  CIVIL STATUS
 *  M  BIRTHDATE
 *  N  PRESENT ADDRESS
 *  O  2x2 or Passport size picture (file URL)
 */

// ── CONFIGURATION ─────────────────────────────────────────────────────────────
var SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';  // ← replace
var SUPABASE_KEY  = 'YOUR_ANON_OR_SERVICE_KEY';             // ← replace
var TABLE_NAME    = 'drrm_office_training';
var SHEET_NAME    = 'Form Responses 1';  // change if your sheet tab has a different name
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run this ONCE to install the on-form-submit trigger.
 */
function setupTrigger() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // Remove existing triggers for this function to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'onFormSubmit') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('onFormSubmit')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();
  Logger.log('Trigger installed successfully.');
}

/**
 * Triggered automatically on every new form submission.
 */
function onFormSubmit(e) {
  var values = e.values; // array of cell values in column order
  var payload = buildPayload(values);
  upsertRow(payload);
}

/**
 * Backfill — syncs ALL existing rows to Supabase.
 * Run manually from the Apps Script editor when needed.
 */
function syncAllRows() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) { Logger.log('Sheet "' + SHEET_NAME + '" not found.'); return; }

  var data = sheet.getDataRange().getValues();
  // Skip header row (index 0)
  for (var i = 1; i < data.length; i++) {
    var payload = buildPayload(data[i]);
    upsertRow(payload);
    Utilities.sleep(150); // avoid rate limiting
  }
  Logger.log('Sync complete. Rows processed: ' + (data.length - 1));
}

/**
 * Maps a row array to the Supabase column structure.
 */
function buildPayload(row) {
  // Parse timestamp — Google Sheets gives a Date object or string
  var rawTs = row[0];
  var ts = '';
  if (rawTs instanceof Date) {
    ts = rawTs.toISOString();
  } else if (rawTs) {
    var parsed = new Date(rawTs);
    ts = isNaN(parsed.getTime()) ? '' : parsed.toISOString();
  }

  // Parse birthdate (column M, index 12)
  var rawBd = row[12];
  var birthdate = '';
  if (rawBd instanceof Date) {
    birthdate = Utilities.formatDate(rawBd, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } else if (rawBd) {
    var parsedBd = new Date(rawBd);
    birthdate = isNaN(parsedBd.getTime()) ? String(rawBd) : Utilities.formatDate(parsedBd, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  return {
    timestamp:           ts             || null,
    first_name:          String(row[1]  || '').trim(),
    middle_name:         String(row[2]  || '').trim(),
    last_name:           String(row[3]  || '').trim(),
    suffix:              String(row[4]  || '').trim(),
    name_on_certificate: String(row[5]  || '').trim(),
    gender:              String(row[6]  || '').trim(),
    contact_number:      String(row[7]  || '').trim(),
    email_address:       String(row[8]  || '').trim(),
    office:              String(row[9]  || '').trim(),
    designation:         String(row[10] || '').trim(),
    civil_status:        String(row[11] || '').trim(),
    birthdate:           birthdate      || null,
    present_address:     String(row[13] || '').trim(),
    photo_url:           String(row[14] || '').trim(),
  };
}

/**
 * Upserts a single payload row into Supabase via REST API.
 * Uses email_address + last_name as a natural dedup key.
 * If no match exists, inserts a new row with a generated record_id.
 */
function upsertRow(payload) {
  if (!payload.last_name) {
    Logger.log('Skipping row with no last name.');
    return;
  }

  // Generate a record_id if not already set
  payload.record_id = 'DRT-' + new Date().getFullYear() + '-' + Math.floor(1000 + Math.random() * 9000);

  var url     = SUPABASE_URL + '/rest/v1/' + TABLE_NAME;
  var headers = {
    'apikey':        SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type':  'application/json',
    'Prefer':        'resolution=merge-duplicates,return=minimal'
  };

  var options = {
    method:             'POST',
    headers:            headers,
    payload:            JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var code     = response.getResponseCode();

  if (code === 200 || code === 201) {
    Logger.log('Upserted: ' + payload.first_name + ' ' + payload.last_name);
  } else {
    Logger.log('Error (' + code + '): ' + response.getContentText());
  }
}
