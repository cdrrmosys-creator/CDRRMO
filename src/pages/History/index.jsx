import ModuleToolbar from '../../components/ModuleToolbar'
import ListPagination from '../../components/ListPagination'
import ExportModal from '../../components/ExportModal'
import TableGhostRows from '../../components/TableGhostRows'
import useListPagination from '../../hooks/useListPagination'
import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { logAudit } from '../../services/audit'
import { format } from 'date-fns'
import { printPDF } from '../../utils/printPDF'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'
import { uploadFile, deleteFiles } from '../../services/storage'

const INITIAL_FORM_STATE = {
  record_id: '',
  event_title: '',
  date: '',
  description: '',
  disaster_type: '',
  disaster_type_other: '',
  casualties: '',
  evacuees: '',
  affected_families: '',
  damage_cost: '',
  files: [],
  created_by: '',
  updated_by: ''
}

const HISTORY_EXPORT_COLUMNS = [
  'record_id', 'event_title', 'date', 'disaster_type',
  'description', 'casualties', 'evacuees', 'affected_families', 'damage_cost',
  'files', 'saved_at'
]

const HISTORY_EXPORT_HEADERS = {
  record_id: 'Record ID',
  event_title: 'Event Title',
  date: 'Date',
  disaster_type: 'Disaster/Hazard Type',
  description: 'Description',
  casualties: 'Casualties',
  evacuees: 'Evacuees',
  affected_families: 'Affected Families',
  damage_cost: 'Damage Cost (₱)',
  files: 'Files',
  saved_at: 'Saved At'
}

export default function History() {
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
  const { canCreate, canUpdate, canDelete } = usePermissions('history')
  const toast = useToast()
  const confirm = useConfirm()


  // Toolbar states
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [isExportOpen, setIsExportOpen] = useState(false)

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

    const matchesFilter = !filter || item.disaster_type === filter
    return matchesSearch && matchesFilter && matchesDate
  })

  const { currentPage, setCurrentPage, pageSize, setPageSize, totalPages, safePage, pagedRecords } = useListPagination(filteredRecords)
  const hasActiveFilters = !!(searchTerm || filter || dateRange.start || dateRange.end)

  const handleClearFilters = () => {
    setSearchTerm('')
    setFilter('')
    setDateRange({ start: '', end: '' })
    setCurrentPage(1)
  }

  const handlePrintPDF = () => {
    printPDF({
      title: 'History Report',
      subtitle: `${filteredRecords.length} records`,
      columns: [
        { header: 'Event Title', key: 'event_title' },
        { header: 'Date', key: 'date', format: v => v ? format(new Date(v), 'MMM dd, yyyy') : '—' },
        { 
          header: 'Disaster/Hazard Type', 
          key: 'disaster_type',
          format: (val, record) => {
            if (record.disaster_type === 'Others' && record.disaster_type_other) {
              return record.disaster_type_other
            }
            return val || '—'
          }
        },
        { header: 'Description', key: 'description' },
      ],
      records: filteredRecords,
    })
  }

  const loadRecords = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('history')
        .select('*')
        .order('date', { ascending: false })
      
      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Error loading history records:', err)
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
      record_id: `HIS-${year}-${rand}`,
      date: todayStr
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
      event_title: rec.event_title || '',
      date: rec.date || '',
      description: rec.description || '',
      disaster_type: rec.disaster_type || '',
      disaster_type_other: rec.disaster_type_other || '',
      casualties: rec.casualties ?? '',
      evacuees: rec.evacuees ?? '',
      affected_families: rec.affected_families ?? '',
      damage_cost: rec.damage_cost ?? '',
      files: rec.files || [],
      created_by: rec.created_by || '',
      updated_by: rec.updated_by || ''
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
            // Uncompressed files upload for pdfs, docs, photos etc.
            const path = `history-files/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            const url = await uploadFile('history-files', path, file)
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
          .from('history')
          .update(payload)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setRecords(filteredRecords.map(rec => rec.id === selectedId ? data[0] : rec))
        await logAudit('Updated', 'History', formData.record_id || formData.id || selectedId, 'Updated record details')
        toast.success('Historical record updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('history')
          .insert([payload])
          .select()

        if (error) throw error
        setRecords([data[0], ...records])
        await logAudit('Added', 'History', formData.record_id || data[0].record_id || data[0].id, 'Created new record')
        toast.success('Historical record added successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving history record:', err)
      toast.error('Error saving record: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This historical record will be permanently removed. This action cannot be undone.', { title: 'Delete Record' })
    if (!ok) return

    try {
      const recordToDelete = records.find(item => item.id === id)
      if (recordToDelete && recordToDelete.files && recordToDelete.files.length > 0) {
        const pathsToDelete = recordToDelete.files
          .map(url => {
            const idx = url.indexOf('history-files/')
            return idx !== -1 ? url.substring(idx) : null
          })
          .filter(Boolean)
        
        if (pathsToDelete.length > 0) {
          await deleteFiles('history-files', pathsToDelete)
        }
      }

      const { error } = await supabase
        .from('history')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setRecords(records.filter(rec => rec.id !== id))
      await logAudit('Deleted', 'History', id, 'Deleted record')
      toast.success('History record deleted successfully!')
    } catch (err) {
      console.error('Error deleting history record:', err)
      toast.error('Failed to delete record: ' + err.message)
    }
  }

  const getCategoryBadge = (category) => {
    const colors = {
      'Disaster': { bg: '#fee2e2', color: '#991b1b' },
      'Milestone': { bg: '#dbeafe', color: '#1e40af' },
      'Operation': { bg: '#d1fae5', color: '#065f46' },
      'Policy': { bg: '#fef3c7', color: '#92400e' }
    }
    const style = colors[category] || { bg: '#e5e7eb', color: '#374151' }
    
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
        {category || 'General'}
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
        <p>Loading historical records...</p>
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
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading History</h3>
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
          <i className="ri-history-line" style={{ marginRight: '12px' }}></i>
          Historical Records
        </h2>
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: (isAdmin || canCreate) ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Add Historical Record
        </button>
      </div>

      

      {records.length > 0 && (
        <ModuleToolbar
          onSearch={v => { setSearchTerm(v); setCurrentPage(1) }}
          onFilterChange={v => { setFilter(v); setCurrentPage(1) }}
          onDateRangeChange={r => { setDateRange(r); setCurrentPage(1) }}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          onExportClick={() => setIsExportOpen(true)}
          onPrintClick={handlePrintPDF}
          onClearFilters={handleClearFilters}
          filterLabel="All Types"
          filterOptions={[
            { label: 'Typhoon', value: 'Typhoon' },
            { label: 'Flooding', value: 'Flooding' },
            { label: 'Landslide (Rain-induced)', value: 'Landslide (Rain-induced)' },
            { label: 'Landslide (EQ-induced)', value: 'Landslide (EQ-induced)' },
            { label: 'Earthquake', value: 'Earthquake' },
            { label: 'Fire', value: 'Fire' },
            { label: 'Drought', value: 'Drought' },
            { label: 'Armed Conflict', value: 'Armed Conflict' },
            { label: 'Others', value: 'Others' },
          ]}
          filterColorMap={{
            'Typhoon': { bg: '#fee2e2', color: '#991b1b', icon: 'ri-typhoon-line' },
            'Flooding': { bg: '#dbeafe', color: '#1e40af', icon: 'ri-water-flash-line' },
            'Landslide (Rain-induced)': { bg: '#fef3c7', color: '#92400e', icon: 'ri-landscape-line' },
            'Landslide (EQ-induced)': { bg: '#fef3c7', color: '#92400e', icon: 'ri-landscape-line' },
            'Earthquake': { bg: '#ede9fe', color: '#5b21b6', icon: 'ri-earthquake-line' },
            'Fire': { bg: '#fee2e2', color: '#991b1b', icon: 'ri-fire-line' },
            'Drought': { bg: '#fef3c7', color: '#92400e', icon: 'ri-sun-line' },
            'Armed Conflict': { bg: '#e5e7eb', color: '#374151', icon: 'ri-shield-cross-line' },
            'Others': { bg: '#e5e7eb', color: '#374151', icon: 'ri-more-line' },
          }}
          hasActiveFilters={hasActiveFilters}
        />
      )}

{records.length === 0 ? (
        <div className="empty-state">
          <i className="ri-history-line"></i>
          <h3>No Historical Records</h3>
          <p>Click "Add Historical Record" to log your first record.</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="empty-state">
          <i className="ri-filter-off-line"></i>
          <h3>No Matching Records</h3>
          <p>Try adjusting your search or filters.</p>
        </div>
      ) : (
        <>
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Event Title</th>
                <th>Date</th>
                <th>Disaster/Hazard Type</th>
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
                  <td style={{ fontWeight: '700' }}>{record.event_title || '-'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                    {record.date 
                      ? format(new Date(record.date), 'MMM dd, yyyy')
                      : '-'}
                  </td>
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
                      {record.disaster_type === 'Others' && record.disaster_type_other 
                        ? `Others: ${record.disaster_type_other}` 
                        : (record.disaster_type || '-')}
                    </span>
                  </td>
                  <td>
                    <div style={{
                      maxWidth: '200px',
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
              <TableGhostRows count={pageSize - pagedRecords.length} colSpan={6} />
            </tbody>
          </table>
        </div>
        <ListPagination
          currentPage={safePage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalRecords={filteredRecords.length}
          onPageChange={setCurrentPage}
        />
        </>
      )}

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        records={records}
        filename="history_report.xlsx"
        sheetName="History"
        dateField="date"
        columns={HISTORY_EXPORT_COLUMNS}
        headers={HISTORY_EXPORT_HEADERS}
        transformValue={(col, val, record) => {
          if (col === 'disaster_type') {
            return record.disaster_type === 'Others' && record.disaster_type_other 
              ? record.disaster_type_other 
              : val
          }
          if (col === 'files') {
            return Array.isArray(val) && val.length > 0 ? val.join('\n') : ''
          }
          return val
        }}
        onSuccess={(count) => toast.success(`Exported ${count} records successfully.`)}
        onError={(msg) => toast.error(msg)}
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isViewing ? 'View Details' : (isEditing ? 'Edit Historical Record' : 'Add Historical Record')}
        maxWidth="1000px"
      >
        <style>{`
          .history-form-layout {
            display: flex;
            flex-wrap: wrap;
            gap: 32px;
          }
          .history-details-col {
            flex: 1 1 450px;
            min-width: 0;
          }
          .history-files-col {
            flex: 1 1 350px;
            min-width: 0;
            border-left: 2px solid var(--border-light);
            padding-left: 32px;
          }
          .file-item-card {
            display: flex;
            align-items: center;
            padding: 10px 14px;
            background: var(--bg-surface);
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
            .history-form-layout {
              flex-direction: column;
              gap: 24px;
            }
            .history-files-col {
              border-left: none;
              padding-left: 0;
              border-top: 2px solid var(--border-light);
              padding-top: 24px;
            }
          }
        `}</style>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="history-form-layout">
            <div className="history-details-col">
              <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Disaster / Hazard Type *</label>
                      <select name="disaster_type" value={formData.disaster_type} onChange={handleInputChange} required>
                        <option value="">-- Select Type --</option>
                        <option value="Typhoon">Typhoon</option>
                        <option value="Flooding">Flooding</option>
                        <option value="Landslide (Rain-induced)">Landslide (Rain-induced)</option>
                        <option value="Landslide (EQ-induced)">Landslide (EQ-induced)</option>
                        <option value="Earthquake">Earthquake</option>
                        <option value="Fire">Fire</option>
                        <option value="Drought">Drought</option>
                        <option value="Armed Conflict">Armed Conflict</option>
                        <option value="Others">Others</option>
                      </select>
                    </div>
                    {formData.disaster_type === 'Others' && (
                      <div className="form-group">
                        <label>Specify Type *</label>
                        <input 
                          type="text" 
                          name="disaster_type_other" 
                          value={formData.disaster_type_other} 
                          onChange={handleInputChange} 
                          required={formData.disaster_type === 'Others'}
                          placeholder="e.g. Volcanic Eruption, Tsunami"
                        />
                      </div>
                    )}
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Event Title *</label>
                      <input 
                        type="text" 
                        name="event_title" 
                        value={formData.event_title} 
                        onChange={handleInputChange} 
                        required 
                        placeholder="e.g. Typhoon Karding Response"
                      />
                    </div>
                    <div className="form-group">
                      <label>Date *</label>
                      <input max={new Date().toISOString().split('T')[0]} type="date" name="date" value={formData.date} onChange={handleInputChange} required />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>No. of Casualties</label>
                      <input type="number" name="casualties" value={formData.casualties} onChange={handleInputChange} min="0" placeholder="0" />
                    </div>
                    <div className="form-group">
                      <label>No. of Evacuees</label>
                      <input type="number" name="evacuees" value={formData.evacuees} onChange={handleInputChange} min="0" placeholder="0" />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>No. of Affected Families</label>
                      <input type="number" name="affected_families" value={formData.affected_families} onChange={handleInputChange} min="0" placeholder="0" />
                    </div>
                    <div className="form-group">
                      <label>Estimated Damage Cost (₱)</label>
                      <input type="number" name="damage_cost" value={formData.damage_cost} onChange={handleInputChange} min="0" step="0.01" placeholder="0.00" />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Description *</label>
                    <textarea 
                      name="description" 
                      value={formData.description} 
                      onChange={handleInputChange} 
                      required 
                      rows={5} 
                      placeholder="State a full description of the historical event..."
                    />
                  </div>
                </div>
              </fieldset>
            </div>

            <div className="history-files-col">
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
                    <p style={{ marginTop: '12px', fontWeight: '600' }}>{isDragging ? 'Drop files here' : 'No files attached yet.'}</p>
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

          {/* Creator & Editor Info */}
          {isViewing && (formData.created_by || formData.updated_by) && (
            <div style={{
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '2px solid var(--border-light)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '12px',
              color: 'var(--text-muted)',
              background: 'var(--bg-app)',
              padding: '12px 16px',
              borderRadius: '8px'
            }}>
              {formData.created_by && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="ri-user-add-line" style={{ fontSize: '14px', color: 'var(--primary)' }}></i>
                  <span>Published by:</span>
                  <strong style={{ color: 'var(--text)' }}>
                    {formData.created_by.split('@')[0]}
                  </strong>
                </div>
              )}
              {formData.updated_by && formData.updated_by !== formData.created_by && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="ri-edit-line" style={{ fontSize: '14px', color: 'var(--primary)' }}></i>
                  <span>Last edited by:</span>
                  <strong style={{ color: 'var(--text)' }}>
                    {formData.updated_by.split('@')[0]}
                  </strong>
                </div>
              )}
            </div>
          )}

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
  )
}