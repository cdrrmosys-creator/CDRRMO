// Central validation rules
export const validateField = (rule, value) => {
  if (value === undefined || value === null) value = '';
  value = String(value).trim();

  // If empty, let the 'required' prop handle it
  if (!value) return null;

  switch (rule) {
    case 'mobile': {
      // Accept PH formats: 09XXXXXXXXX (11 digits) or just 10 digits after +63
      const digits = value.replace(/\D/g, '');
      if (value.startsWith('+63')) {
        if (!/^\+63\d{10}$/.test(value)) return 'Enter +63 followed by exactly 10 digits.';
      } else if (value.startsWith('09')) {
        if (!/^09\d{9}$/.test(value)) return 'Enter a valid PH mobile number (e.g. 09XXXXXXXXX).';
      } else if (/^\d+$/.test(value)) {
        if (digits.length !== 10 && digits.length !== 11)
          return 'Enter a valid 10 or 11-digit mobile number.';
      } else {
        return 'Mobile number must contain digits only.';
      }
      break;
    }

    case 'age': {
      const age = parseInt(value, 10);
      if (!/^\d+$/.test(value) || isNaN(age) || age < 0 || age > 120) {
        return 'Age must be a number between 0 and 120.';
      }
      break;
    }

    case 'name':
      // Allow letters, spaces, hyphens, dots, apostrophes (for Filipino names like "O'Brien", "Sto. Niño")
      if (!/^[a-zA-ZÀ-ÿ\s\-'.]+$/.test(value)) {
        return 'Only letters, spaces, hyphens, and apostrophes are allowed.';
      }
      break;

    case 'username':
      if (!/^[a-zA-Z0-9_]{5,20}$/.test(value)) {
        return 'Must be 5–20 characters (letters, numbers, underscores only).';
      }
      break;

    case 'email': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (!emailRegex.test(value)) {
        return 'Must be a valid email address (e.g. user@domain.com).';
      }
      break;
    }

    case 'password':
      if (value.length < 8) return 'Password must be at least 8 characters.';
      if (/\s/.test(value)) return 'Password cannot contain spaces.';
      if (!/[A-Z]/.test(value)) return 'Must include at least one uppercase letter.';
      if (!/[a-z]/.test(value)) return 'Must include at least one lowercase letter.';
      if (!/[0-9]/.test(value)) return 'Must include at least one number.';
      if (!/[^A-Za-z0-9]/.test(value)) return 'Must include at least one special symbol (!@#$...).';
      break;

    default:
      return null;
  }
  return null; // All checks passed
};

// Validate a set of fields and return an errors object
// fieldsMap: { fieldLabel: { rule, value, required } }
// Returns: { fieldLabel: errorMessage } – empty object means no errors
export const validateForm = (fieldsMap) => {
  const errors = {};
  for (const [label, { rule, value, required }] of Object.entries(fieldsMap)) {
    const v = String(value ?? '').trim();
    if (required && !v) {
      errors[label] = `${label} is required.`;
    } else if (v && rule) {
      const err = validateField(rule, v);
      if (err) errors[label] = err;
    }
  }
  return errors;
};
