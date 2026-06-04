import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { format } from 'date-fns'

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadVehicles()
  }, [])

  const loadVehicles = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setVehicles(data || [])
    } catch (err) {
      console.error('Error loading vehicles:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return

    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setVehicles(vehicles.filter(v => v.id !== id))
    } catch (err) {
      console.error('Error deleting vehicle:', err)
      alert('Failed to delete vehicle: ' + err.message)
    }
  }

  const getStatusBadge = (status) => {
    const colors = {
      'Available': { bg: '#d1fae5', color: '#065f46' },
      'In Use': { bg: '#fef3c7', color: '#92400e' },
      'Maintenance': { bg: '#fee2e2', color: '#991b1b' },
      'Unavailable': { bg: '#f3f4f6', color: '#374151' }
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

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading vehicles...</p>
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
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading Vehicles</h3>
          <p>{error}</p>
          <button 
            onClick={loadVehicles}
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
          <i className="ri-truck-line" style={{ marginRight: '12px' }}></i>
          Vehicles
        </h2>
        <button className="btn-add" onClick={() => alert('Add Vehicle modal - Coming soon!')}>
          <i className="ri-add-line"></i>
          Add Vehicle
        </button>
      </div>

      {vehicles.length === 0 ? (
        <div className="empty-state">
          <i className="ri-truck-line"></i>
          <h3>No Vehicles Found</h3>
          <p>Click "Add Vehicle" to register your first vehicle.</p>
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Plate Number</th>
                <th>Model</th>
                <th>Type</th>
                <th>Capacity</th>
                <th>Status</th>
                <th>Last Maintenance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td style={{ fontWeight: '700', fontFamily: 'monospace' }}>
                    {vehicle.plate || '-'}
                  </td>
                  <td>
                    <div style={{ fontWeight: '600' }}>{vehicle.model || '-'}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {vehicle.manufacturer} {vehicle.year ? `(${vehicle.year})` : ''}
                    </div>
                  </td>
                  <td>{vehicle.type || '-'}</td>
                  <td>{vehicle.capacity || '-'}</td>
                  <td>{getStatusBadge(vehicle.status)}</td>
                  <td>
                    {vehicle.last_maintenance 
                      ? format(new Date(vehicle.last_maintenance), 'MMM dd, yyyy')
                      : 'Not recorded'}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button 
                        className="btn-icon btn-edit"
                        onClick={() => alert('Edit vehicle - Coming soon!')}
                        title="Edit"
                      >
                        <i className="ri-pencil-line"></i>
                      </button>
                      <button 
                        className="btn-icon btn-delete"
                        onClick={() => handleDelete(vehicle.id)}
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
        Total Vehicles: <strong>{vehicles.length}</strong>
      </div>
    </div>
  )
}
