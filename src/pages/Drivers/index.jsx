import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { format, isPast } from 'date-fns'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'

const INITIAL_FORM_STATE = {
  driver_id: '',
  name: '',
  license_no: '',
  license_expiry: '',
  contact: '',
  status: 'Available',
  notes: ''
}

export default function Drivers() {
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState(INITIAL_FORM_STATE)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const isAdmin = useIsAdmin()
  const toast = useToast()
  const confirm = useConfirm()

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

  const handleOpenAdd = () => {
    setIsEditing(false)
    setSelectedId(null)
    const year = new Date().getFullYear()
    const rand = Math.floor(1000 + Math.random() * 9000)
    setFormData({
      ...INITIAL_FORM_STATE,
      driver_id: `DRV-${year}-${rand}`
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (d) => {
    setIsEditing(true)
    setSelectedId(d.id)
    setFormData({
      driver_id: d.driver_id || '',
      name: d.name || '',
      license_no: d.license_no || '',
      license_expiry: d.license_expiry || '',
      contact: d.contact || '',
      status: d.status || 'Available',
      notes: d.notes || ''
    })
    setIsModalOpen(true)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const payload = {
        ...formData,
        license_expiry: formData.license_expiry || null
      }

      if (isEditing) {
        const { data, error } = await supabase
          .from('drivers')
          .update(payload)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setDrivers(drivers.map(d => d.id === selectedId ? data[0] : d))
        toast.success('Driver updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('drivers')
          .insert([payload])
          .select()

        if (error) throw error
        setDrivers([data[0], ...drivers])
        toast.success('Driver added successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving driver:', err)
      toast.error('Error saving driver: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This driver will be permanently removed. This action cannot be undone.', { title: 'Delete Record' })
    if (!ok) return

    try {
      const { error } = await supabase
        .from('drivers')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setDrivers(drivers.filter(d => d.id !== id))
      toast.success('Driver record deleted successfully!')
    } catch (err) {
      console.error('Error deleting driver:', err)
      toast.error('Failed to delete driver: ' + err.message)
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
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: isAdmin ? '' : 'none' }}>
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
                <th>Driver ID</th>
                <th>Name</th>
                <th>License No.</th>
                <th>License Expiry</th>
                <th>Contact</th>
                <th>Status</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.id}>
                  <td><code style={{ fontWeight: '700' }}>{driver.driver_id || '-'}</code></td>
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
                  {isAdmin && (
                  <td>
                    <div className="table-actions">
                      <button 
                        className="btn-icon btn-edit"
                        onClick={() => handleOpenEdit(driver)}
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
                  )}
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

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Edit Driver Details' : 'Register Driver'}
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>Driver ID *</label>
              <input 
                type="text" 
                name="driver_id" 
                value={formData.driver_id} 
                onChange={handleInputChange} 
                required 
               disabled style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280' }} />
            </div>
            <div className="form-group">
              <label>Full Name *</label>
              <input 
                type="text" 
                name="name" 
                value={formData.name} 
                onChange={handleInputChange} 
                required 
                placeholder="e.g. Juan dela Cruz"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>License Number</label>
              <input 
                type="text" 
                name="license_no" 
                value={formData.license_no} 
                onChange={handleInputChange} 
                placeholder="e.g. N01-XX-XXXXXX"
              />
            </div>
            <div className="form-group">
              <label>License Expiry</label>
              <input 
                type="date" 
                name="license_expiry" 
                value={formData.license_expiry} 
                onChange={handleInputChange} 
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Contact Number</label>
              <input 
                type="text" 
                name="contact" 
                value={formData.contact} 
                onChange={handleInputChange} 
                placeholder="e.g. 0917-XXX-XXXX"
              />
            </div>
            <div className="form-group">
              <label>Duty Status</label>
              <select name="status" value={formData.status} onChange={handleInputChange}>
                <option value="Available">Available</option>
                <option value="On Duty">On Duty</option>
                <option value="Off Duty">Off Duty</option>
                <option value="Unavailable">Unavailable</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea 
              name="notes" 
              value={formData.notes} 
              onChange={handleInputChange} 
              rows={2} 
              placeholder="e.g. Authorized to drive heavy trucks, fire truck"
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
