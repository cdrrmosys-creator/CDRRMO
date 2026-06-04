import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { format, isPast } from 'date-fns'

export default function Drivers() {
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadDrivers()
  }, [])

  const loadDrivers = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setDrivers(data || [])
    } catch (err) {
      console.error('Error loading drivers:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this driver?')) return

    try {
      const { error } = await supabase
        .from('drivers')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setDrivers(drivers.filter(d => d.id !== id))
    } catch (err) {
      console.error('Error deleting driver:', err)
      alert('Failed to delete driver: ' + err.message)
    }
  }

  const getStatusBadge = (status) => {
    const colors = {
      'Available': { bg: '#d1fae5', color: '#065f46' },
      'On Duty': { bg: '#fef3c7', color: '#92400e' },
      'Off Duty': { bg: '#f3f4f6', color: '#374151' },
      'Unavailable': { bg: '#fee2e2', color: '#991b1b' }
    }
    const style = colors[status] || colors['Available']
    
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
        {status || 'Available'}
      </span>
    )
  }

  const getLicenseStatus = (expiryDate) => {
    if (!expiryDate) return null
    
    const isExpired = isPast(new Date(expiryDate))
    
    return (
      <span style={{
        fontSize: '11px',
        fontWeight: '700',
        color: isExpired ? '#991b1b' : '#065f46'
      }}>
        {isExpired ? '⚠️ EXPIRED' : '✓ Valid'}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading drivers...</p>
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
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading Drivers</h3>
          <p>{error}</p>
          <button 
            onClick={loadDrivers}
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
          <i className="ri-steering-2-line" style={{ marginRight: '12px' }}></i>
          Drivers
        </h2>
        <button className="btn-add" onClick={() => alert('Add Driver modal - Coming soon!')}>
          <i className="ri-add-line"></i>
          Add Driver
        </button>
      </div>

      {drivers.length === 0 ? (
        <div className="empty-state">
          <i className="ri-steering-2-line"></i>
          <h3>No Drivers Found</h3>
          <p>Click "Add Driver" to register your first driver.</p>
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>License No.</th>
                <th>License Expiry</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.id}>
                  <td style={{ fontWeight: '700' }}>{driver.name || '-'}</td>
                  <td>
                    <div style={{ fontFamily: 'monospace', fontWeight: '600' }}>
                      {driver.license_no || 'Not provided'}
                    </div>
                  </td>
                  <td>
                    {driver.license_expiry ? (
                      <div>
                        <div>{format(new Date(driver.license_expiry), 'MMM dd, yyyy')}</div>
                        {getLicenseStatus(driver.license_expiry)}
                      </div>
                    ) : (
                      'Not provided'
                    )}
                  </td>
                  <td>{driver.contact || '-'}</td>
                  <td>{getStatusBadge(driver.status)}</td>
                  <td>
                    <div className="table-actions">
                      <button 
                        className="btn-icon btn-edit"
                        onClick={() => alert('Edit driver - Coming soon!')}
                        title="Edit"
                      >
                        <i className="ri-pencil-line"></i>
                      </button>
                      <button 
                        className="btn-icon btn-delete"
                        onClick={() => handleDelete(driver.id)}
                        title="Delete"
                      >
                        <i className="ri-delete-bin-line"></i>
                      </button>
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
        Total Drivers: <strong>{drivers.length}</strong>
      </div>
    </div>
  )
}
