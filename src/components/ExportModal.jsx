import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { filterRecordsByDateRange, recordsToExportRows, downloadXlsx } from '../utils/exportXlsx'

export default function ExportModal({
  isOpen,
  onClose,
  records = [],
  filename = 'export.xlsx',
  sheetName = 'Data',
  dateField = 'date',
  columns,
  headers,
  transformValue,
  onSuccess,
  onError,
}) {
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')

  const exportPreviewRows = useMemo(
    () => filterRecordsByDateRange(records, { from: exportFrom, to: exportTo, dateField }),
    [records, exportFrom, exportTo, dateField]
  )

  if (!isOpen) return null

  const handleExport = () => {
    try {
      const rows = recordsToExportRows(exportPreviewRows, { columns, headers, transformValue })
      const fromLabel = exportFrom || 'all'
      const toLabel = exportTo || 'all'
      const exportFilename = filename.includes('.xlsx')
        ? filename.replace('.xlsx', `_${fromLabel}_to_${toLabel}.xlsx`)
        : `${filename}_${fromLabel}_to_${toLabel}.xlsx`

      downloadXlsx(rows, { filename: exportFilename, sheetName, headers })
      onSuccess?.(exportPreviewRows.length)
      onClose()
      setExportFrom('')
      setExportTo('')
    } catch (err) {
      onError?.(err.message)
    }
  }

  const dateRangeLabel = exportFrom && exportTo
    ? `${format(new Date(exportFrom), 'MMM dd, yyyy')} – ${format(new Date(exportTo), 'MMM dd, yyyy')}`
    : exportFrom
      ? `From ${format(new Date(exportFrom), 'MMM dd, yyyy')} onwards`
      : exportTo
        ? `Up to ${format(new Date(exportTo), 'MMM dd, yyyy')}`
        : 'All records (no date filter)'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          width: '100%', maxWidth: '460px',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid var(--border-light)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ri-file-excel-2-line" style={{ fontSize: '20px', color: '#16a34a' }} />
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '16px' }}>Export to Excel</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{filename}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '20px', lineHeight: 1, padding: '4px' }}
          >
            <i className="ri-close-line" />
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
            Select a date range to filter which records to export. Leave both fields empty to export all records.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>From</label>
              <input
                type="date"
                value={exportFrom}
                onChange={e => setExportFrom(e.target.value)}
                style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-app)', fontSize: '13px', color: 'var(--text)', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>To</label>
              <input
                type="date"
                value={exportTo}
                min={exportFrom || undefined}
                onChange={e => setExportTo(e.target.value)}
                style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-app)', fontSize: '13px', color: 'var(--text)', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '14px 16px', borderRadius: '10px',
            background: exportPreviewRows.length > 0 ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${exportPreviewRows.length > 0 ? '#bbf7d0' : '#fecaca'}`,
            marginBottom: '24px',
          }}>
            <i
              className={exportPreviewRows.length > 0 ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}
              style={{ fontSize: '22px', color: exportPreviewRows.length > 0 ? '#16a34a' : '#dc2626', flexShrink: 0 }}
            />
            <div>
              <div style={{ fontWeight: '800', fontSize: '15px', color: exportPreviewRows.length > 0 ? '#15803d' : '#b91c1c' }}>
                {exportPreviewRows.length} {exportPreviewRows.length === 1 ? 'record' : 'records'} will be exported
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {dateRangeLabel}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontSize: '13px', fontWeight: '600', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={exportPreviewRows.length === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '9px 22px', borderRadius: '8px',
                background: exportPreviewRows.length > 0 ? '#16a34a' : '#9ca3af',
                color: '#fff', border: 'none', fontSize: '13px', fontWeight: '700',
                cursor: exportPreviewRows.length > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              <i className="ri-download-2-line" /> Export
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
