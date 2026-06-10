import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { format } from 'date-fns'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'

const INITIAL_FORM_STATE = {
  record_id: '',
  title: '',
  document_type: '',
  date_filed: '',
  filed_by: '',
  description: '',
  file_url: ''
}

const DOC_TYPES = [
  'Memorandum',
  'Circular',
  'Letter',
  'Report',
  'Plan',
  'Manual',
  'Protocol',
  'Resolution',
  'Order',
  'Other'
]

export default function Documentation() {
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
        .from('documentations')
        .select('*')
        .order('date_filed', { ascending: false })

      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Error loading documentation records:', err)
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
      record_id: `DOC-${year}-${rand}`,
      date_filed: todayStr
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (rec) => {
    setIsEditing(true)
    setSelectedId(rec.id)
    setFormData({
      record_id: rec.record_id || '',
      title: rec.title || '',
      document_type: rec.document_type || '',
      date_filed: rec.date_filed || '',
      filed_by: rec.filed_by || '',
      description: rec.description || '',
      file_url: rec.file_url || ''
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
          .from('documentations')
          .update(formData)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setRecords(records.map(rec => rec.id === selectedId ? data[0] : rec))
        toast.success('Document record updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('documentations')
          .insert([formData])
          .select()

        if (error) throw error
        setRecords([data[0], ...records])
        toast.success('Document record added successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving document record:', err)
      toast.error('Error saving record: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This document record will be permanently removed. This action cannot be undone.', { title: 'Delete Record' })
    if (!ok) return

    try {
      const { error } = await supabase
        .from('documentations')
        .delete()
        .eq('id', id)

      if (error) throw error
      setRecords(records.filter(rec => rec.id !== id))
      toast.success('Document deleted successfully!')
    } catch (err) {
      console.error('Error deleting document record:', err)
      toast.error('Failed to delete record: ' + err.message)
    }
  }

  const getTypeBadge = (type) => {
    const colors = {
      'Memorandum': { bg: '#dbeafe', color: '#1e40af' },
      'Circular': { bg: '#d1fae5', color: '#065f46' },
      'Report': { bg: '#fef3c7', color: '#92400e' },
      'Resolution': { bg: '#ede9fe', color: '#5b21b6' },
      'Plan': { bg: '#fee2e2', color: '#991b1b' },
      'Letter': { bg: '#e0f2fe', color: '#0c4a6e' },
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

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading documentation records...</p>
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
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading Documentation</h3>
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
          <i className="ri-folder-line" style={{ marginRight: '12px' }}></i>
          Documentation Archive
        </h2>
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: isAdmin ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Add Document
        </button>
      </div>

      {records.length === 0 ? (
        <div className="empty-state">
          <i className="ri-folder-line"></i>
          <h3>No Documents Filed</h3>
          <p>Click "Add Document" to file your first document record.</p>
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Title</th>
                <th>Type</th>
                <th>Date Filed</th>
                <th>Filed By</th>
                <th>Description</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td><code style={{ fontWeight: '700' }}>{record.record_id || '-'}</code></td>
                  <td style={{ fontWeight: '700' }}>{record.title || '-'}</td>
                  <td>{getTypeBadge(record.document_type)}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                    {record.date_filed
                      ? format(new Date(record.date_filed), 'MMM dd, yyyy')
                      : '-'}
                  </td>
                  <td>{record.filed_by || '-'}</td>
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
                      {record.file_url && (
                        <a
                          href={record.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-icon"
                          title="Open File"
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
                        >
                          <i className="ri-external-link-line"></i>
                        </a>
                      )}
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
        Total Documents: <strong>{records.length}</strong>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Edit Document Record' : 'Add Document Record'}
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
              <label>Document Type *</label>
              <select name="document_type" value={formData.document_type} onChange={handleInputChange} required>
                <option value="">-- Select Type --</option>
                {DOC_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              placeholder="e.g. Memorandum No. 2024-001: Evacuation Protocol"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Date Filed *</label>
              <input
                type="date"
                name="date_filed"
                value={formData.date_filed}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Filed By</label>
              <input
                type="text"
                name="filed_by"
                value={formData.filed_by}
                onChange={handleInputChange}
                placeholder="e.g. CDRRMO Head"
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
              placeholder="Brief description of the document contents..."
            />
          </div>

          <div className="form-group">
            <label>File URL (optional)</label>
            <input
              type="url"
              name="file_url"
              value={formData.file_url}
              onChange={handleInputChange}
              placeholder="https://drive.google.com/..."
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
