import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { format } from 'date-fns'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'

const INITIAL_FORM_STATE = {
  record_id: '',
  volunteer_name: '',
  organization: '',
  accreditation_no: '',
  date: '',
  status: 'Active'
}

export default function Volunteers() {
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
        .from('volunteers')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Error loading volunteer records:', err)
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
      record_id: `VOL-${year}-${rand}`,
      date: todayStr
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (rec) => {
    setIsEditing(true)
    setSelectedId(rec.id)
    setFormData({
      record_id: rec.record_id || '',
      volunteer_name: rec.volunteer_name || '',
      organization: rec.organization || '',
      accreditation_no: rec.accreditation_no || '',
      date: rec.date || '',
      status: rec.status || 'Active'
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
        date: formData.date || null
      }

      if (isEditing) {
        const { data, error } = await supabase
          .from('volunteers')
          .update(payload)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setRecords(records.map(rec => rec.id === selectedId ? data[0] : rec))
        toast.success('Volunteer updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('volunteers')
          .insert([payload])
          .select()

        if (error) throw error
        setRecords([data[0], ...records])
        toast.success('Volunteer registered successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving volunteer record:', err)
      toast.error('Error saving record: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This volunteer will be permanently removed. This action cannot be undone.', { title: 'Delete Record' })
    if (!ok) return

    try {
      const { error } = await supabase
        .from('volunteers')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setRecords(records.filter(rec => rec.id !== id))
      toast.success('Volunteer record deleted successfully!')
    } catch (err) {
      console.error('Error deleting volunteer record:', err)
      toast.error('Failed to delete record: ' + err.message)
    }
  }

  const getStatusBadge = (status) => {
    const colors = {
      'Active': { bg: '#d1fae5', color: '#065f46' },
      'Inactive': { bg: '#fee2e2', color: '#991b1b' },
      'Expired': { bg: '#f3f4f6', color: '#374151' }
    }
    const style = colors[status] || colors['Active']
    
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
        {status || 'Active'}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading volunteers...</p>
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
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading Volunteers</h3>
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
          <i className="ri-user-star-line" style={{ marginRight: '12px' }}></i>
          Volunteers Registry
        </h2>
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: isAdmin ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Register Volunteer
        </button>
      </div>

      {records.length === 0 ? (
        <div className="empty-state">
          <i className="ri-user-star-line"></i>
          <h3>No Volunteers Registered</h3>
          <p>Click "Register Volunteer" to add your first volunteer.</p>
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Volunteer Name</th>
                <th>Organization</th>
                <th>Accreditation No.</th>
                <th>Date Registered</th>
                <th>Status</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td><code style={{ fontWeight: '700' }}>{record.record_id || '-'}</code></td>
                  <td style={{ fontWeight: '700' }}>{record.volunteer_name || '-'}</td>
                  <td>{record.organization || '-'}</td>
                  <td><code style={{ fontSize: '13px' }}>{record.accreditation_no || '-'}</code></td>
                  <td style={{ fontSize: '13px' }}>
                    {record.date 
                      ? format(new Date(record.date), 'MMM dd, yyyy')
                      : '-'}
                  </td>
                  <td>{getStatusBadge(record.status)}</td>
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
        Total Volunteers: <strong>{records.length}</strong>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Edit Volunteer Details' : 'Register Volunteer'}
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
              <label>Volunteer Name *</label>
              <input 
                type="text" 
                name="volunteer_name" 
                value={formData.volunteer_name} 
                onChange={handleInputChange} 
                required 
                placeholder="e.g. Juan dela Cruz"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Organization / Group</label>
              <input 
                type="text" 
                name="organization" 
                value={formData.organization} 
                onChange={handleInputChange} 
                placeholder="e.g. Red Cross Youth, React Ph"
              />
            </div>
            <div className="form-group">
              <label>Accreditation No. *</label>
              <input 
                type="text" 
                name="accreditation_no" 
                value={formData.accreditation_no} 
                onChange={handleInputChange} 
                required 
                placeholder="e.g. ACC-2026-0045"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Date Registered</label>
              <input 
                type="date" 
                name="date" 
                value={formData.date} 
                onChange={handleInputChange} 
              />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select name="status" value={formData.status} onChange={handleInputChange}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Expired">Expired</option>
              </select>
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
