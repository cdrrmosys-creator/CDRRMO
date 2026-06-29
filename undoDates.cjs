const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'src');

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
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  // The string we injected: max={new Date().toISOString().split('T')[0]}
  // We added it with a leading space: " max={new Date().toISOString().split('T')[0]}"
  // Or maybe inside the tag. Let's just remove the exact string.
  
  const toRemove = ` max={new Date().toISOString().split('T')[0]}`;
  const toRemoveAlt = `max={new Date().toISOString().split('T')[0]}`;
  
  content = content.split(toRemove).join('');
  content = content.split(toRemoveAlt).join('');

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Reverted: ${file}`);
  }
});
