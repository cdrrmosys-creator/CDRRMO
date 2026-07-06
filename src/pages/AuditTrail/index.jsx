import ModuleToolbar from '../../components/ModuleToolbar'
import ListPagination from '../../components/ListPagination'
import ExportModal from '../../components/ExportModal'
import TableGhostRows from '../../components/TableGhostRows'
import useListPagination from '../../hooks/useListPagination'
import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { format } from 'date-fns'
import { printPDF } from '../../utils/printPDF'
import { useToast } from '../../components/Toast'

export default function AuditTrail() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const toast = useToast()

  // Toolbar states
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [isExportOpen, setIsExportOpen] = useState(false)

  useEffect(() => {
    loadRecords()
  }, [])

  const filteredRecords = records.filter(item => {
    let matchesSearch = true
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase()
      matchesSearch = Object.values(item).some(val => 
        val && typeof val === 'string' && val.toLowerCase().includes(lowerSearch)
      )
    }
    
    let matchesFilter = true
    if (filter) {
      matchesFilter = item.module === filter || item.action === filter
    }
    
    let matchesDate = true
    if (dateRange.start && dateRange.end) {
      const dateStr = item.created_at
      if (dateStr) {
        const created = new Date(dateStr)
        const start = new Date(dateRange.start)
        const end = new Date(dateRange.end)
        end.setHours(23, 59, 59, 999)
        matchesDate = created >= start && created <= end
      }
    }

    return matchesSearch && matchesFilter && matchesDate
  })

  const { currentPage, setCurrentPage, pageSize, setPageSize: handlePageSizeChange, totalPages, safePage, pagedRecords } = useListPagination(filteredRecords)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filter, dateRange, setCurrentPage])

  const hasActiveFilters = !!(searchTerm || filter || dateRange.start || dateRange.end)

  const handleClearFilters = () => {
    setSearchTerm('')
    setFilter('')
    setDateRange({ start: '', end: '' })
    setCurrentPage(1)
  }

  const handlePrintPDF = () => {
    printPDF({
      title: 'Audit Trail Report',
      subtitle: `${filteredRecords.length} entries`,
      columns: [
        { header: 'Date & Time', key: 'created_at', format: v => v ? format(new Date(v), 'MMM dd, yyyy hh:mm a') : '—' },
        { header: 'User', key: 'user_email' },
        { header: 'Action', key: 'action' },
        { header: 'Module', key: 'module' },
        { header: 'Details', key: 'details' },
      ],
      records: filteredRecords,
    })
  }

  const loadRecords = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Error loading audit logs:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getActionBadge = (action) => {
    const colors = {
      'Added':   { bg: '#d1fae5', color: '#065f46' },
      'Updated': { bg: '#dbeafe', color: '#1e40af' },
      'Deleted': { bg: '#fee2e2', color: '#991b1b' },
      'Login':   { bg: '#fef9c3', color: '#854d0e' },
      'Logout':  { bg: '#f3e8ff', color: '#6b21a8' },
    }
    const style = colors[action] || { bg: '#e5e7eb', color: '#374151' }
    
    return (
      <span style={{
        display: 'inline-block',
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '700',
        background: style.bg,
        color: style.color
      }}>
        {action || 'Action'}
      </span>
    )
  }

  // Get unique modules for filtering
  const moduleOptions = [...new Set(records.map(r => r.module))].filter(Boolean).map(mod => ({
    label: `Module: ${mod}`,
    value: mod
  }))

  const filterOptions = [
    { label: 'Action: Added',   value: 'Added' },
    { label: 'Action: Updated', value: 'Updated' },
    { label: 'Action: Deleted', value: 'Deleted' },
    { label: 'Action: Login',   value: 'Login' },
    { label: 'Action: Logout',  value: 'Logout' },
    ...moduleOptions
  ]

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading audit trail...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{
          background: '#fee2e2',
          border: '1px solid #fecaca',
          borderRadius: 'var(--radius-md)',
          padding: '24px',
          color: '#991b1b',
          maxWidth: '500px',
          margin: '0 auto'
        }}>
          <i className="ri-error-warning-line" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading Audit Trail</h3>
          <p>{error}</p>
          <button 
            onClick={loadRecords}
            style={{
              marginTop: '16px',
              padding: '10px 20px',
              background: 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '700'
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="ri-shield-keyhole-line" style={{ marginRight: '12px' }}></i>
          System Audit Trail
        </h2>
      </div>
      
      

      {records.length > 0 && (
        <ModuleToolbar 
          onSearch={setSearchTerm}
          onFilterChange={setFilter}
          onDateRangeChange={setDateRange}
          pageSize={pageSize}
          onPageSizeChange={handlePageSizeChange}
          onExportClick={() => setIsExportOpen(true)}
          onPrintClick={handlePrintPDF}
          onClearFilters={handleClearFilters}
          filterLabel="All Actions"
          filterOptions={[
            { label: 'Added', value: 'Added' },
            { label: 'Updated', value: 'Updated' },
            { label: 'Deleted', value: 'Deleted' },
            { label: 'Login', value: 'Login' },
            { label: 'Logout', value: 'Logout' },
          ]}
          filterColorMap={{
            'Added': { bg: '#d1fae5', color: '#065f46', icon: 'ri-add-circle-line' },
            'Updated': { bg: '#dbeafe', color: '#1e40af', icon: 'ri-edit-line' },
            'Deleted': { bg: '#fee2e2', color: '#991b1b', icon: 'ri-delete-bin-line' },
            'Login': { bg: '#fef9c3', color: '#854d0e', icon: 'ri-login-box-line' },
            'Logout': { bg: '#f3e8ff', color: '#6b21a8', icon: 'ri-logout-box-line' },
          }}
          hasActiveFilters={hasActiveFilters}
          filterOptions={filterOptions}
        />
      )}

      {records.length === 0 ? (
        <div className="empty-state">
          <i className="ri-shield-keyhole-line"></i>
          <h3>No Audit Logs Found</h3>
          <p>System actions will be recorded here.</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="empty-state">
          <i className="ri-filter-off-line"></i>
          <h3>No Matching Records</h3>
          <p>Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Module</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {pagedRecords.map((record) => (
                <tr key={record.id} style={{ height: '49px' }}>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                    {record.created_at 
                      ? format(new Date(record.created_at), 'MMM dd, yyyy HH:mm:ss')
                      : '-'}
                  </td>
                  <td style={{ fontWeight: '700' }}>{record.user_email || '-'}</td>
                  <td>{getActionBadge(record.action)}</td>
                  <td><code style={{ fontWeight: '600', color: 'var(--primary)' }}>{record.module || '-'}</code></td>
                  <td>
                    <div style={{
                      maxWidth: '300px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '13px',
                      color: 'var(--text-muted)'
                    }}>
                      {record.details || '-'}
                    </div>
                  </td>
                </tr>
              ))}
              <TableGhostRows count={Math.max(0, pageSize - pagedRecords.length)} colSpan={6} />
            </tbody>
          </table>
        </div>
      )}

      <ListPagination
        currentPage={safePage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalRecords={filteredRecords.length}
        onPageChange={setCurrentPage}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        records={records}
        filename="audit_trail_report.xlsx"
        sheetName="Audit Trail"
        dateField="created_at"
        columns={['created_at', 'user_email', 'action', 'module', 'record_id', 'details']}
        headers={{
          created_at: 'Date & Time',
          user_email: 'User',
          action: 'Action',
          module: 'Module',
          record_id: 'Record ID',
          details: 'Details',
        }}
        onSuccess={(count) => toast.success(`Exported ${count} records.`)}
        onError={(msg) => toast.error(msg)}
      />
    </div>
  )
}
