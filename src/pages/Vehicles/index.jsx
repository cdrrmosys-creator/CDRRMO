import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { format } from 'date-fns'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'

const INITIAL_FORM_STATE = {
  vehicle_id: '',
  plate: '',
  model: '',
  manufacturer: '',
  year: '',
  type: '',
  capacity: '',
  status: 'Available',
  last_maintenance: '',
  notes: ''
}

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([])
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

  const handleOpenAdd = () => {
    setIsEditing(false)
    setSelectedId(null)
    const year = new Date().getFullYear()
    const rand = Math.floor(1000 + Math.random() * 9000)
    setFormData({
      ...INITIAL_FORM_STATE,
      vehicle_id: `VEH-${year}-${rand}`
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (v) => {
    setIsEditing(true)
    setSelectedId(v.id)
    setFormData({
      vehicle_id: v.vehicle_id || '',
      plate: v.plate || '',
      model: v.model || '',
      manufacturer: v.manufacturer || '',
      year: v.year || '',
      type: v.type || '',
      capacity: v.capacity || '',
      status: v.status || 'Available',
      last_maintenance: v.last_maintenance || '',
      notes: v.notes || ''
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
        last_maintenance: formData.last_maintenance || null
      }

      if (isEditing) {
        const { data, error } = await supabase
          .from('vehicles')
          .update(payload)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setVehicles(vehicles.map(v => v.id === selectedId ? data[0] : v))
        toast.success('Vehicle updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('vehicles')
          .insert([payload])
          .select()

        if (error) throw error
        setVehicles([data[0], ...vehicles])
        toast.success('Vehicle added successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving vehicle:', err)
      toast.error('Error saving vehicle: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This vehicle will be permanently removed. This action cannot be undone.', { title: 'Delete Record' })
    if (!ok) return

    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setVehicles(vehicles.filter(v => v.id !== id))
    } catch (err) {
      console.error('Error deleting vehicle:', err)
      toast.error('Failed to delete vehicle: ' + err.message)
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
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: isAdmin ? '' : 'none' }}>
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
                <th>Vehicle ID</th>
                <th>Plate Number</th>
                <th>Model</th>
                <th>Type</th>
                <th>Capacity</th>
                <th>Status</th>
                <th>Last Maintenance</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id}>
                  <td><code style={{ fontWeight: '700' }}>{vehicle.vehicle_id || '-'}</code></td>
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
                  {isAdmin && (
                  <td>
                    <div className="table-actions">
                      <button 
                        className="btn-icon btn-edit"
                        onClick={() => handleOpenEdit(vehicle)}
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
        Total Vehicles: <strong>{vehicles.length}</strong>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Edit Vehicle Record' : 'Register Vehicle'}
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>Vehicle ID *</label>
              <input 
                type="text" 
                name="vehicle_id" 
                value={formData.vehicle_id} 
                onChange={handleInputChange} 
                required 
               disabled style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280' }} />
            </div>
            <div className="form-group">
              <label>Plate Number *</label>
              <input 
                type="text" 
                name="plate" 
                value={formData.plate} 
                onChange={handleInputChange} 
                required 
                placeholder="e.g. SAA-1234, 1201-123456"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Model *</label>
              <input 
                type="text" 
                name="model" 
                value={formData.model} 
                onChange={handleInputChange} 
                required 
                placeholder="e.g. Hilux, Urvan"
              />
            </div>
            <div className="form-group">
              <label>Manufacturer</label>
              <input 
                type="text" 
                name="manufacturer" 
                value={formData.manufacturer} 
                onChange={handleInputChange} 
                placeholder="e.g. Toyota, Nissan"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Year</label>
              <input 
                type="text" 
                name="year" 
                value={formData.year} 
                onChange={handleInputChange} 
                placeholder="e.g. 2023"
              />
            </div>
            <div className="form-group">
              <label>Type / Classification</label>
              <input 
                type="text" 
                name="type" 
                value={formData.type} 
                onChange={handleInputChange} 
                placeholder="e.g. Ambulance, Rescue Truck"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Capacity</label>
              <input 
                type="text" 
                name="capacity" 
                value={formData.capacity} 
                onChange={handleInputChange} 
                placeholder="e.g. 5 pax, 2 tons"
              />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select name="status" value={formData.status} onChange={handleInputChange}>
                <option value="Available">Available</option>
                <option value="In Use">In Use</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Unavailable">Unavailable</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Last Maintenance Date</label>
            <input 
              type="date" 
              name="last_maintenance" 
              value={formData.last_maintenance} 
              onChange={handleInputChange} 
            />
          </div>

          <div className="form-group">
            <label>Notes / Equipment List</label>
            <textarea 
              name="notes" 
              value={formData.notes} 
              onChange={handleInputChange} 
              rows={2} 
              placeholder="e.g. Equipped with stretcher, trauma kit, VHF radio"
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
