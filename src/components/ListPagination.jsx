export default function ListPagination({
  currentPage,
  totalPages,
  pageSize,
  totalRecords,
  onPageChange,
}) {
  if (totalRecords <= 0) return null

  const safePage = Math.min(currentPage, totalPages)
  const start = (safePage - 1) * pageSize + 1
  const end = Math.min(safePage * pageSize, totalRecords)

  const pageItems = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
    .reduce((acc, p, idx, arr) => {
      if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...')
      acc.push(p)
      return acc
    }, [])

  const btnStyle = (disabled) => ({
    padding: '6px 10px',
    borderRadius: '7px',
    border: '1px solid var(--border-light)',
    background: 'var(--bg-surface)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    fontSize: '14px',
    lineHeight: 1,
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', flexWrap: 'wrap', gap: '10px' }}>
      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
        Showing <strong>{start}</strong>–<strong>{end}</strong> of <strong>{totalRecords}</strong> records
      </span>
      <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
        <button onClick={() => onPageChange(1)} disabled={safePage === 1} style={btnStyle(safePage === 1)} title="First page">
          <i className="ri-skip-back-line" />
        </button>
        <button onClick={() => onPageChange(Math.max(1, safePage - 1))} disabled={safePage === 1} style={btnStyle(safePage === 1)}>
          <i className="ri-arrow-left-s-line" />
        </button>

        {pageItems.map((item, idx) =>
          item === '...' ? (
            <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: 'var(--text-muted)', fontSize: '13px' }}>…</span>
          ) : (
            <button
              key={item}
              onClick={() => onPageChange(item)}
              style={{
                padding: '6px 11px',
                borderRadius: '7px',
                fontSize: '13px',
                fontWeight: '700',
                border: `1px solid ${safePage === item ? 'var(--primary)' : 'var(--border-light)'}`,
                background: safePage === item ? 'var(--primary)' : 'var(--bg-surface)',
                color: safePage === item ? '#fff' : 'var(--text)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {item}
            </button>
          )
        )}

        <button onClick={() => onPageChange(Math.min(totalPages, safePage + 1))} disabled={safePage === totalPages} style={btnStyle(safePage === totalPages)}>
          <i className="ri-arrow-right-s-line" />
        </button>
        <button onClick={() => onPageChange(totalPages)} disabled={safePage === totalPages} style={btnStyle(safePage === totalPages)} title="Last page">
          <i className="ri-skip-forward-line" />
        </button>
      </div>
    </div>
  )
}
