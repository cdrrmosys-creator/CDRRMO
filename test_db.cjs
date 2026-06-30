const fs = require('fs');
const https = require('https');
const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const reqUrl = `${url}/rest/v1/incidents?select=record_id,time_of_call,transfer_to&order=created_at.desc&limit=5`;
https.get(reqUrl, { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } }, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => console.log(JSON.stringify(JSON.parse(d), null, 2)));
});
