const fs = require('fs');
const path = require('path');
const pagesDir = path.join(__dirname, 'src', 'pages');

function removeRecordId(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Regex to match the form-group containing Record ID
  const regex = /<div className=["']form-group["'][^>]*>\s*<label[^>]*>Record ID\s*\*?\s*<\/label>[\s\S]*?<\/div>/ig;
  
  // Some files might just have the label and input without a dedicated wrapper or slightly different
  const altRegex = /<label[^>]*>Record ID\s*\*?\s*<\/label>[\s\S]*?<input[^>]*name=["']record_id["'][^>]*>/ig;

  let modified = false;

  if (regex.test(content)) {
    content = content.replace(regex, '');
    modified = true;
  } else if (altRegex.test(content)) {
    console.log('Needs manual fix (alt format): ' + filePath);
  }

  // Also remove it from table headers/bodies if requested? 
  // Wait, user said "in adding record in every module, dont display the IDS anymore. its automatic anyways" 
  // and "update the columns on the list, display the important columns".

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log('Removed Record ID from form in: ' + filePath);
  }
}

function traverse(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverse(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      removeRecordId(fullPath);
    }
  }
}

traverse(pagesDir);
