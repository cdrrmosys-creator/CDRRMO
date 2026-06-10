import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { format } from 'date-fns'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'

const INITIAL_FORM_STATE = {
  record_id: '',
  vehicle: '',
  driver: '',
  destination: '',
  date_time: '',
  purpose: ''
}

export default function Transport() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Lookups for drivers and vehicles
  const [availableVehicles, setAvailableVehicles] = useState([])
  const [availableDrivers, setAvailableDrivers] = useState([])

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
    loadRecords()
    loadLookups()
  }, [])

  const loadRecords = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('transport')
        .select('*')
        .order('date_time', { ascending: false })
      
      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Error loading transport records:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadLookups = async () => {
    try {
      const { data: vData } = await supabase.from('vehicles').select('plate, model')
      const { data: dData } = await supabase.from('drivers').select('name')
      setAvailableVehicles(vData || [])
      setAvailableDrivers(dData || [])
    } catch (err) {
      console.error('Error loading lookups:', err)
    }
  }

  const handleOpenAdd = () => {
    setIsEditing(false)
    setSelectedId(null)
    const year = new Date().getFullYear()
    const rand = Math.floor(1000 + Math.random() * 9000)
    
    const now = new Date()
    const tzOffset = now.getTimezoneOffset() * 60000
    const localISOTime = (new Date(now - tzOffset)).toISOString().slice(0, 16)

    setFormData({
      ...INITIAL_FORM_STATE,
      record_id: `TRP-${year}-${rand}`,
      date_time: localISOTime
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (rec) => {
    setIsEditing(true)
    setSelectedId(rec.id)
    
    let formattedDateTime = ''
    if (rec.date_time) {
      const d = new Date(rec.date_time)
      const tzOffset = d.getTimezoneOffset() * 60000
      formattedDateTime = (new Date(d - tzOffset)).toISOString().slice(0, 16)
    }

    setFormData({
      record_id: rec.record_id || '',
      vehicle: rec.vehicle || '',
      driver: rec.driver || '',
      destination: rec.destination || '',
      date_time: formattedDateTime,
      purpose: rec.purpose || ''
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
        date_time: new Date(formData.date_time).toISOString()
      }

      if (isEditing) {
        const { data, error } = await supabase
          .from('transport')
          .update(payload)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setRecords(records.map(rec => rec.id === selectedId ? data[0] : rec))
        toast.success('Transport dispatch updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('transport')
          .insert([payload])
          .select()

        if (error) throw error
        setRecords([data[0], ...records])
        toast.success('Transport dispatch created successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving transport record:', err)
      toast.error('Error saving transport record: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This record will be permanently removed. This action cannot be undone.', { title: 'Delete Record' })
    if (!ok) return

    try {
      const { error } = await supabase
        .from('transport')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setRecords(records.filter(rec => rec.id !== id))
      toast.success('Transport record deleted successfully!')
    } catch (err) {
      console.error('Error deleting transport record:', err)
      toast.error('Failed to delete record: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading transport records...</p>
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
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading Records</h3>
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
          <i className="ri-taxi-line" style={{ marginRight: '12px' }}></i>
          Transport Dispatch
        </h2>
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: isAdmin ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Add Dispatch
        </button>
      </div>

      {records.length === 0 ? (
        <div className="empty-state">
          <i className="ri-taxi-line"></i>
          <h3>No Transport Records</h3>
          <p>Click "Add Dispatch" to create your first transport record.</p>
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Date & Time</th>
                <th>Vehicle</th>
                <th>Driver</th>
                <th>Destination</th>
                <th>Purpose</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td><code style={{ fontWeight: '700' }}>{record.record_id || '-'}</code></td>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                    {record.date_time 
                      ? format(new Date(record.date_time), 'MMM dd, yyyy hh:mm a')
                      : '-'}
                  </td>
                  <td style={{ fontWeight: '700' }}>{record.vehicle || '-'}</td>
                  <td>{record.driver || '-'}</td>
                  <td>{record.destination || '-'}</td>
                  <td>
                    <div style={{
                      maxWidth: '300px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '13px',
                      color: 'var(--text-muted)'
                    }}>
                      {record.purpose || '-'}
                    </div>
                  </td>
                  {isAdmin && (
                  <td>
                    <div className="table-actions">
                      <button 
                        className="btn-icon btn-edit"
                        onClick={() => handleOpenEdit(record)}
                        title="Edit Details"
                      >
                        <i className="ri-pencil-line"></i>
                      </button>
                      <button 
                        className="btn-icon btn-delete"
                        onClick={() => handleDelete(record.id)}
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
        Total Records: <strong>{records.length}</strong>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Edit Dispatch Record' : 'Add Transport Dispatch'}
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>Record ID *</label>
              <input 
                type="text" 
                name="record_id" 
                value={formData.record_id} 
                onChange={handleInputChange} 
                required 
               disabled style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280' }} />
            </div>
            <div className="form-group">
              <label>Date & Time *</label>
              <input 
                type="datetime-local" 
                name="date_time" 
                value={formData.date_time} 
                onChange={handleInputChange} 
                required 
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Vehicle *</label>
              <select name="vehicle" value={formData.vehicle} onChange={handleInputChange} required>
                <option value="">-- Select Vehicle --</option>
                {availableVehicles.map((v, i) => (
                  <option key={i} value={`${v.plate} (${v.model})`}>
                    {v.plate} — {v.model}
                  </option>
                ))}
                {availableVehicles.length === 0 && <option value="" disabled>No vehicles registered in DB</option>}
              </select>
            </div>
            <div className="form-group">
              <label>Driver *</label>
              <select name="driver" value={formData.driver} onChange={handleInputChange} required>
                <option value="">-- Select Driver --</option>
                {availableDrivers.map((d, i) => (
                  <option key={i} value={d.name}>
                    {d.name}
                  </option>
                ))}
                {availableDrivers.length === 0 && <option value="" disabled>No drivers registered in DB</option>}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Destination *</label>
            <input 
              type="text" 
              name="destination" 
              value={formData.destination} 
              onChange={handleInputChange} 
              required 
              placeholder="e.g. Brgy. Atate, Palayan City"
            />
          </div>

          <div className="form-group">
            <label>Purpose</label>
            <input 
              type="text" 
              name="purpose" 
              value={formData.purpose} 
              onChange={handleInputChange} 
              placeholder="e.g. Rescue deployment, Logistics transport"
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
