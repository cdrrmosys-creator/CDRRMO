import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { format } from 'date-fns'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'

const INITIAL_FORM_STATE = {
  record_id: '',
  event_title: '',
  event_type: '',
  start_date: '',
  end_date: '',
  location: '',
  organizer: '',
  description: ''
}

const EVENT_TYPES = [
  'Drill / Exercise',
  'Training',
  'Meeting',
  'Community Outreach',
  'Disaster Response',
  'Holiday',
  'Maintenance',
  'Other'
]

export default function CalendarEvents() {
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
        .from('calendar_events')
        .select('*')
        .order('start_date', { ascending: false })

      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Error loading calendar events:', err)
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
      record_id: `CAL-${year}-${rand}`,
      start_date: todayStr,
      end_date: todayStr
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (rec) => {
    setIsEditing(true)
    setSelectedId(rec.id)
    setFormData({
      record_id: rec.record_id || '',
      event_title: rec.event_title || '',
      event_type: rec.event_type || '',
      start_date: rec.start_date || '',
      end_date: rec.end_date || '',
      location: rec.location || '',
      organizer: rec.organizer || '',
      description: rec.description || ''
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
          .from('calendar_events')
          .update(formData)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setRecords(records.map(rec => rec.id === selectedId ? data[0] : rec))
        toast.success('Calendar event updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('calendar_events')
          .insert([formData])
          .select()

        if (error) throw error
        setRecords([data[0], ...records])
        toast.success('Calendar event added successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving calendar event:', err)
      toast.error('Error saving event: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This calendar event will be permanently removed. This action cannot be undone.', { title: 'Delete Record' })
    if (!ok) return

    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id)

      if (error) throw error
      setRecords(records.filter(rec => rec.id !== id))
    } catch (err) {
      console.error('Error deleting calendar event:', err)
      toast.error('Failed to delete event: ' + err.message)
    }
  }

  const getEventTypeBadge = (type) => {
    const colors = {
      'Drill / Exercise': { bg: '#fee2e2', color: '#991b1b' },
      'Training': { bg: '#dbeafe', color: '#1e40af' },
      'Meeting': { bg: '#fef3c7', color: '#92400e' },
      'Community Outreach': { bg: '#d1fae5', color: '#065f46' },
      'Disaster Response': { bg: '#fce7f3', color: '#831843' },
      'Holiday': { bg: '#ede9fe', color: '#5b21b6' },
      'Maintenance': { bg: '#e0f2fe', color: '#0c4a6e' },
    }
    const style = colors[type] || { bg: '#e5e7eb', color: '#374151' }

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
        {type || 'Other'}
      </span>
    )
  }

  const getDateRangeDisplay = (start, end) => {
    if (!start) return '-'
    try {
      const startFmt = format(new Date(start), 'MMM dd, yyyy')
      if (!end || end === start) return startFmt
      const endFmt = format(new Date(end), 'MMM dd, yyyy')
      return `${startFmt} – ${endFmt}`
    } catch {
      return start
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading calendar events...</p>
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
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading Calendar Events</h3>
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
          <i className="ri-calendar-line" style={{ marginRight: '12px' }}></i>
          Calendar Events
        </h2>
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: isAdmin ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Add Event
        </button>
      </div>

      {records.length === 0 ? (
        <div className="empty-state">
          <i className="ri-calendar-line"></i>
          <h3>No Calendar Events</h3>
          <p>Click "Add Event" to schedule your first CDRRMO event.</p>
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Event Title</th>
                <th>Type</th>
                <th>Date(s)</th>
                <th>Location</th>
                <th>Organizer</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td><code style={{ fontWeight: '700' }}>{record.record_id || '-'}</code></td>
                  <td style={{ fontWeight: '700' }}>{record.event_title || '-'}</td>
                  <td>{getEventTypeBadge(record.event_type)}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                    {getDateRangeDisplay(record.start_date, record.end_date)}
                  </td>
                  <td>{record.location || '-'}</td>
                  <td>{record.organizer || '-'}</td>
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
        Total Events: <strong>{records.length}</strong>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Edit Calendar Event' : 'Add Calendar Event'}
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
              <label>Event Type *</label>
              <select name="event_type" value={formData.event_type} onChange={handleInputChange} required>
                <option value="">-- Select Type --</option>
                {EVENT_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Event Title *</label>
            <input
              type="text"
              name="event_title"
              value={formData.event_title}
              onChange={handleInputChange}
              required
              placeholder="e.g. Annual Earthquake Drill 2024"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Date *</label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="e.g. Municipal Gymnasium"
              />
            </div>
            <div className="form-group">
              <label>Organizer</label>
              <input
                type="text"
                name="organizer"
                value={formData.organizer}
                onChange={handleInputChange}
                placeholder="e.g. CDRRMO Office"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              placeholder="Brief description of the event, agenda, or objectives..."
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
