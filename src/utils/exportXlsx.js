const INTERNAL_FIELDS = new Set(['id', 'created_at', 'updated_at'])

export function filterRecordsByDateRange(records, { from, to, dateField = 'date' }) {
  if (!from && !to) return records

  return records.filter(item => {
    const dateStr = item[dateField] || item.created_at || item.date
    if (!dateStr) return false
    const d = new Date(dateStr)
    if (from && d < new Date(from)) return false
    if (to) {
      const end = new Date(to)
      end.setHours(23, 59, 59, 999)
      if (d > end) return false
    }
    return true
  })
}

export function recordsToExportRows(records, { columns, headers, transformValue } = {}) {
  if (columns && headers) {
    return records.map(record => {
      const row = {}
      columns.forEach(col => {
        let val = record[col]
        if (transformValue) val = transformValue(col, val, record)
        if (val === null || val === undefined) val = ''
        row[headers[col] || col] = val
      })
      return row
    })
  }

  return records.map(record => {
    const row = {}
    Object.entries(record).forEach(([key, val]) => {
      if (INTERNAL_FIELDS.has(key)) return
      if (val === null || val === undefined) val = ''
      row[key] = val
    })
    return row
  })
}

export function downloadXlsx(rows, { filename = 'export.xlsx', sheetName = 'Data', headers } = {}) {
  if (!window.XLSX) {
    throw new Error('Export library not loaded. Check your internet connection.')
  }
  if (!rows.length) {
    throw new Error('No records to export.')
  }

  const ws = window.XLSX.utils.json_to_sheet(rows)
  if (headers) {
    ws['!cols'] = Object.values(headers).map(label => ({
      wch: Math.max(String(label).length + 2, 14),
    }))
  }

  const wb = window.XLSX.utils.book_new()
  window.XLSX.utils.book_append_sheet(wb, ws, sheetName)
  window.XLSX.writeFile(wb, filename)
}
