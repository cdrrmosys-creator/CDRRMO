const fs = require('fs');
const path = require('path');

// Define which modules get which validations
// key = module folder name, value = { fields for validateForm }
const moduleConfigs = {
  'Drivers': {
    handleSubmit: "const handleSubmit = async (e) => {\n    e.preventDefault()\n    setIsSaving(true)",
    validationFields: `{
      'Driver Name': { rule: 'name', value: formData.name, required: true },
      'Contact No.': { rule: 'mobile', value: formData.contact },
    }`,
  },
  'DrowningIncidents': {
    handleSubmit: "const handleSubmit = async (e) => {\n    e.preventDefault()\n    setIsSaving(true)",
    validationFields: `{
      'Name of Person': { rule: 'name', value: formData.name_of_person },
    }`,
  },
  'Incidents': {
    handleSubmit: "const handleSubmit = async (e) => {\n    e.preventDefault()\n    setIsSaving(true)",
    validationFields: `{
      'Contact No.': { rule: 'mobile', value: formData.contact_no },
    }`,
  },
  'ClientSatisfaction': {
    handleSubmit: "const handleSubmit = async (e) => {\n    e.preventDefault()\n    setIsSaving(true)",
    validationFields: `{
      'Client Name': { rule: 'name', value: formData.client_name, required: true },
      'Contact Number': { rule: 'mobile', value: formData.contact_number },
    }`,
  },
  'TrainingConducted': {
    handleSubmit: "const handleSubmit = async (e) => {\n    e.preventDefault()\n    setIsSaving(true)",
    validationFields: null, // no specific person fields but handle in others
  },
};

const pagesDir = path.join(__dirname, 'src', 'pages');

for (const [moduleName, config] of Object.entries(moduleConfigs)) {
  if (!config.validationFields) continue;
  const filePath = path.join(pagesDir, moduleName, 'index.jsx');
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${moduleName}: file not found`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Add import if not present
  if (!content.includes("from '../../utils/validation'")) {
    content = content.replace(
      /^import \{ useState/m,
      `import { validateForm } from '../../utils/validation'\nimport { useState`
    );
  }

  // 2. Inject validation block after e.preventDefault()
  const submitStart = config.handleSubmit;
  if (content.includes(submitStart) && !content.includes('validateForm(')) {
    const replacement = `const handleSubmit = async (e) => {
    e.preventDefault()

    // Pre-submit validation
    const errors = validateForm(${config.validationFields})
    if (Object.keys(errors).length > 0) {
      Object.values(errors).forEach(msg => toast.error(msg))
      return
    }

    setIsSaving(true)`;
    content = content.replace(submitStart, replacement);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Updated: ${moduleName}`);
}
