/**
 * StatusCards — Reusable stat card grid for module list pages.
 *
 * Props:
 *   cards  — array of { label, count, icon, accent }
 *   cols   — number of columns (default: auto-fit)
 */
export default function StatusCards({ cards = [], cols }) {
  if (!cards.length) return null
  const colTemplate = cols ? `repeat(${cols}, 1fr)` : `repeat(auto-fit, minmax(140px, 1fr))`

  return (
    <div style={{ display: 'grid', gridTemplateColumns: colTemplate, gap: '12px', marginBottom: '20px' }}>
      {cards.map(c => (
        <div key={c.label} style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '14px 16px', borderRadius: '12px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderTop: `3px solid ${c.accent}`,
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{
            width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${c.accent}12`,
          }}>
            <i className={c.icon} style={{ fontSize: '18px', color: c.accent }} />
          </div>
          <div>
            <div style={{ fontSize: '22px', fontWeight: '900', lineHeight: 1, color: c.accent }}>{c.count}</div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{c.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
