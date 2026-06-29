import React, { useState, useEffect } from 'react';
import { validateField } from '../utils/validation';

export default function ValidatedInput({ 
  rule, 
  value, 
  onChange, 
  onValidationChange, // callback to notify parent of validity (true/false)
  required,
  type = 'text',
  placeholder,
  name,
  style,
  className,
  prefix,
  ...props 
}) {
  const [error, setError] = useState(null);
  const [touched, setTouched] = useState(false);

  const inputRef = React.useRef(null);

  // Validate whenever value or rule changes
  useEffect(() => {
    let err = null;
    if (required && !value) {
      err = 'This field is required.';
    } else if (value && rule) {
      err = validateField(rule, value);
    }
    
    setError(err);
    if (inputRef.current) {
      inputRef.current.setCustomValidity(err || '');
    }
    
    if (onValidationChange) {
      onValidationChange(name, !err);
    }
  }, [value, rule, required, name]);

  const handleBlur = () => {
    setTouched(true);
  };

  const showError = touched && error;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div style={{ display: 'flex', position: 'relative' }}>
        {prefix && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            background: 'var(--bg-body)',
            border: `1px solid ${showError ? '#ef4444' : 'var(--border-light)'}`,
            borderRight: 'none',
            borderRadius: '8px 0 0 8px',
            color: 'var(--text-muted)',
            fontWeight: '600'
          }}>
            {prefix}
          </div>
        )}
        <input
          ref={inputRef}
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          required={required}
          className={className}
          style={{
            ...style,
            border: showError ? '1px solid #ef4444' : (style?.border || undefined),
            borderTopLeftRadius: prefix ? 0 : undefined,
            borderBottomLeftRadius: prefix ? 0 : undefined,
            width: '100%'
          }}
          {...props}
        />
      </div>
      {showError && (
        <span style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', fontWeight: '500' }}>
          {error}
        </span>
      )}
    </div>
  );
}
