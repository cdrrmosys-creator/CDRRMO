import ModuleToolbar from '../../components/ModuleToolbar'
import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { format } from 'date-fns'

export default function AuditTrail() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Toolbar states
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

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
          exportData={filteredRecords}
          exportFilename="audit_trail_report.xlsx"
          filterOptions={filterOptions}
        />
      )}

      {records.length === 0 ? (
        <div className="empty-state">
          <i className="ri-shield-keyhole-line"></i>
          <h3>No Audit Logs Found</h3>
          <p>System actions will be recorded here.</p>
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
                <th>Record ID</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                    {record.created_at 
                      ? format(new Date(record.created_at), 'MMM dd, yyyy HH:mm:ss')
                      : '-'}
                  </td>
                  <td style={{ fontWeight: '700' }}>{record.user_email || '-'}</td>
                  <td>{getActionBadge(record.action)}</td>
                  <td><code style={{ fontWeight: '600', color: 'var(--primary)' }}>{record.module || '-'}</code></td>
                  <td><code style={{ fontWeight: '700' }}>{record.record_id || '-'}</code></td>
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
            </tbody>
          </table>
        </div>
      )}

      <div style={{
        marginTop: '16px',
        fontSize: '14px',
        color: 'var(--text-muted)',
        textAlign: 'center'
      }}>
        Showing <strong>{filteredRecords.length}</strong> of <strong>{records.length}</strong>
      </div>
    </div>
  )
}
