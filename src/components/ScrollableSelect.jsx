import { useState, useEffect, useRef } from 'react'

/**
 * ScrollableSelect
 * A custom dropdown that shows visibleCount rows then scrolls.
 *
 * Props:
 *   value        – current selected value
 *   options      – array of { value, label }
 *   onChange     – called with new value string
 *   placeholder  – text when nothing is selected
 *   visibleCount – how many items to show before scrolling (default 10)
 *   required     – boolean
 *   disabled     – boolean
 *   style        – extra style for the trigger button
 */
export default function ScrollableSelect({
  value,
  options = [],
  onChange,
  placeholder = '-- Select --',
  visibleCount = 10,
  required = false,
  disabled = false,
  style = {},
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const selected = options.find(o => o.value === value)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Inject CSS for scrollbar styling
  useEffect(() => {
    const styleId = 'scrollable-select-styles'
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style')
      styleEl.id = styleId
      styleEl.textContent = `
        .scrollable-dropdown::-webkit-scrollbar {
          width: 12px;
        }
        .scrollable-dropdown::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 0 8px 8px 0;
        }
        .scrollable-dropdown::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 6px;
          border: 2px solid #f1f5f9;
        }
        .scrollable-dropdown::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `
      document.head.appendChild(styleEl)
    }
  }, [])

  // Approximate row height in px
  const ROW_H = 36
  const maxHeight = ROW_H * visibleCount

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', ...style }}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          padding: '8px 32px 8px 10px',
          borderRadius: '8px',
          border: '1px solid var(--border-light)',
          background: disabled ? 'var(--bg-app)' : 'var(--bg-surface)',
          fontSize: '13px',
          color: selected ? 'var(--text)' : 'var(--text-muted)',
          textAlign: 'left',
          cursor: disabled ? 'default' : 'pointer',
          position: 'relative',
          outline: 'none',
          fontFamily: 'inherit',
        }}
      >
        {selected ? selected.label : placeholder}
        <i
          className={`ri-arrow-${open ? 'up' : 'down'}-s-line`}
          style={{
            position: 'absolute', right: '10px', top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '16px', color: 'var(--text-muted)', pointerEvents: 'none',
          }}
        />
      </button>

      {/* Hidden native input for required validation */}
      {required && (
        <input
          tabIndex={-1}
          required
          value={value || ''}
          onChange={() => {}}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
        />
      )}

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 9999,
            width: '100%',
            maxHeight: `${maxHeight}px`,
            overflowY: 'scroll',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: '4px',
            scrollbarWidth: 'thin', // For Firefox
            scrollbarColor: '#cbd5e1 #f1f5f9', // For Firefox
          }}
          // Force scrollbar to always show on Webkit browsers
          className="scrollable-dropdown"
        >
          {options.map(opt => {
            const isActive = opt.value === value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 10px',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  fontWeight: isActive ? '700' : '400',
                  color: isActive ? 'var(--primary)' : 'var(--text)',
                  background: isActive ? 'var(--primary-bg, #f0fdf4)' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                  height: `${ROW_H}px`,
                  lineHeight: `${ROW_H - 16}px`,
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-app)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                {opt.label}
                {isActive && <i className="ri-check-line" style={{ float: 'right', color: 'var(--primary)' }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
