import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { filterRecordsByDateRange, recordsToExportRows, downloadXlsx } from '../utils/exportXlsx'
import { printPDF } from '../utils/printPDF'

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
  // PDF support: pass either a pdfConfig object or an onPrintPdf callback
  pdfConfig,      // { title, columns, subtitle?: (count) => string }
  onPrintPdf,     // () => void — called with no args (module's own handlePrintPDF)
  onSuccess,
  onError,
}) {
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')
  const [exportFormat, setExportFormat] = useState('excel') // 'excel' | 'pdf'

  const exportPreviewRows = useMemo(
    () => filterRecordsByDateRange(records, { from: exportFrom, to: exportTo, dateField }),
    [records, exportFrom, exportTo, dateField]
  )

  if (!isOpen) return null

  const hasPdf = !!(pdfConfig || onPrintPdf)

  const handleExport = () => {
    try {
      if (exportFormat === 'pdf') {
        if (onPrintPdf) {
          // Call module's handlePrintPDF with date-filtered records
          onPrintPdf(exportPreviewRows)
          onSuccess?.(exportPreviewRows.length)
          onClose()
          setExportFrom('')
          setExportTo('')
        } else if (pdfConfig) {
          // Modern: use pdfConfig with date-filtered rows
          printPDF({
            title: pdfConfig.title,
            subtitle: pdfConfig.subtitle
              ? pdfConfig.subtitle(exportPreviewRows.length)
              : `${exportPreviewRows.length} records`,
            columns: pdfConfig.columns,
            records: exportPreviewRows,
          })
          onSuccess?.(exportPreviewRows.length)
          onClose()
          setExportFrom('')
          setExportTo('')
        }
      } else {
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
      }
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
          width: '100%', maxWidth: '480px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid var(--border-light)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: exportFormat === 'pdf' ? '#fef3c7' : '#dcfce7',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s'
            }}>
              <i
                className={exportFormat === 'pdf' ? 'ri-file-pdf-2-line' : 'ri-file-excel-2-line'}
                style={{ fontSize: '20px', color: exportFormat === 'pdf' ? '#d97706' : '#16a34a' }}
              />
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '16px' }}>Export Records</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {exportFormat === 'pdf' ? filename.replace(/\.(xlsx|csv)$/i, '.pdf') : filename}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '20px', lineHeight: 1, padding: '4px' }}
          >
            <i className="ri-close-line" />
          </button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Format selector — only shown when PDF is available */}
          {hasPdf && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                File Format
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setExportFormat('excel')}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
                    border: `2px solid ${exportFormat === 'excel' ? '#16a34a' : 'var(--border-light)'}`,
                    background: exportFormat === 'excel' ? '#f0fdf4' : 'var(--bg-app)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    fontWeight: '700', fontSize: '13px',
                    color: exportFormat === 'excel' ? '#16a34a' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}
                >
                  <i className="ri-file-excel-2-line" style={{ fontSize: '18px' }} />
                  Excel (.xlsx)
                </button>
                <button
                  onClick={() => setExportFormat('pdf')}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
                    border: `2px solid ${exportFormat === 'pdf' ? '#d97706' : 'var(--border-light)'}`,
                    background: exportFormat === 'pdf' ? '#fffbeb' : 'var(--bg-app)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    fontWeight: '700', fontSize: '13px',
                    color: exportFormat === 'pdf' ? '#d97706' : 'var(--text-muted)',
                    transition: 'all 0.15s',
                  }}
                >
                  <i className="ri-file-pdf-2-line" style={{ fontSize: '18px' }} />
                  PDF
                </button>
              </div>
            </div>
          )}

          {/* Date range — shown for both Excel and PDF modes */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
              Date Range (optional)
            </div>
            <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--text-muted)' }}>
              Leave both fields empty to export all records.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>FROM</div>
                <input
                  type="date"
                  value={exportFrom}
                  onChange={e => setExportFrom(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 10px', borderRadius: '8px',
                    border: '1px solid var(--border-light)', background: 'var(--bg-app)',
                    fontSize: '13px', color: 'var(--text)', boxSizing: 'border-box'
                  }}
                />
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '16px', marginTop: '16px' }}>–</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>TO</div>
                <input
                  type="date"
                  value={exportTo}
                  min={exportFrom || undefined}
                  onChange={e => setExportTo(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 10px', borderRadius: '8px',
                    border: '1px solid var(--border-light)', background: 'var(--bg-app)',
                    fontSize: '13px', color: 'var(--text)', boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Preview count — shown for both formats */}
          <div style={{
            padding: '14px 16px', borderRadius: '10px',
            background: exportPreviewRows.length === 0 ? '#fff7ed' : (exportFormat === 'pdf' ? '#fffbeb' : '#f0fdf4'),
            border: `1px solid ${exportPreviewRows.length === 0 ? '#fed7aa' : (exportFormat === 'pdf' ? '#fde68a' : '#bbf7d0')}`,
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <i
              className={exportPreviewRows.length === 0 ? 'ri-alert-line' : 'ri-checkbox-circle-line'}
              style={{ fontSize: '18px', color: exportPreviewRows.length === 0 ? '#ea580c' : (exportFormat === 'pdf' ? '#d97706' : '#16a34a'), flexShrink: 0 }}
            />
            <div>
              <div style={{
                fontWeight: '800', fontSize: '15px',
                color: exportPreviewRows.length === 0 ? '#ea580c' : (exportFormat === 'pdf' ? '#d97706' : '#16a34a')
              }}>
                {exportPreviewRows.length} {exportPreviewRows.length === 1 ? 'record' : 'records'} will be {exportFormat === 'pdf' ? 'included in the report' : 'exported'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{dateRangeLabel}</div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              style={{
                padding: '9px 18px', borderRadius: '8px', border: '1px solid var(--border-light)',
                background: 'var(--bg-app)', color: 'var(--text)', fontSize: '13px',
                fontWeight: '600', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={exportPreviewRows.length === 0}
              style={{
                padding: '9px 20px', borderRadius: '8px', border: 'none',
                background: exportPreviewRows.length === 0
                  ? 'var(--border-light)'
                  : exportFormat === 'pdf' ? '#d97706' : '#16a34a',
                color: exportPreviewRows.length === 0 ? 'var(--text-muted)' : '#fff',
                fontSize: '13px', fontWeight: '700',
                cursor: exportPreviewRows.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
                transition: 'background 0.15s',
              }}
            >
              <i className={exportFormat === 'pdf' ? 'ri-file-pdf-2-line' : 'ri-download-2-line'} style={{ fontSize: '15px' }} />
              {exportFormat === 'pdf' ? 'Export to PDF' : 'Export to Excel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
