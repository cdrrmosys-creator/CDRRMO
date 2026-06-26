import { useState, useEffect } from 'react'
import { NUEVA_ECIJA_DATA } from '../data/nuevaEcijaData'

/**
 * Nueva Ecija address selector — City/Municipality → Barangay → Street
 * Uses static hardcoded data for instant loading.
 */
export default function PHAddressSelect({ value = {}, onChange, disabled = false, required = false }) {
  const cities = NUEVA_ECIJA_DATA.map(d => d.city).sort()

  const barangays = value.city
    ? (NUEVA_ECIJA_DATA.find(d => d.city === value.city)?.barangays || []).sort()
    : []

  const selectStyle = {
    width: '100%', padding: '8px 10px', borderRadius: '8px',
    border: '1px solid var(--border-light)',
    background: disabled ? '#f3f4f6' : 'var(--bg-surface)',
    fontSize: '13px', color: 'var(--text)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    boxSizing: 'border-box'
  }

  const inputStyle = { ...selectStyle, cursor: disabled ? 'not-allowed' : 'text' }

  const handleCity = (city) => {
    onChange({
      ...value,
      city,
      province: 'Nueva Ecija',
      province_code: '',
      barangay: '',
      barangay_code: ''
    })
  }

  const handleBarangay = (barangay) => {
    onChange({ ...value, barangay })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div className="form-row" style={{ gap: '12px' }}>

        {/* City / Municipality */}
        <div className="form-group">
          <label>
            City / Municipality {required && <span style={{ color: 'var(--primary)' }}>*</span>}
          </label>
          <select
            value={value.city || ''}
            onChange={e => handleCity(e.target.value)}
            disabled={disabled}
            style={selectStyle}
          >
            <option value="">-- Select City / Municipality --</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Barangay */}
        <div className="form-group">
          <label>
            Barangay {required && <span style={{ color: 'var(--primary)' }}>*</span>}
          </label>
          <select
            value={value.barangay || ''}
            onChange={e => handleBarangay(e.target.value)}
            disabled={disabled || !value.city}
            style={selectStyle}
          >
            <option value="">{!value.city ? '— Select city first —' : '-- Select Barangay --'}</option>
            {barangays.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      {/* Street */}
      <div className="form-group">
        <label>Street / House No. / Block</label>
        <input
          type="text"
          value={value.street || ''}
          onChange={e => onChange({ ...value, street: e.target.value })}
          disabled={disabled}
          placeholder="e.g. 123 Rizal St., Blk 4 Lot 2"
          style={inputStyle}
        />
      </div>
    </div>
  )
}
