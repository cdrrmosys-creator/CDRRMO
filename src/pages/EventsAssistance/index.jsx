import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { format } from 'date-fns'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'

const INITIAL_FORM_STATE = {
  record_id: '',
  event_name: '',
  date: '',
  location: '',
  type_of_assistance: '',
  requestor: ''
}

export default function EventsAssistance() {
  const [records, setRecords] = useState([])
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
    loadRecords()
  }, [])

  const loadRecords = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('events_assistance')
        .select('*')
        .order('date', { ascending: false })
      
      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Error loading events assistance records:', err)
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
    const todayStr = new Date().toISOString().split('T')[0]

    setFormData({
      ...INITIAL_FORM_STATE,
      record_id: `AST-${year}-${rand}`,
      date: todayStr
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (rec) => {
    setIsEditing(true)
    setSelectedId(rec.id)
    setFormData({
      record_id: rec.record_id || '',
      event_name: rec.event_name || '',
      date: rec.date || '',
      location: rec.location || '',
      type_of_assistance: rec.type_of_assistance || '',
      requestor: rec.requestor || ''
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
      if (isEditing) {
        const { data, error } = await supabase
          .from('events_assistance')
          .update(formData)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setRecords(records.map(rec => rec.id === selectedId ? data[0] : rec))
        toast.success('Assistance record updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('events_assistance')
          .insert([formData])
          .select()

        if (error) throw error
        setRecords([data[0], ...records])
        toast.success('Assistance record added successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving events assistance record:', err)
      toast.error('Error saving record: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This record will be permanently removed. This action cannot be undone.', { title: 'Delete Record' })
    if (!ok) return

    try {
      const { error } = await supabase
        .from('events_assistance')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setRecords(records.filter(rec => rec.id !== id))
    } catch (err) {
      console.error('Error deleting events assistance record:', err)
      toast.error('Failed to delete record: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading events assistance records...</p>
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
          <i className="ri-calendar-event-line" style={{ marginRight: '12px' }}></i>
          Events Assistance
        </h2>
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: isAdmin ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Request Assistance
        </button>
      </div>

      {records.length === 0 ? (
        <div className="empty-state">
          <i className="ri-calendar-event-line"></i>
          <h3>No Events Assistance Records</h3>
          <p>Click "Request Assistance" to log your first event assistance entry.</p>
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Event Name</th>
                <th>Date</th>
                <th>Location</th>
                <th>Type of Assistance</th>
                <th>Requestor</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td><code style={{ fontWeight: '700' }}>{record.record_id || '-'}</code></td>
                  <td style={{ fontWeight: '700' }}>{record.event_name || '-'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                    {record.date 
                      ? format(new Date(record.date), 'MMM dd, yyyy')
                      : '-'}
                  </td>
                  <td>{record.location || '-'}</td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '700',
                      background: '#dbeafe',
                      color: '#1e40af'
                    }}>
                      {record.type_of_assistance || '-'}
                    </span>
                  </td>
                  <td>{record.requestor || '-'}</td>
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
        title={isEditing ? 'Edit Assistance Request' : 'Request Event Assistance'}
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
              <label>Event Name *</label>
              <input 
                type="text" 
                name="event_name" 
                value={formData.event_name} 
                onChange={handleInputChange} 
                required 
                placeholder="e.g. City Charter Day Parade"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Date *</label>
              <input 
                type="date" 
                name="date" 
                value={formData.date} 
                onChange={handleInputChange} 
                required 
              />
            </div>
            <div className="form-group">
              <label>Location</label>
              <input 
                type="text" 
                name="location" 
                value={formData.location} 
                onChange={handleInputChange} 
                placeholder="e.g. Palayan City Plaza"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Type of Assistance *</label>
              <input 
                type="text" 
                name="type_of_assistance" 
                value={formData.type_of_assistance} 
                onChange={handleInputChange} 
                required 
                placeholder="e.g. Ambulance Standby, First-Aid Station"
              />
            </div>
            <div className="form-group">
              <label>Requestor / Agency</label>
              <input 
                type="text" 
                name="requestor" 
                value={formData.requestor} 
                onChange={handleInputChange} 
                placeholder="e.g. LGU Palayan - Tourism Office"
              />
            </div>
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
