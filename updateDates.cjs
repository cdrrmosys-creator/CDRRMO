const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'src');

const exceptions = ['Venues', 'Vehicles', 'CalendarEvents', 'EventsAssistance'];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.jsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(srcPath);

files.forEach(file => {
  if (exceptions.some(ex => file.includes(`\\${ex}\\`) || file.includes(`/${ex}/`))) {
    return; // skip exceptions
  }

  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // Simple string replacement to avoid regex bracket issues
  const injection = `max={new Date().toISOString().split('T')[0]} type="date"`;
  
  content = content.replace(/type="date"/g, injection);

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Safely Updated: ${file}`);
  }
});
