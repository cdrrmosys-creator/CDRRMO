import ModuleToolbar from '../../components/ModuleToolbar'
import ListPagination from '../../components/ListPagination'
import ExportModal from '../../components/ExportModal'
import TableGhostRows from '../../components/TableGhostRows'
import useListPagination from '../../hooks/useListPagination'
import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { logAudit } from '../../services/audit'
import { format } from 'date-fns'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'
import TrainingRegistrations from './TrainingRegistrations'
import DrrmTraining from './DrrmTraining'
import { uploadFile, deleteFiles } from '../../services/storage'

const INITIAL_FORM_STATE = {
  record_id: '',
  title: '',
  document_type: '',
  date_filed: '',
  filed_by: '',
  description: '',
  files: []
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
  'Event Photos / Involvements',
  'Other'
]

export default function Documentation() {
  const [activeTab, setActiveTab] = useState('archive')
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
  const { canCreate, canUpdate, canDelete } = usePermissions('documentation')
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

  const [isExportOpen, setIsExportOpen] = useState(false)
  const { currentPage, setCurrentPage, pageSize, setPageSize: handlePageSizeChange, totalPages, safePage, pagedRecords } = useListPagination(filteredRecords)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filter, dateRange, setCurrentPage])

  const hasActiveFilters = !!(searchTerm || filter || dateRange.start || dateRange.end)

  const handleClearFilters = () => {
    setSearchTerm('')
    setFilter('')
    setDateRange({ start: '', end: '' })
    setCurrentPage(1)
  }

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

  const handleViewDetails = (rec) => {
    handleOpenEdit(rec)
    setIsViewing(true)
  }

  const handleEditFromView = (e) => { e.preventDefault(); e.stopPropagation(); setIsViewing(false) }

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
      record_id: `DOC-${year}-${rand}`,
      date_filed: todayStr
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
      title: rec.title || '',
      document_type: rec.document_type || '',
      date_filed: rec.date_filed || '',
      filed_by: rec.filed_by || '',
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
            // General uncompressed upload for pdfs, docs, etc.
            const path = `doc-files/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            const url = await uploadFile('doc-files', path, file)
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
          .from('documentations')
          .update(payload)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setRecords(filteredRecords.map(rec => rec.id === selectedId ? data[0] : rec))
        await logAudit('Updated', 'Documentation', formData.record_id || formData.id || selectedId, 'Updated record details')
        toast.success('Document record updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('documentations')
          .insert([payload])
          .select()

        if (error) throw error
        setRecords([data[0], ...records])
        await logAudit('Added', 'Documentation', formData.record_id || data[0].record_id || data[0].id, 'Created new record')
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
      const recordToDelete = records.find(item => item.id === id)
      if (recordToDelete && recordToDelete.files && recordToDelete.files.length > 0) {
        const pathsToDelete = recordToDelete.files
          .map(url => {
            const idx = url.indexOf('doc-files/')
            return idx !== -1 ? url.substring(idx) : null
          })
          .filter(Boolean)
        
        if (pathsToDelete.length > 0) {
          await deleteFiles('doc-files', pathsToDelete)
        }
      }

      const { error } = await supabase
        .from('documentations')
        .delete()
        .eq('id', id)

      if (error) throw error
      setRecords(records.filter(rec => rec.id !== id))
      await logAudit('Deleted', 'Documentation', id, 'Deleted record')
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

  // Helper to get a clean filename from a URL or File object
  const getDisplayFilename = (fileOrUrl) => {
    if (typeof fileOrUrl === 'string') {
      const parts = fileOrUrl.split('/');
      const filenameWithTime = parts[parts.length - 1];
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
      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        gap: '4px',
        borderBottom: '2px solid var(--border-light)',
        marginBottom: '24px',
        paddingBottom: '0'
      }}>
        {[
          { key: 'archive',       label: 'Documentation Archive', icon: 'ri-folder-line' },
          { key: 'registrations', label: 'Training Registrations', icon: 'ri-user-add-line' },
          { key: 'drrm-training', label: 'DRRM Office Training',   icon: 'ri-award-line' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: activeTab === tab.key ? '3px solid var(--primary)' : '3px solid transparent',
              background: 'none',
              cursor: 'pointer',
              fontWeight: activeTab === tab.key ? '700' : '500',
              color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-muted)',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s',
              marginBottom: '-2px'
            }}
          >
            <i className={tab.icon}></i>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'drrm-training' ? (
        <DrrmTraining />
      ) : activeTab === 'registrations' ? (
        <TrainingRegistrations />
      ) : (
      <div>
      <div className="page-header">
        <h2>
          <i className="ri-folder-line" style={{ marginRight: '12px' }}></i>
          Documentation Archive
        </h2>
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: (isAdmin || canCreate) ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Add Document
        </button>
      </div>

      
      {records.length > 0 && (
        <ModuleToolbar
          onSearch={setSearchTerm}
          onFilterChange={setFilter}
          onDateRangeChange={setDateRange}
          pageSize={pageSize}
          onPageSizeChange={handlePageSizeChange}
          onExportClick={() => setIsExportOpen(true)}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      )}

      {records.length === 0 ? (
        <div className="empty-state">
          <i className="ri-folder-line"></i>
          <h3>No Documents Filed</h3>
          <p>Click "Add Document" to file your first document record.</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="empty-state">
          <i className="ri-filter-off-line"></i>
          <h3>No Matching Records</h3>
          <p>Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Date Filed</th>
                <th>Filed By</th>
                <th>Description</th>
                <th>Attachments</th>
              </tr>
            </thead>
            <tbody>
              {pagedRecords.map((record) => (
                <tr 
                  key={record.id}
                  onClick={() => handleViewDetails(record)}
                  style={{ cursor: 'pointer', height: '49px' }}
                  className="table-row-clickable"
                >
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
                  <td onClick={(e) => e.stopPropagation()}>
                    {record.files && record.files.length > 0 ? (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', maxWidth: '150px' }}>
                        {record.files.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                            <i className={getFileIcon(getDisplayFilename(url))} title={getDisplayFilename(url)} style={{ fontSize: '16px' }}></i>
                            <span style={{ maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getDisplayFilename(url)}</span>
                          </a>
                        ))}
                      </div>
                    ) : '-'}
                  </td>
                </tr>
              ))}
              <TableGhostRows count={Math.max(0, pageSize - pagedRecords.length)} colSpan={7} />
            </tbody>
          </table>
        </div>
      )}

      <ListPagination
        currentPage={safePage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalRecords={filteredRecords.length}
        onPageChange={setCurrentPage}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        records={records}
        filename="documentation_report.xlsx"
        sheetName="Documentation"
        dateField="date_filed"
        onSuccess={(count) => toast.success(`Exported ${count} records.`)}
        onError={(msg) => toast.error(msg)}
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isViewing ? 'View Details' : (isEditing ? 'Edit Document Record' : 'Add Document Record')}
        maxWidth="1000px"
      >
        <style>{`
          .doc-form-layout {
            display: flex;
            flex-wrap: wrap;
            gap: 32px;
          }
          .doc-details-col {
            flex: 1 1 450px;
            min-width: 0;
          }
          .doc-files-col {
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
            .doc-form-layout {
              flex-direction: column;
              gap: 24px;
            }
            .doc-files-col {
              border-left: none;
              padding-left: 0;
              border-top: 2px solid var(--border-light);
              padding-top: 24px;
            }
          }
        `}</style>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="doc-form-layout">
            <div className="doc-details-col">
              <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-row">
                    
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
                      rows={4}
                      placeholder="Brief description of the document contents..."
                    />
                  </div>
                </div>
              </fieldset>
            </div>

            <div className="doc-files-col">
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
                      background: isDragging ? 'var(--primary-bg)' : 'var(--bg-app)',
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
                    <p style={{ marginTop: '12px', fontWeight: '600' }}>{isDragging ? 'Drop documents here' : 'No documents attached yet.'}</p>
                    {!isViewing && <p style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>Drag and drop files or click to upload</p>}
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
              <div style={{ display: 'flex', gap: '12px' }}>{(isAdmin || canDelete) && (
                    <button 
                      type="button"
                      className="btn-delete"
                      onClick={handleDeleteFromView}
                      style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      <i className="ri-delete-bin-line" style={{ marginRight: '6px' }}></i> Delete
                    </button>
                  )}
                  {(isAdmin || canUpdate) && (
                    <button 
                      type="button" className="btn-edit"
                      onClick={handleEditFromView}
                      style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}
                    >
                      <i className="ri-pencil-line" style={{ marginRight: '6px' }}></i> Edit
                    </button>
                  )}
                  {!(isAdmin || canUpdate || canDelete) && (
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
    )}
    </div>
  )
}
