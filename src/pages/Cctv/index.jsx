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
  report_title: '',
  date_start: '',
  date_end: '',
  operator: '',
  asst_operator: '',
  client_name: '',
  client_contact: '',
  client_address: '',
  exact_place: '',
  nature_of_incident: '',
  time_of_incident: '',
  others: '',
  prepared_by: '',
  summary: '',
  files: []
}

export default function Cctv() {
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
  const { canCreate, canUpdate, canDelete } = usePermissions('cctv')
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
    
    let matchesFilter = true
    
    let matchesDate = true
    if (dateRange.start && dateRange.end) {
      const dateStr = item.date_start || item.created_at
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
      title: 'CCTV Records Report',
      subtitle: `${filteredRecords.length} records`,
      columns: [
        { header: 'Report Title', key: 'report_title' },
        { header: 'Date Covered', key: 'date_start', format: (v, rec) => {
          const start = v ? format(new Date(v), 'MMM dd, yyyy') : '—'
          const end = rec.date_end ? format(new Date(rec.date_end), 'MMM dd, yyyy') : null
          return end ? `${start} – ${end}` : start
        }},
        { header: 'Prepared By', key: 'prepared_by' },
      ],
      records: filteredRecords,
    })
  }

  const loadRecords = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('cctv_documentations')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Error loading CCTV reports:', err)
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

    setFormData({
      ...INITIAL_FORM_STATE,
      record_id: `CCTV-REP-${year}-${rand}`
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
      report_title: rec.report_title || '',
      date_start: rec.date_start || '',
      date_end: rec.date_end || '',
      operator: rec.operator || '',
      asst_operator: rec.asst_operator || '',
      client_name: rec.client_name || '',
      client_contact: rec.client_contact || '',
      client_address: rec.client_address || '',
      exact_place: rec.exact_place || '',
      nature_of_incident: rec.nature_of_incident || '',
      time_of_incident: rec.time_of_incident || '',
      others: rec.others || '',
      prepared_by: rec.prepared_by || '',
      summary: rec.summary || '',
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
            const path = `cctv-files/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            const url = await uploadFile('cctv-files', path, file)
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
          .from('cctv_documentations')
          .update(payload)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setRecords(filteredRecords.map(rec => rec.id === selectedId ? data[0] : rec))
        await logAudit('Updated', 'CCTV Report', formData.record_id || formData.id || selectedId, 'Updated report details')
        toast.success('CCTV report updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('cctv_documentations')
          .insert([payload])
          .select()

        if (error) throw error
        setRecords([data[0], ...records])
        await logAudit('Added', 'CCTV Report', formData.record_id || data[0].record_id || data[0].id, 'Created new report')
        toast.success('CCTV report added successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving CCTV report:', err)
      toast.error('Error saving record: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This CCTV report will be permanently removed. This action cannot be undone.', { title: 'Delete Report' })
    if (!ok) return

    try {
      const recordToDelete = records.find(item => item.id === id)
      if (recordToDelete && recordToDelete.files && recordToDelete.files.length > 0) {
        const pathsToDelete = recordToDelete.files
          .map(url => {
            const idx = url.indexOf('cctv-files/')
            return idx !== -1 ? url.substring(idx) : null
          })
          .filter(Boolean)
        
        if (pathsToDelete.length > 0) {
          await deleteFiles('cctv-files', pathsToDelete)
        }
      }

      const { error } = await supabase
        .from('cctv_documentations')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setRecords(records.filter(rec => rec.id !== id))
      await logAudit('Deleted', 'CCTV Report', id, 'Deleted report')
      toast.success('CCTV report deleted successfully!')
    } catch (err) {
      console.error('Error deleting CCTV report:', err)
      toast.error('Failed to delete report: ' + err.message)
    }
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
    if (['mp4', 'avi', 'mov', 'mkv'].includes(ext)) return 'ri-video-line';
    return 'ri-file-text-line';
  }

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading CCTV reports...</p>
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
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading CCTV Reports</h3>
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
          <i className="ri-vidicon-line" style={{ marginRight: '12px' }}></i>
          Command Center CCTV
        </h2>
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: (isAdmin || canCreate) ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Log Weekly Report
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
          hasActiveFilters={hasActiveFilters}
        />
      )}

      {records.length === 0 ? (
        <div className="empty-state">
          <i className="ri-vidicon-line"></i>
          <h3>No CCTV Reports</h3>
          <p>Click "Log Weekly Report" to log your first documentation.</p>
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
                <th>Report Title</th>
                <th>Date Covered</th>
                <th>Prepared By</th>
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
                  <td style={{ fontWeight: '700' }}>{record.report_title || '-'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                    {record.date_start ? format(new Date(record.date_start), 'MMM dd, yyyy') : '-'}
                    {' - '}
                    {record.date_end ? format(new Date(record.date_end), 'MMM dd, yyyy') : '-'}
                  </td>
                  <td>{record.prepared_by || '-'}</td>
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
              <TableGhostRows count={pageSize - pagedRecords.length} colSpan={5} />
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
        filename="cctv_reports.xlsx"
        sheetName="CCTV"
        dateField="date_start"
        onSuccess={(count) => toast.success(`Exported ${count} records successfully.`)}
        onError={(msg) => toast.error(msg)}
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isViewing ? 'View Details' : (isEditing ? 'Edit CCTV Report' : 'Log Weekly Report')}
        maxWidth="1000px"
      >
        <style>{`
          .cctv-form-layout {
            display: flex;
            flex-wrap: wrap;
            gap: 32px;
          }
          .cctv-details-col {
            flex: 1 1 450px;
            min-width: 0;
          }
          .cctv-files-col {
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
            .cctv-form-layout {
              flex-direction: column;
              gap: 24px;
            }
            .cctv-files-col {
              border-left: none;
              padding-left: 0;
              border-top: 2px solid var(--border-light);
              padding-top: 24px;
            }
          }
        `}</style>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="cctv-form-layout">
            <div className="cctv-details-col">
              <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-row">
                    
                    <div className="form-group">
                      <label>Report Title *</label>
                      <input 
                        type="text" 
                        name="report_title" 
                        value={formData.report_title} 
                        onChange={handleInputChange} 
                        required 
                        placeholder="e.g. CCTV Report: Week 1 of January"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Date Covered (Start) *</label>
                      <input 
                        max={new Date().toISOString().split('T')[0]} type="date" 
                        name="date_start" 
                        value={formData.date_start} 
                        onChange={handleInputChange} 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Date Covered (End) *</label>
                      <input 
                        max={new Date().toISOString().split('T')[0]} type="date" 
                        name="date_end" 
                        value={formData.date_end} 
                        min={formData.date_start || undefined}
                        onChange={handleInputChange} 
                        required 
                      />
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>Operator</label>
                      <input type="text" name="operator" value={formData.operator} onChange={handleInputChange} placeholder="e.g. Officer Juan Dela Cruz" />
                    </div>
                    <div className="form-group">
                      <label>Asst. Operator</label>
                      <input type="text" name="asst_operator" value={formData.asst_operator} onChange={handleInputChange} placeholder="e.g. Officer Maria Santos" />
                    </div>
                  </div>

                  <div style={{ borderTop: '2px solid var(--border-light)', marginTop: '4px', paddingTop: '14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--primary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <i className="ri-cctv-line" style={{ marginRight: '6px' }}></i>Incident Details
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Client's Name</label>
                        <input type="text" name="client_name" value={formData.client_name} onChange={handleInputChange} placeholder="e.g. Juan Dela Cruz" />
                      </div>
                      <div className="form-group">
                        <label>Contact No.</label>
                        <input type="text" name="client_contact" value={formData.client_contact} onChange={handleInputChange} placeholder="e.g. 09123456789" />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Client's Address</label>
                      <input type="text" name="client_address" value={formData.client_address} onChange={handleInputChange} placeholder="e.g. Brgy. Singasina, Palayan City" />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Exact Place of Incident</label>
                        <input type="text" name="exact_place" value={formData.exact_place} onChange={handleInputChange} placeholder="e.g. Near Provincial Capitol" />
                      </div>
                      <div className="form-group">
                        <label>Time of Incident</label>
                        <input type="time" name="time_of_incident" value={formData.time_of_incident} onChange={handleInputChange} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Nature of Incident</label>
                      <input type="text" name="nature_of_incident" value={formData.nature_of_incident} onChange={handleInputChange} placeholder="e.g. Vehicular Accident, Theft, Missing Person" />
                    </div>
                    <div className="form-group">
                      <label>Others</label>
                      <input type="text" name="others" value={formData.others} onChange={handleInputChange} placeholder="Other notes" />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Prepared By</label>
                    <input type="text" name="prepared_by" value={formData.prepared_by} onChange={handleInputChange} placeholder="e.g. Officer Name" />
                  </div>

                  <div className="form-group">
                    <label>Summary / Remarks</label>
                    <textarea name="summary" value={formData.summary} onChange={handleInputChange} rows={4} placeholder="Detail the summary of CCTV activities for the week..." />
                  </div>
                </div>
              </fieldset>
            </div>

            <div className="cctv-files-col">
              <div style={{ minHeight: '350px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <h4 style={{ margin: '0 0 12px 0', color: 'var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Report Attachments
                  {!isViewing && (
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" 
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
                        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" 
                        onChange={handleFileUpload}
                        disabled={isUploading || isSaving}
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: isDragging ? 'copy' : 'pointer', zIndex: 10 }} 
                      />
                    )}
                    <i className="ri-file-upload-line" style={{ fontSize: '48px', color: isDragging ? 'var(--primary)' : 'var(--border-light)', transition: 'all 0.2s' }}></i>
                    <p style={{ marginTop: '12px', fontWeight: '600' }}>{isDragging ? 'Drop files here' : 'No documents attached yet.'}</p>
                    {!isViewing && <p style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>Drag and drop report documents or videos</p>}
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
  )
}
