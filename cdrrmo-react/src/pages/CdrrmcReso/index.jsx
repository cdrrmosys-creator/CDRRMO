import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { format } from 'date-fns'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'

const INITIAL_FORM_STATE = {
  record_id: '',
  resolution_no: '',
  title: '',
  date_passed: '',
  description: ''
}

export default function CdrrmcReso() {
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

  useEffect(() => {
    loadRecords()
  }, [])

  const loadRecords = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('cdrrmc_reso')
        .select('*')
        .order('date_passed', { ascending: false })
      
      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Error loading resolutions records:', err)
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
      record_id: `RES-${year}-${rand}`,
      date_passed: todayStr
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (rec) => {
    setIsEditing(true)
    setSelectedId(rec.id)
    setFormData({
      record_id: rec.record_id || '',
      resolution_no: rec.resolution_no || '',
      title: rec.title || '',
      date_passed: rec.date_passed || '',
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
          .from('cdrrmc_reso')
          .update(formData)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setRecords(records.map(rec => rec.id === selectedId ? data[0] : rec))
        alert('Resolution updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('cdrrmc_reso')
          .insert([formData])
          .select()

        if (error) throw error
        setRecords([data[0], ...records])
        alert('Resolution registered successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving resolution record:', err)
      alert('Error saving record: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this resolution?')) return

    try {
      const { error } = await supabase
        .from('cdrrmc_reso')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setRecords(records.filter(rec => rec.id !== id))
    } catch (err) {
      console.error('Error deleting resolution record:', err)
      alert('Failed to delete record: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading resolutions...</p>
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
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading Resolutions</h3>
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
          <i className="ri-file-list-3-line" style={{ marginRight: '12px' }}></i>
          CDRRMC Resolutions
        </h2>
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: isAdmin ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Add Resolution
        </button>
      </div>

      {records.length === 0 ? (
        <div className="empty-state">
          <i className="ri-file-list-3-line"></i>
          <h3>No Resolutions Found</h3>
          <p>Click "Add Resolution" to log your first resolution record.</p>
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Resolution No.</th>
                <th>Title</th>
                <th>Date Passed</th>
                <th>Description</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td><code style={{ fontWeight: '700' }}>{record.record_id || '-'}</code></td>
                  <td style={{ fontWeight: '700' }}>{record.resolution_no || '-'}</td>
                  <td>{record.title || '-'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                    {record.date_passed 
                      ? format(new Date(record.date_passed), 'MMM dd, yyyy')
                      : '-'}
                  </td>
                  <td>
                    <div style={{
                      maxWidth: '250px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '13px',
                      color: 'var(--text-muted)'
                    }}>
                      {record.description || '-'}
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
        Total Resolutions: <strong>{records.length}</strong>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Edit CDRRMC Resolution' : 'Add CDRRMC Resolution'}
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
              <label>Resolution No. *</label>
              <input 
                type="text" 
                name="resolution_no" 
                value={formData.resolution_no} 
                onChange={handleInputChange} 
                required 
                placeholder="e.g. Res. No. 12, S-2026"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Resolution Title *</label>
              <input 
                type="text" 
                name="title" 
                value={formData.title} 
                onChange={handleInputChange} 
                required 
                placeholder="e.g. Declaration of State of Calamity"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Date Passed *</label>
            <input 
              type="date" 
              name="date_passed" 
              value={formData.date_passed} 
              onChange={handleInputChange} 
              required 
            />
          </div>

          <div className="form-group">
            <label>Description / Notes</label>
            <textarea 
              name="description" 
              value={formData.description} 
              onChange={handleInputChange} 
              rows={3} 
              placeholder="State the resolution details..."
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
