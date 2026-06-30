const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse .env
const envStr = fs.readFileSync('.env', 'utf8');
const supabaseUrl = envStr.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envStr.match(/VITE_SUPABASE_SERVICE_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

// Convert any time value (HH:MM, full datetime string, etc.) to h:mm AM/PM
const formatTime = (t) => {
  if (!t) return ''
  const str = String(t).trim()
  const match = str.match(/(\d{1,2}):(\d{2})/)
  if (!match) return str
  let h = parseInt(match[1], 10)
  const m = match[2]
  if (isNaN(h)) return str
  const isPMStr = /pm/i.test(str)
  const isAMStr = /am/i.test(str)
  if (isPMStr && h < 12) h += 12
  if (isAMStr && h === 12) h = 0
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m} ${period}`
}

async function migrate() {
  console.log('Fetching incidents...');
  // Fetch all incidents
  const { data: incidents, error: fetchErr } = await supabase
    .from('incidents')
    .select('*');

  if (fetchErr) {
    console.error('Error fetching incidents:', fetchErr);
    return;
  }

  // Filter for those that have a transfer destination or origin
  const toMigrate = incidents.filter(inc => {
    return (inc.transfer_to && inc.transfer_to !== 'N/A' && inc.transfer_to.trim() !== '') || 
           (inc.transfer_from && inc.transfer_from !== 'N/A' && inc.transfer_from.trim() !== '');
  });

  console.log(`Found ${toMigrate.length} incidents with transfer data.`);

  if (toMigrate.length === 0) {
    console.log('Nothing to migrate.');
    return;
  }

  const transportRecords = toMigrate.map(inc => {
    // Determine destination (prioritize transfer_to, then transfer_from)
    let dest = inc.transfer_to === 'Other' ? inc.transfer_to_other : inc.transfer_to;
    if (!dest || dest.trim() === '') {
      dest = inc.transfer_from;
    }

    // Determine datetime
    const dateStr = inc.date || (inc.created_at ? inc.created_at.split('T')[0] : '');
    const timeStr = formatTime(inc.time_of_call) || formatTime(inc.time_of_arrival_at_scene) || '';
    const dateTimeCombined = [dateStr, timeStr].filter(Boolean).join(' ');

    return {
      record_id: `TR-${inc.record_id ? inc.record_id.replace('INC-', '') : Date.now()}`,
      vehicle: inc.ambulance || inc.vehicle || '',
      driver: '',
      team: inc.team || '',
      responder: '',
      destination: dest || '',
      date_time: dateTimeCombined || new Date().toISOString(),
      purpose: inc.nature_of_incident || 'Incident Response & Transfer',
      patient_name: inc.name || '',
      patient_age: inc.age ? String(inc.age) : '',
      patient_address: inc.address || '',
      patient_contact: '',
      injury_illness: inc.injury_illness_complaint || '',
      action_given: inc.action_given || '',
      remarks: `Migrated automatically from Incident record: ${inc.record_id}`,
      description: inc.exact_place ? `Exact Place: ${inc.exact_place}` : '',
      photos: inc.photos || []
    };
  });

  console.log(`Inserting ${transportRecords.length} records into transport module...`);

  // Insert in batches if many, but we can try single insert since it's probably < 1000
  const { data: inserted, error: insertErr } = await supabase
    .from('transport')
    .insert(transportRecords)
    .select('id');

  if (insertErr) {
    console.error('Error inserting into transport:', insertErr);
    return;
  }

  console.log(`Successfully migrated ${inserted.length} records!`);
}

migrate();
