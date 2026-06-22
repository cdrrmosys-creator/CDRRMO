import ModuleToolbar from '../../components/ModuleToolbar'
import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { logAudit } from '../../services/audit'
import { format } from 'date-fns'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'
import { uploadFile, deleteFiles } from '../../services/storage'

const INITIAL_FORM_STATE = {
  record_id: '',
  resolution_no: '',
  title: '',
  date_passed: '',
  description: '',
  files: []
}

export default function CdrrmcReso() {
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

  // File states
  const [isUploading, setIsUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)

  const isAdmin = useIsAdmin()
  const toast = useToast()
  const confirm = useConfirm()

  // Toolbar states
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  useEffect(() => {
    loadRecords()
  }, [])

  const filteredRecords = records.filter(item => {
    let matchesSearch = true
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase()
      matchesSearch = Object.values(item).some(val => 
        val && typeof val === 'string' && val.toLowerCase().includes(lowerSearch)
      )
    }
    
    let matchesFilter = true
    
    let matchesDate = true
    if (dateRange.start && dateRange.end) {
      const dateStr = item.date_time || item.created_at || item.date || item.start_date || item.date_received || item.date_conducted || item.date_attended
      if (dateStr) {
        const created = new Date(dateStr)
        const start = new Date(dateRange.start)
        const end = new Date(dateRange.end)
        end.setHours(23, 59, 59, 999)
        matchesDate = created >= start && created <= end
      }
    }

    return matchesSearch && matchesFilter && matchesDate
  })

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

  
  const handleViewDetails = (rec) => {
    handleOpenEdit(rec)
    setIsViewing(true)
  }

  const handleEditFromView = () => {
    setIsViewing(false)
  }

  const handleDeleteFromView = async () => {
    const idToDelete = selectedId
    setIsModalOpen(false)
    await handleDelete(idToDelete)
  }

const handleOpenAdd = () => {
    setIsEditing(false)
    setIsViewing(false)
    setSelectedId(null)
    setPendingFiles([])
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
    setIsViewing(false)
    setSelectedId(rec.id)
    setPendingFiles([])
    setFormData({
      record_id: rec.record_id || '',
      resolution_no: rec.resolution_no || '',
      title: rec.title || '',
      date_passed: rec.date_passed || '',
      description: rec.description || '',
      files: rec.files || []
    })
    setIsModalOpen(true)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleDragOver = (e) => {
    if (isViewing) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    if (isViewing) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    if (isViewing) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload({ target: { files: e.dataTransfer.files } });
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files)
    if (!files || files.length === 0) return
    setPendingFiles(prev => [...prev, ...files])
  }

  const removeExistingFile = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      files: prev.files.filter((_, idx) => idx !== indexToRemove)
    }))
  }

  const removePendingFile = (indexToRemove) => {
    setPendingFiles(prev => prev.filter((_, idx) => idx !== indexToRemove))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      let newFileUrls = []
      
      if (pendingFiles.length > 0) {
        setIsUploading(true)
        try {
          for (const file of pendingFiles) {
            // Note: We do NOT compress images here to preserve documents
            const path = `reso-files/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            const url = await uploadFile('reso-files', path, file)
            newFileUrls.push(url)
          }
        } catch (error) {
          console.error('Upload error:', error)
          toast.error('Failed to upload some files. Did you run the Supabase storage script?')
          throw error 
        } finally {
          setIsUploading(false)
        }
      }

      const payload = {
        ...formData,
        files: [...(formData.files || []), ...newFileUrls]
      }

      if (isEditing) {
        const { data, error } = await supabase
          .from('cdrrmc_reso')
          .update(payload)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setRecords(filteredRecords.map(rec => rec.id === selectedId ? data[0] : rec))
        await logAudit('Updated', 'CdrrmcReso', formData.record_id || formData.id || selectedId, 'Updated record details')
        toast.success('Resolution updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('cdrrmc_reso')
          .insert([payload])
          .select()

        if (error) throw error
        setRecords([data[0], ...records])
        toast.success('Resolution registered successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving resolution record:', err)
      toast.error('Error saving record: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This resolution will be permanently removed. This action cannot be undone.', { title: 'Delete Record' })
    if (!ok) return

    try {
      const recordToDelete = records.find(item => item.id === id)
      if (recordToDelete && recordToDelete.files && recordToDelete.files.length > 0) {
        const pathsToDelete = recordToDelete.files
          .map(url => {
            const idx = url.indexOf('reso-files/')
            return idx !== -1 ? url.substring(idx) : null
          })
          .filter(Boolean)
        
        if (pathsToDelete.length > 0) {
          await deleteFiles('reso-files', pathsToDelete)
        }
      }

      const { error } = await supabase
        .from('cdrrmc_reso')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setRecords(records.filter(rec => rec.id !== id))
      await logAudit('Deleted', 'CdrrmcReso', id, 'Deleted record')
      toast.success('Resolution record deleted successfully!')
    } catch (err) {
      console.error('Error deleting resolution record:', err)
      toast.error('Failed to delete record: ' + err.message)
    }
  }

  // Helper to get a clean filename from a URL or File object
  const getDisplayFilename = (fileOrUrl) => {
    if (typeof fileOrUrl === 'string') {
      const parts = fileOrUrl.split('/');
      const filenameWithTime = parts[parts.length - 1];
      // remove the timestamp prefix (e.g., 1718223452-my_doc.pdf)
      return filenameWithTime.replace(/^\d+-/, '');
    } else {
      return fileOrUrl.name;
    }
  }

  // Helper to determine icon based on filename
  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return 'ri-image-line';
    if (['pdf'].includes(ext)) return 'ri-file-pdf-line';
    if (['doc', 'docx'].includes(ext)) return 'ri-file-word-line';
    if (['xls', 'xlsx'].includes(ext)) return 'ri-file-excel-line';
    return 'ri-file-text-line';
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

      
      {records.length > 0 && (
        <ModuleToolbar 
          onSearch={setSearchTerm}
          onFilterChange={setFilter}
          onDateRangeChange={setDateRange}
          exportData={filteredRecords}
          exportFilename="cdrrmcreso_report.xlsx"
        />
      )}

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
                
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr 
                  key={record.id}
                  onClick={() => handleViewDetails(record)}
                  style={{ cursor: 'pointer' }}
                  className="table-row-clickable"
                >
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
        Showing <strong>{filteredRecords.length}</strong> of <strong>{records.length}</strong>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isViewing ? 'View Details' : (isEditing ? 'Edit CDRRMC Resolution' : 'Add CDRRMC Resolution')}
        maxWidth="1000px"
      >
        <style>{`
          .reso-form-layout {
            display: flex;
            flex-wrap: wrap;
            gap: 32px;
          }
          .reso-details-col {
            flex: 1 1 450px;
            min-width: 0;
          }
          .reso-files-col {
            flex: 1 1 350px;
            min-width: 0;
            border-left: 2px solid var(--border-light);
            padding-left: 32px;
          }
          .file-item-card {
            display: flex;
            align-items: center;
            padding: 10px 14px;
            background: #fff;
            border: 1px solid var(--border-light);
            border-radius: 8px;
            margin-bottom: 8px;
            gap: 12px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            transition: all 0.2s;
          }
          .file-item-card:hover {
            border-color: var(--primary);
          }
          .file-item-icon {
            font-size: 20px;
            color: var(--primary);
            flex-shrink: 0;
          }
          .file-item-name {
            font-size: 13px;
            font-weight: 500;
            color: var(--text);
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .file-item-delete {
            color: #ef4444;
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .file-item-delete:hover {
            background: #fee2e2;
          }
          @media (max-width: 1050px) {
            .reso-form-layout {
              flex-direction: column;
              gap: 24px;
            }
            .reso-files-col {
              border-left: none;
              padding-left: 0;
              border-top: 2px solid var(--border-light);
              padding-top: 24px;
            }
          }
        `}</style>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="reso-form-layout">
            <div className="reso-details-col">
              <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                      rows={5} 
                      placeholder="State the resolution details..."
                    />
                  </div>
                </div>
              </fieldset>
            </div>

            <div className="reso-files-col">
              <div style={{ minHeight: '350px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <h4 style={{ margin: '0 0 12px 0', color: 'var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Attachments
                  {!isViewing && (
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" 
                        onChange={handleFileUpload}
                        disabled={isUploading || isSaving}
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 10 }} 
                      />
                      <button 
                        type="button" 
                        className="btn-primary" 
                        disabled={isUploading || isSaving}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        {(isUploading || isSaving) ? <i className="ri-loader-4-line ri-spin" style={{ fontSize: '16px' }}></i> : <i className="ri-attachment-line" style={{ fontSize: '16px' }}></i>}
                        {(isUploading || isSaving) ? 'Uploading...' : 'Add Files'}
                      </button>
                    </div>
                  )}
                </h4>
                
                {(!formData.files || formData.files.length === 0) && pendingFiles.length === 0 ? (
                  <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '40px 20px',
                      textAlign: 'center',
                      background: isDragging ? 'var(--primary-bg)' : '#f8fafc',
                      borderRadius: '8px',
                      border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border-light)'}`,
                      color: isDragging ? 'var(--primary)' : 'var(--text-muted)',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}>
                    {!isViewing && (
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" 
                        onChange={handleFileUpload}
                        disabled={isUploading || isSaving}
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: isDragging ? 'copy' : 'pointer', zIndex: 10 }} 
                      />
                    )}
                    <i className="ri-file-upload-line" style={{ fontSize: '48px', color: isDragging ? 'var(--primary)' : 'var(--border-light)', transition: 'all 0.2s' }}></i>
                    <p style={{ marginTop: '12px', fontWeight: '600' }}>{isDragging ? 'Drop files here' : 'No files attached yet.'}</p>
                    {!isViewing && <p style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>Drag and drop documents or click to upload</p>}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {formData.files && formData.files.map((url, idx) => (
                      <div key={`existing-${idx}`} className="file-item-card">
                        <i className={`${getFileIcon(getDisplayFilename(url))} file-item-icon`}></i>
                        <a 
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="file-item-name"
                          style={{ textDecoration: 'none' }}
                          title={getDisplayFilename(url)}
                        >
                          {getDisplayFilename(url)}
                        </a>
                        {!isViewing && (
                          <button
                            type="button"
                            className="file-item-delete"
                            onClick={(e) => { e.preventDefault(); removeExistingFile(idx); }}
                            title="Remove file"
                          >
                            <i className="ri-delete-bin-line"></i>
                          </button>
                        )}
                      </div>
                    ))}

                    {pendingFiles.map((file, idx) => (
                      <div key={`pending-${idx}`} className="file-item-card" style={{ opacity: isUploading ? 0.6 : 1, borderColor: isUploading ? 'var(--border-light)' : 'var(--primary)' }}>
                        {isUploading ? (
                          <i className="ri-loader-4-line ri-spin file-item-icon"></i>
                        ) : (
                          <i className={`${getFileIcon(getDisplayFilename(file))} file-item-icon`}></i>
                        )}
                        <span className="file-item-name" title={getDisplayFilename(file)}>
                          {getDisplayFilename(file)}
                        </span>
                        {!isViewing && !isUploading && (
                          <button
                            type="button"
                            className="file-item-delete"
                            onClick={(e) => { e.preventDefault(); removePendingFile(idx); }}
                            title="Remove file"
                          >
                            <i className="ri-close-line"></i>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
            <div></div>
            {isViewing ? (
              <div style={{ display: 'flex', gap: '12px' }}>
                {isAdmin && (
                  <>
                    <button 
                      type="button"
                      className="btn-delete"
                      onClick={handleDeleteFromView}
                      style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      <i className="ri-delete-bin-line" style={{ marginRight: '6px' }}></i> Delete
                    </button>
                    <button 
                      type="button"
                      className="btn-submit"
                      onClick={handleEditFromView}
                      style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}
                    >
                      <i className="ri-pencil-line" style={{ marginRight: '6px' }}></i> Edit
                    </button>
                  </>
                )}
                {!isAdmin && (
                   <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                     Close
                   </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={isSaving || isUploading}>
                  {isSaving || isUploading ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </div>
  )
}
