import { useState, useEffect, useRef } from 'react'

/**
 * StatusSelect – a pretty pill-style dropdown to replace native <select> for status fields.
 *
 * Props:
 *   value      – current status string
 *   options    – array of { value, label, icon, bg, color }
 *   onChange   – called with new value string
 *   disabled   – optional, renders as a static badge
 *   minWidth   – optional, minimum width for dropdown (default: '180px')
 */
export default function StatusSelect({ value, options, onChange, disabled = false, minWidth = '180px' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const current = options.find(o => o.value === value) || options[0]

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (disabled) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
        background: current.bg, color: current.color,
        border: `1px solid ${current.color}25`,
        whiteSpace: 'nowrap'
      }}>
        <i className={current.icon} style={{ fontSize: '13px' }} />
        {current.label}
      </span>
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}
      onClick={e => e.stopPropagation()}
    >
      {/* Trigger pill */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
          background: current.bg, color: current.color,
          border: `1px solid ${current.color}30`,
          cursor: 'pointer', outline: 'none',
          transition: 'box-shadow 0.15s, opacity 0.15s',
          whiteSpace: 'nowrap'
        }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = `0 0 0 3px ${current.color}20`}
        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
      >
        <i className={current.icon} style={{ fontSize: '13px' }} />
        {current.label}
        <i className={`ri-arrow-${open ? 'up' : 'down'}-s-line`} style={{ fontSize: '14px', marginLeft: '2px', opacity: 0.7 }} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 9999,
          background: 'var(--bg-surface, #fff)',
          border: '1px solid var(--border-light, #e5e7eb)',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          padding: '6px',
          minWidth: minWidth,
        }}>
          {options.map(opt => {
            const isActive = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  width: '100%', padding: '8px 10px',
                  borderRadius: '8px', border: 'none',
                  background: isActive ? opt.bg : 'transparent',
                  color: isActive ? opt.color : 'var(--text-main, #111)',
                  fontSize: '13px', fontWeight: isActive ? '700' : '500',
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = opt.bg + '70' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{
                  width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: opt.bg, color: opt.color, fontSize: '14px'
                }}>
                  <i className={opt.icon} />
                </span>
                <span>{opt.label}</span>
                {isActive && (
                  <i className="ri-check-line" style={{ marginLeft: 'auto', color: opt.color, fontSize: '15px' }} />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
