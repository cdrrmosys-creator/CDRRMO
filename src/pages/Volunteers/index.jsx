import ModuleToolbar from '../../components/ModuleToolbar'
import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { logAudit } from '../../services/audit'
import { uploadFile, deleteFiles } from '../../services/storage'
import { compressImage } from '../../utils/imageCompression'
import { format } from 'date-fns'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'

const INITIAL_FORM_STATE = {
  record_id: '',
  volunteer_name: '',
  organization: '',
  accreditation_no: '',
  date: '',
  status: 'Active',
  with_insurance: false,
  insurance_number: '',
  insurance_id: '',
  photos: []
}

export default function Volunteers() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isViewing, setIsViewing] = useState(false)
  const [formData, setFormData] = useState(INITIAL_FORM_STATE)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [pendingPhotos, setPendingPhotos] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const isAdmin = useIsAdmin()
  const { canCreate, canUpdate, canDelete } = usePermissions('volunteers')
  const toast = useToast()
  const confirm = useConfirm()

  // Toolbar states
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  useEffect(() => { loadRecords() }, [])

  const filteredRecords = records.filter(item => {
    let matchesSearch = true
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase()
      matchesSearch = Object.values(item).some(val =>
        val && typeof val === 'string' && val.toLowerCase().includes(lowerSearch)
      )
    }
    let matchesDate = true
    if (dateRange.start && dateRange.end) {
      const dateStr = item.date || item.created_at
      if (dateStr) {
        const created = new Date(dateStr)
        const start = new Date(dateRange.start)
        const end = new Date(dateRange.end)
        end.setHours(23, 59, 59, 999)
        matchesDate = created >= start && created <= end
      }
    }
    return matchesSearch && matchesDate
  })

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

  const handleViewDetails = (rec) => { handleOpenEdit(rec); setIsViewing(true) }
  const handleEditFromView = (e) => { e.preventDefault(); e.stopPropagation(); setIsViewing(false) }
  const handleDeleteFromView = async () => { const id = selectedId; setIsModalOpen(false); await handleDelete(id) }

  const handleOpenAdd = () => {
    setIsEditing(false); setIsViewing(false); setSelectedId(null); setPendingPhotos([])
    const year = new Date().getFullYear()
    const rand = Math.floor(1000 + Math.random() * 9000)
    const todayStr = new Date().toISOString().split('T')[0]
    setFormData({ ...INITIAL_FORM_STATE, record_id: `VOL-${year}-${rand}`, date: todayStr })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (rec) => {
    setIsEditing(true); setIsViewing(false); setSelectedId(rec.id); setPendingPhotos([])
    setFormData({
      record_id: rec.record_id || '',
      volunteer_name: rec.volunteer_name || '',
      organization: rec.organization || '',
      accreditation_no: rec.accreditation_no || '',
      date: rec.date || '',
      status: rec.status || 'Active',
      with_insurance: rec.with_insurance || false,
      insurance_number: rec.insurance_number || '',
      insurance_id: rec.insurance_id || '',
      photos: rec.photos || []
    })
    setIsModalOpen(true)
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files)
    if (!files || files.length === 0) return
    setPendingPhotos(prev => [...prev, ...files])
  }

  const handleDragOver = (e) => { if (isViewing) return; e.preventDefault(); e.stopPropagation(); setIsDragging(true) }
  const handleDragLeave = (e) => { if (isViewing) return; e.preventDefault(); e.stopPropagation(); setIsDragging(false) }
  const handleDrop = (e) => {
    if (isViewing) return; e.preventDefault(); e.stopPropagation(); setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload({ target: { files: e.dataTransfer.files } })
    }
  }

  const removeExistingPhoto = (idx) => setFormData(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== idx) }))
  const removePendingPhoto = (idx) => setPendingPhotos(prev => prev.filter((_, i) => i !== idx))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      let newPhotoUrls = []
      if (pendingPhotos.length > 0) {
        setIsUploading(true)
        try {
          for (const file of pendingPhotos) {
            const compressed = await compressImage(file)
            const path = `volunteer-photos/${Date.now()}-${compressed.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            const url = await uploadFile('volunteers', path, compressed)
            newPhotoUrls.push(url)
          }
        } catch (err) {
          toast.error('Failed to upload photos. Make sure a public "volunteers" bucket exists in Supabase.')
          throw err
        } finally {
          setIsUploading(false)
        }
      }

      const payload = {
        ...formData,
        date: formData.date || null,
        insurance_number: formData.with_insurance ? formData.insurance_number : '',
        insurance_id: formData.with_insurance ? formData.insurance_id : '',
        photos: [...(formData.photos || []), ...newPhotoUrls]
      }

      if (isEditing) {
        const { data, error } = await supabase.from('volunteers').update(payload).eq('id', selectedId).select()
        if (error) throw error
        setRecords(records.map(r => r.id === selectedId ? data[0] : r))
        await logAudit('Updated', 'Volunteers', formData.record_id || selectedId, 'Updated record details')
        toast.success('Volunteer updated successfully!')
      } else {
        const { data, error } = await supabase.from('volunteers').insert([payload]).select()
        if (error) throw error
        setRecords([data[0], ...records])
        await logAudit('Added', 'Volunteers', data[0].record_id || data[0].id, 'Created new record')
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
      const rec = records.find(r => r.id === id)
      if (rec?.photos?.length > 0) {
        const paths = rec.photos.map(url => { const i = url.indexOf('volunteer-photos/'); return i !== -1 ? url.substring(i) : null }).filter(Boolean)
        if (paths.length > 0) await deleteFiles('volunteers', paths)
      }
      const { error } = await supabase.from('volunteers').delete().eq('id', id)
      if (error) throw error
      setRecords(records.filter(r => r.id !== id))
      await logAudit('Deleted', 'Volunteers', id, 'Deleted record')
      toast.success('Volunteer record deleted successfully!')
    } catch (err) {
      toast.error('Failed to delete record: ' + err.message)
    }
  }

  const getStatusBadge = (status) => {
    const colors = { 'Active': { bg: '#d1fae5', color: '#065f46' }, 'Inactive': { bg: '#fee2e2', color: '#991b1b' }, 'Expired': { bg: '#f3f4f6', color: '#374151' } }
    const style = colors[status] || colors['Active']
    return <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', background: style.bg, color: style.color }}>{status || 'Active'}</span>
  }

  if (loading) return (
    <div className="loading-container">
      <i className="ri-loader-4-line loading-spinner"></i>
      <p>Loading volunteers...</p>
    </div>
  )

  if (error) return (
    <div style={{ padding: '32px', textAlign: 'center' }}>
      <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: '24px', color: '#991b1b', maxWidth: '500px', margin: '0 auto' }}>
        <i className="ri-error-warning-line" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading Volunteers</h3>
        <p>{error}</p>
        <button onClick={loadRecords} style={{ marginTop: '16px', padding: '10px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}>Try Again</button>
      </div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="ri-user-star-line" style={{ marginRight: '12px' }}></i>
          Volunteers Registry
        </h2>
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: (isAdmin || canCreate) ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Register Volunteer
        </button>
      </div>

      {records.length > 0 && (
        <ModuleToolbar
          onSearch={setSearchTerm}
          onFilterChange={setFilter}
          onDateRangeChange={setDateRange}
          exportData={filteredRecords}
          exportFilename="volunteers_report.xlsx"
        />
      )}

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
                <th>Insurance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id} onClick={() => handleViewDetails(record)} style={{ cursor: 'pointer' }} className="table-row-clickable">
                  <td><code style={{ fontWeight: '700' }}>{record.record_id || '-'}</code></td>
                  <td style={{ fontWeight: '700' }}>{record.volunteer_name || '-'}</td>
                  <td>{record.organization || '-'}</td>
                  <td><code style={{ fontSize: '13px' }}>{record.accreditation_no || '-'}</code></td>
                  <td style={{ fontSize: '13px' }}>{record.date ? format(new Date(record.date), 'MMM dd, yyyy') : '-'}</td>
                  <td>
                    {record.with_insurance ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', background: '#dbeafe', color: '#1e40af' }}>
                        <i className="ri-shield-check-line"></i> Insured
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', background: '#f3f4f6', color: '#6b7280' }}>
                        <i className="ri-shield-line"></i> None
                      </span>
                    )}
                  </td>
                  <td>{getStatusBadge(record.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: '16px', fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center' }}>
        Showing <strong>{filteredRecords.length}</strong> of <strong>{records.length}</strong>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isViewing ? 'View Details' : (isEditing ? 'Edit Volunteer Details' : 'Register Volunteer')}
        maxWidth="1000px"
      >
        <style>{`
          .vol-form-layout { display: flex; flex-wrap: wrap; gap: 32px; }
          .vol-details-col { flex: 1 1 420px; min-width: 0; }
          .vol-photos-col { flex: 1 1 320px; min-width: 0; border-left: 2px solid var(--border-light); padding-left: 32px; }
          @media (max-width: 1050px) {
            .vol-form-layout { flex-direction: column; gap: 24px; }
            .vol-photos-col { border-left: none; padding-left: 0; border-top: 2px solid var(--border-light); padding-top: 24px; }
          }
        `}</style>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="vol-form-layout">

            {/* Left: Volunteer Details */}
            <div className="vol-details-col">
              <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Record ID *</label>
                      <input type="text" name="record_id" value={formData.record_id} onChange={handleInputChange} required disabled style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280' }} />
                    </div>
                    <div className="form-group">
                      <label>Volunteer Name *</label>
                      <input type="text" name="volunteer_name" value={formData.volunteer_name} onChange={handleInputChange} required placeholder="e.g. Juan dela Cruz" />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Organization / Group</label>
                      <input type="text" name="organization" value={formData.organization} onChange={handleInputChange} placeholder="e.g. Red Cross Youth, React Ph" />
                    </div>
                    <div className="form-group">
                      <label>Accreditation No. *</label>
                      <input type="text" name="accreditation_no" value={formData.accreditation_no} onChange={handleInputChange} required placeholder="e.g. ACC-2026-0045" />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Date Registered</label>
                      <input type="date" name="date" value={formData.date} onChange={handleInputChange} />
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

                  {/* Insurance Section */}
                  <div style={{
                    border: '1.5px solid var(--border-light)',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    background: formData.with_insurance ? '#f0f7ff' : '#fafafa',
                    transition: 'background 0.2s'
                  }}>
                    <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px', marginBottom: formData.with_insurance ? '12px' : 0 }}>
                      <input
                        type="checkbox"
                        id="with_insurance"
                        name="with_insurance"
                        checked={formData.with_insurance}
                        onChange={handleInputChange}
                        style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary)' }}
                      />
                      <label htmlFor="with_insurance" style={{ marginBottom: 0, fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="ri-shield-check-line" style={{ color: formData.with_insurance ? 'var(--primary)' : 'var(--text-muted)', fontSize: '16px' }}></i>
                        With Insurance
                      </label>
                    </div>

                    {formData.with_insurance && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>Insurance Number *</label>
                          <input
                            type="text"
                            name="insurance_number"
                            value={formData.insurance_number}
                            onChange={handleInputChange}
                            required={formData.with_insurance}
                            placeholder="e.g. INS-2026-00123"
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label>Insurance ID *</label>
                          <input
                            type="text"
                            name="insurance_id"
                            value={formData.insurance_id}
                            onChange={handleInputChange}
                            required={formData.with_insurance}
                            placeholder="e.g. ID-202600123"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </fieldset>
            </div>

            {/* Right: Photo */}
            <div className="vol-photos-col">
              <div style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <h4 style={{ margin: '0 0 12px 0', color: 'var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Volunteer Photo
                  {!isViewing && (
                    <div style={{ position: 'relative' }}>
                      <input type="file" multiple accept="image/*" onChange={handleFileUpload} disabled={isUploading || isSaving} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 10 }} />
                      <button type="button" className="btn-primary" disabled={isUploading || isSaving} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {(isUploading || isSaving) ? <i className="ri-loader-4-line ri-spin" style={{ fontSize: '16px' }}></i> : <i className="ri-camera-line" style={{ fontSize: '16px' }}></i>}
                        {(isUploading || isSaving) ? 'Uploading...' : 'Add Photo'}
                      </button>
                    </div>
                  )}
                </h4>

                {(!formData.photos || formData.photos.length === 0) && pendingPhotos.length === 0 ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    style={{
                      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      padding: '40px 20px', textAlign: 'center',
                      background: isDragging ? 'var(--primary-bg)' : '#f8fafc',
                      borderRadius: '8px',
                      border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border-light)'}`,
                      color: isDragging ? 'var(--primary)' : 'var(--text-muted)',
                      transition: 'all 0.2s', position: 'relative'
                    }}
                  >
                    {!isViewing && (
                      <input type="file" multiple accept="image/*" onChange={handleFileUpload} disabled={isUploading || isSaving} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: isDragging ? 'copy' : 'pointer', zIndex: 10 }} />
                    )}
                    <i className="ri-user-line" style={{ fontSize: '48px', color: isDragging ? 'var(--primary)' : 'var(--border-light)', transition: 'all 0.2s' }}></i>
                    <p style={{ marginTop: '12px', fontWeight: '600' }}>{isDragging ? 'Drop photo here' : 'No photo uploaded for this volunteer yet.'}</p>
                    {!isViewing && <p style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>Drag and drop or click to upload</p>}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
                    {formData.photos && formData.photos.map((url, idx) => (
                      <div key={`existing-${idx}`} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt={`Volunteer photo ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </a>
                        {!isViewing && (
                          <button type="button" onClick={(e) => { e.preventDefault(); removeExistingPhoto(idx) }} style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <i className="ri-close-line" style={{ fontSize: '14px' }}></i>
                          </button>
                        )}
                      </div>
                    ))}
                    {pendingPhotos.map((file, idx) => {
                      const objectUrl = URL.createObjectURL(file)
                      return (
                        <div key={`pending-${idx}`} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--primary)', opacity: isUploading ? 0.6 : 1 }}>
                          <img src={objectUrl} alt={`Pending ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onLoad={() => URL.revokeObjectURL(objectUrl)} />
                          {!isViewing && !isUploading && (
                            <button type="button" onClick={(e) => { e.preventDefault(); removePendingPhoto(idx) }} style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                              <i className="ri-close-line" style={{ fontSize: '14px' }}></i>
                            </button>
                          )}
                          {isUploading && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', color: 'white' }}>
                              <i className="ri-loader-4-line ri-spin" style={{ fontSize: '24px' }}></i>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
            <div></div>
            {isViewing ? (
              <div style={{ display: 'flex', gap: '12px' }}>{(isAdmin || canDelete) && (
                    <button type="button" className="btn-delete" onClick={handleDeleteFromView} style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <i className="ri-delete-bin-line" style={{ marginRight: '6px' }}></i> Delete
                    </button>
                  )}
                  {(isAdmin || canUpdate) && (
                    <button type="button" className="btn-edit" onClick={handleEditFromView} style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}>
                      <i className="ri-pencil-line" style={{ marginRight: '6px' }}></i> Edit
                    </button>
                  )}
                  {!(isAdmin || canUpdate || canDelete) && (
                  <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Close</button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-submit" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </div>
  )
}
