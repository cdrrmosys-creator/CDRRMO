import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { format } from 'date-fns'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'

const INITIAL_FORM_STATE = {
  record_id: '',
  incident_type: '',
  location: '',
  date_time: '',
  severity: 'Medium',
  remarks: ''
}

export default function Incidents() {
  const [incidents, setIncidents] = useState([])
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
    loadIncidents()
  }, [])

  const loadIncidents = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .order('date_time', { ascending: false })
      
      if (error) throw error
      setIncidents(data || [])
    } catch (err) {
      console.error('Error loading incidents:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenAdd = () => {
    setIsEditing(false)
    setSelectedId(null)
    // Generate incident ID
    const year = new Date().getFullYear()
    const rand = Math.floor(1000 + Math.random() * 9000)
    // Set default local datetime string for input type="datetime-local" (YYYY-MM-DDThh:mm)
    const now = new Date()
    const tzOffset = now.getTimezoneOffset() * 60000
    const localISOTime = (new Date(now - tzOffset)).toISOString().slice(0, 16)
    
    setFormData({
      ...INITIAL_FORM_STATE,
      record_id: `INC-${year}-${rand}`,
      date_time: localISOTime
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (inc) => {
    setIsEditing(true)
    setSelectedId(inc.id)
    
    // Parse date for datetime-local input
    let formattedDateTime = ''
    if (inc.date_time) {
      const d = new Date(inc.date_time)
      const tzOffset = d.getTimezoneOffset() * 60000
      formattedDateTime = (new Date(d - tzOffset)).toISOString().slice(0, 16)
    }

    setFormData({
      record_id: inc.record_id || '',
      incident_type: inc.incident_type || '',
      location: inc.location || '',
      date_time: formattedDateTime,
      severity: inc.severity || 'Medium',
      remarks: inc.remarks || ''
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
      // Format datetime back to standard timestamp with timezone
      const payload = {
        ...formData,
        date_time: new Date(formData.date_time).toISOString()
      }

      if (isEditing) {
        const { data, error } = await supabase
          .from('incidents')
          .update(payload)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setIncidents(incidents.map(inc => inc.id === selectedId ? data[0] : inc))
        toast.success('Incident updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('incidents')
          .insert([payload])
          .select()

        if (error) throw error
        setIncidents([data[0], ...incidents])
        toast.success('Incident reported successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving incident:', err)
      toast.error('Error saving incident: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This incident record will be permanently removed. This action cannot be undone.', { title: 'Delete Record' })
    if (!ok) return

    try {
      const { error } = await supabase
        .from('incidents')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setIncidents(incidents.filter(inc => inc.id !== id))
    } catch (err) {
      console.error('Error deleting incident:', err)
      toast.error('Failed to delete incident: ' + err.message)
    }
  }

  const getSeverityBadge = (severity) => {
    const colors = {
      'Low': { bg: '#d1fae5', color: '#065f46' },
      'Medium': { bg: '#fef3c7', color: '#92400e' },
      'High': { bg: '#fed7aa', color: '#9a3412' },
      'Critical': { bg: '#fee2e2', color: '#991b1b' }
    }
    const style = colors[severity] || colors['Medium']
    
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
        {severity || 'Medium'}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading incidents...</p>
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
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading Incidents</h3>
          <p>{error}</p>
          <button 
            onClick={loadIncidents}
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
          <i className="ri-alarm-warning-line" style={{ marginRight: '12px' }}></i>
          Incident Reports
        </h2>
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: isAdmin ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Report Incident
        </button>
      </div>

      {incidents.length === 0 ? (
        <div className="empty-state">
          <i className="ri-alarm-warning-line"></i>
          <h3>No Incidents Reported</h3>
          <p>Click "Report Incident" to log your first incident.</p>
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Date & Time</th>
                <th>Type</th>
                <th>Location</th>
                <th>Severity</th>
                <th>Remarks</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr key={incident.id}>
                  <td><code style={{ fontWeight: '700' }}>{incident.record_id || '-'}</code></td>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                    {incident.date_time 
                      ? format(new Date(incident.date_time), 'MMM dd, yyyy hh:mm a')
                      : '-'}
                  </td>
                  <td style={{ fontWeight: '700' }}>{incident.incident_type || '-'}</td>
                  <td>{incident.location || '-'}</td>
                  <td>{getSeverityBadge(incident.severity)}</td>
                  <td>
                    <div style={{
                      maxWidth: '300px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '13px',
                      color: 'var(--text-muted)'
                    }}>
                      {incident.remarks || 'No remarks'}
                    </div>
                  </td>
                  {isAdmin && (
                  <td>
                    <div className="table-actions">
                      <button 
                        className="btn-icon btn-edit"
                        onClick={() => handleOpenEdit(incident)}
                        title="Edit Details"
                      >
                        <i className="ri-pencil-line"></i>
                      </button>
                      <button 
                        className="btn-icon btn-delete"
                        onClick={() => handleDelete(incident.id)}
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
        Total Incidents: <strong>{incidents.length}</strong>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Edit Incident Report' : 'New Incident Report'}
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
              <label>Incident Type *</label>
              <input 
                type="text" 
                name="incident_type" 
                value={formData.incident_type} 
                onChange={handleInputChange} 
                required 
                placeholder="e.g. Fire, Flood, Vehicular Accident"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Location *</label>
              <input 
                type="text" 
                name="location" 
                value={formData.location} 
                onChange={handleInputChange} 
                required 
                placeholder="e.g. Brgy. Marcos, Palayan City"
              />
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

          <div className="form-group">
            <label>Severity *</label>
            <select name="severity" value={formData.severity} onChange={handleInputChange} required>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          <div className="form-group">
            <label>Remarks / Notes</label>
            <textarea 
              name="remarks" 
              value={formData.remarks} 
              onChange={handleInputChange} 
              rows={3} 
              placeholder="Provide a detailed description of the incident..."
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
