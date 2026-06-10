import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { format } from 'date-fns'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'

const INITIAL_FORM_STATE = {
  record_id: '',
  facility_name: 'Multi-Purpose Facility',
  date: '',
  start_time: '',
  end_time: '',
  purpose: '',
  booked_by: ''
}

export default function Venues() {
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
        .from('venues')
        .select('*')
        .order('date', { ascending: false })
      
      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Error loading venue records:', err)
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
      record_id: `VEN-${year}-${rand}`,
      date: todayStr
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (rec) => {
    setIsEditing(true)
    setSelectedId(rec.id)
    setFormData({
      record_id: rec.record_id || '',
      facility_name: rec.facility_name || 'Multi-Purpose Facility',
      date: rec.date || '',
      start_time: rec.start_time || '',
      end_time: rec.end_time || '',
      purpose: rec.purpose || '',
      booked_by: rec.booked_by || ''
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
          .from('venues')
          .update(formData)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setRecords(records.map(rec => rec.id === selectedId ? data[0] : rec))
        toast.success('Booking updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('venues')
          .insert([formData])
          .select()

        if (error) throw error
        setRecords([data[0], ...records])
        toast.success('Booking created successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving venue record:', err)
      toast.error('Error saving booking: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This booking will be permanently removed. This action cannot be undone.', { title: 'Delete Record' })
    if (!ok) return

    try {
      const { error } = await supabase
        .from('venues')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setRecords(records.filter(rec => rec.id !== id))
      toast.success('Reservation deleted successfully!')
    } catch (err) {
      console.error('Error deleting venue record:', err)
      toast.error('Failed to delete booking: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading venue bookings...</p>
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
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading Bookings</h3>
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
          <i className="ri-building-line" style={{ marginRight: '12px' }}></i>
          Venue Bookings
        </h2>
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: isAdmin ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Book Venue
        </button>
      </div>

      {records.length === 0 ? (
        <div className="empty-state">
          <i className="ri-building-line"></i>
          <h3>No Venue Bookings</h3>
          <p>Click "Book Venue" to create your first venue booking.</p>
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Facility Name</th>
                <th>Date</th>
                <th>Time</th>
                <th>Purpose</th>
                <th>Booked By</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td><code style={{ fontWeight: '700' }}>{record.record_id || '-'}</code></td>
                  <td style={{ fontWeight: '700' }}>{record.facility_name || '-'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                    {record.date 
                      ? format(new Date(record.date), 'MMM dd, yyyy')
                      : '-'}
                  </td>
                  <td>{record.start_time} - {record.end_time}</td>
                  <td>
                    <div style={{
                      maxWidth: '250px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '13px',
                      color: 'var(--text-muted)'
                    }}>
                      {record.purpose || '-'}
                    </div>
                  </td>
                  <td>{record.booked_by || '-'}</td>
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
        Total Bookings: <strong>{records.length}</strong>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Edit Venue Booking' : 'New Venue Booking'}
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
              <label>Facility Name *</label>
              <select name="facility_name" value={formData.facility_name} onChange={handleInputChange} required>
                <option value="Multi-Purpose Facility">Multi-Purpose Facility</option>
                <option value="Training Room 1">Training Room 1</option>
                <option value="Training Room 2">Training Room 2</option>
                <option value="DRRM Academy">DRRM Academy</option>
              </select>
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
              <label>Booked By *</label>
              <input 
                type="text" 
                name="booked_by" 
                value={formData.booked_by} 
                onChange={handleInputChange} 
                required 
                placeholder="e.g. CDRRMO-Operations"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Time *</label>
              <input 
                type="time" 
                name="start_time" 
                value={formData.start_time} 
                onChange={handleInputChange} 
                required 
              />
            </div>
            <div className="form-group">
              <label>End Time *</label>
              <input 
                type="time" 
                name="end_time" 
                value={formData.end_time} 
                onChange={handleInputChange} 
                required 
              />
            </div>
          </div>

          <div className="form-group">
            <label>Purpose</label>
            <textarea 
              name="purpose" 
              value={formData.purpose} 
              onChange={handleInputChange} 
              rows={2} 
              placeholder="e.g. Basic Life Support Training Seminar"
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
