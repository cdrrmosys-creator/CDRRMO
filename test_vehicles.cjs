const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const envStr = fs.readFileSync('.env', 'utf8');
const supabaseUrl = envStr.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = envStr.match(/VITE_SUPABASE_SERVICE_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: vData, error: vErr } = await supabase.from('vehicles').select('*');
  console.log('Vehicles:', vData ? vData[0] : null, vErr);
  
  const { data: dData, error: dErr } = await supabase.from('drivers').select('*');
  console.log('Drivers:', dData ? dData[0] : null, dErr);
}
check();
