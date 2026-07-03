import { useState } from 'react'
import StatusSelect from './StatusSelect'

const inputStyle = {
  padding: '8px 10px 8px 32px',
  borderRadius: '8px',
  border: '1px solid var(--border-light)',
  background: 'var(--bg-surface)',
  fontSize: '13px',
  color: 'var(--text)',
  boxSizing: 'border-box',
}

const selectStyle = {
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid var(--border-light)',
  background: 'var(--bg-surface)',
  fontSize: '13px',
  cursor: 'pointer',
}

export default function ModuleToolbar({
  onSearch,
  onFilterChange,
  filterOptions = [],
  filterLabel = 'All Categories',
  filterColorMap = {},
  onDateRangeChange,
  searchPlaceholder = 'Search records…',
  pageSize = 10,
  onPageSizeChange,
  onExportClick,
  onClearFilters,
  hasActiveFilters = false,
  children,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')

  const handleSearchChange = (e) => {
    const val = e.target.value
    setSearchTerm(val)
    onSearch?.(val)
  }

  const handleFilterChange = (e) => {
    const val = e.target.value
    setFilter(val)
    onFilterChange?.(val)
  }

  const handleDateStartChange = (val) => {
    setDateStart(val)
    onDateRangeChange?.({ start: val, end: dateEnd })
  }

  const handleDateEndChange = (val) => {
    setDateEnd(val)
    onDateRangeChange?.({ start: dateStart, end: val })
  }

  const handleClear = () => {
    setSearchTerm('')
    setFilter('')
    setDateStart('')
    setDateEnd('')
    onClearFilters?.()
  }

  const showClear = hasActiveFilters || searchTerm || filter || dateStart || dateEnd

  return (
    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
      <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '160px' }}>
        <i
          className="ri-search-line"
          style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '15px', pointerEvents: 'none' }}
        />
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={handleSearchChange}
          style={{ ...inputStyle, width: '100%' }}
        />
      </div>

      {filterOptions.length > 0 && (
        Object.keys(filterColorMap).length > 0 ? (
          // Rich StatusSelect pill dropdown when colorMap provided
          <StatusSelect
            value={filter || ''}
            options={[
              { value: '', label: filterLabel, icon: 'ri-filter-line', bg: 'var(--bg-app)', color: 'var(--text-muted)' },
              ...filterOptions.map(opt => ({
                value: opt.value,
                label: opt.label,
                icon: filterColorMap[opt.value]?.icon || 'ri-circle-fill',
                bg:    filterColorMap[opt.value]?.bg    || '#f3f4f6',
                color: filterColorMap[opt.value]?.color || '#374151',
              }))
            ]}
            onChange={v => { setFilter(v); onFilterChange?.(v) }}
          />
        ) : (
          // Plain select when no colorMap
          <select
            value={filter}
            onChange={handleFilterChange}
            style={{
              ...selectStyle,
              minWidth: '130px',
              color: filter ? 'var(--text)' : 'var(--text-muted)',
            }}
          >
            <option value="">{filterLabel}</option>
            {filterOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )
      )}

      {children}

      {onDateRangeChange && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            max={new Date().toISOString().split('T')[0]} type="date"
            value={dateStart}
            onChange={e => handleDateStartChange(e.target.value)}
            style={{ padding: '7px 8px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontSize: '13px', color: 'var(--text)' }}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>–</span>
          <input
            max={new Date().toISOString().split('T')[0]} type="date"
            value={dateEnd}
            min={dateStart || undefined}
            onChange={e => handleDateEndChange(e.target.value)}
            style={{ padding: '7px 8px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontSize: '13px', color: 'var(--text)' }}
          />
        </div>
      )}

      {showClear && (
        <button
          onClick={handleClear}
          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <i className="ri-close-line" /> Clear
        </button>
      )}

      {(onPageSizeChange || onExportClick) && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
          {onPageSizeChange && (
            <>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Show</span>
              <select
                value={pageSize}
                onChange={e => onPageSizeChange(Number(e.target.value))}
                style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontSize: '13px', color: 'var(--text)', cursor: 'pointer' }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>per page</span>
            </>
          )}

          {onPageSizeChange && onExportClick && (
            <div style={{ width: '1px', height: '20px', background: 'var(--border-light)' }} />
          )}

          {onExportClick && (
            <button
              onClick={onExportClick}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '8px',
                background: '#16a34a', color: '#fff',
                border: 'none', fontSize: '13px', fontWeight: '700',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              <i className="ri-file-excel-2-line" style={{ fontSize: '15px' }} /> Export XLSX
            </button>
          )}
        </div>
      )}
    </div>
  )
}
