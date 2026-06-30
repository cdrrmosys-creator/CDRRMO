const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envStr = fs.readFileSync('.env', 'utf8');
const supabaseUrl = envStr.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envStr.match(/VITE_SUPABASE_SERVICE_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixData() {
  console.log('Fetching vehicles...');
  const { data: vData } = await supabase.from('vehicles').select('plate');
  const validPlates = vData.map(v => v.plate.toLowerCase());

  console.log('Fetching transport records...');
  const { data: tData } = await supabase.from('transport').select('id, vehicle, driver');

  const updates = [];

  tData.forEach(t => {
    let needsUpdate = false;
    let newDriver = t.driver;
    let newVehicle = t.vehicle;

    // Fix empty driver
    if (!newDriver || newDriver.trim() === '') {
      newDriver = 'Driver';
      needsUpdate = true;
    }

    // Fix invalid vehicle
    if (!newVehicle || !validPlates.includes(newVehicle.toLowerCase())) {
      newVehicle = 'ambu 1';
      needsUpdate = true;
    }

    if (needsUpdate) {
      updates.push(
        supabase.from('transport').update({ driver: newDriver, vehicle: newVehicle }).eq('id', t.id)
      );
    }
  });

  console.log(`Applying ${updates.length} updates...`);
  
  // Wait for all updates to finish
  const results = await Promise.all(updates);
  const errors = results.filter(r => r.error).map(r => r.error);
  
  if (errors.length > 0) {
    console.error('Errors occurred during update:', errors);
  } else {
    console.log('Successfully updated all records!');
  }
}

fixData();
