import React, { useState } from 'react'

export default function ModuleToolbar({ 
  onSearch, 
  onFilterChange, 
  filterOptions = [],
  onDateRangeChange,
  exportData,
  exportFilename = 'export.xlsx'
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')

  const handleSearchChange = (e) => {
    const val = e.target.value
    setSearchTerm(val)
    if (onSearch) onSearch(val)
  }

  const handleFilterChange = (e) => {
    const val = e.target.value
    setFilter(val)
    if (onFilterChange) onFilterChange(val)
  }

  const handleDateChange = (start, end) => {
    setDateStart(start)
    setDateEnd(end)
    if (onDateRangeChange) onDateRangeChange({ start, end })
  }

  const handleExport = () => {
    if (!exportData || exportData.length === 0) {
      alert('No data to export.')
      return
    }
    if (window.XLSX) {
      // Clean up data for export (remove React-specific or internal fields if necessary)
      const cleanData = exportData.map(item => {
        const { id, created_at, updated_at, ...rest } = item;
        return rest;
      });
      const worksheet = window.XLSX.utils.json_to_sheet(cleanData)
      const workbook = window.XLSX.utils.book_new()
      window.XLSX.utils.book_append_sheet(workbook, worksheet, "Data")
      window.XLSX.writeFile(workbook, exportFilename)
    } else {
      alert('Export library is not loaded yet. Please check your internet connection and try again.')
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '16px',
      marginBottom: '24px',
      padding: '16px',
      background: '#fff',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-sm)',
      alignItems: 'center',
      justifyContent: 'space-between'
    }}>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', flex: 1 }}>
        {/* Search */}
        <div style={{ position: 'relative', minWidth: '250px', flex: 1, maxWidth: '400px' }}>
          <i className="ri-search-line" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}></i>
          <input 
            type="text" 
            placeholder="Search module..." 
            value={searchTerm}
            onChange={handleSearchChange}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-sm)',
              outline: 'none',
              fontSize: '14px'
            }}
          />
        </div>

        {/* Filter */}
        {filterOptions.length > 0 && (
          <div style={{ minWidth: '150px' }}>
            <select 
              value={filter} 
              onChange={handleFilterChange}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                outline: 'none',
                fontSize: '14px',
                cursor: 'pointer',
                background: '#fff'
              }}
            >
              <option value="">All Categories</option>
              {filterOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Date Range */}
        {onDateRangeChange && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input 
              type="date" 
              value={dateStart}
              onChange={(e) => handleDateChange(e.target.value, dateEnd)}
              style={{
                padding: '8px',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                outline: 'none',
                fontSize: '14px'
              }}
              title="Start Date"
            />
            <span style={{ color: 'var(--text-muted)' }}>to</span>
            <input 
              type="date" 
              value={dateEnd}
              onChange={(e) => handleDateChange(dateStart, e.target.value)}
              style={{
                padding: '8px',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-sm)',
                outline: 'none',
                fontSize: '14px'
              }}
              title="End Date"
            />
          </div>
        )}
      </div>

      {/* Export Button */}
      {exportData && (
        <button 
          onClick={handleExport}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <i className="ri-file-excel-2-line"></i>
          Export to Excel
        </button>
      )}
    </div>
  )
}
