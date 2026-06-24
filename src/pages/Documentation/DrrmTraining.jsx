import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { logAudit } from '../../services/audit'
import { format } from 'date-fns'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'

const GENDER_OPTIONS = ['Male', 'Female', 'Prefer not to say']
const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Separated', 'Widowed', "It's Complicated"]

const INITIAL_FORM_STATE = {
  record_id: '',
  timestamp: '',
  first_name: '',
  middle_name: '',
  last_name: '',
  suffix: '',
  name_on_certificate: '',
  gender: '',
  contact_number: '',
  email_address: '',
  office: '',
  designation: '',
  civil_status: '',
  birthdate: '',
  present_address: '',
  photo_url: '',
}

export default function DrrmTraining() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isViewing, setIsViewing] = useState(false)
  const [formData, setFormData] = useState(INITIAL_FORM_STATE)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const isAdmin = useIsAdmin()
  const { canCreate, canUpdate, canDelete } = usePermissions('documentation')
  const toast = useToast()
  const confirm = useConfirm()

  const [searchTerm, setSearchTerm] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Export modal state
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')

  useEffect(() => { loadRecords() }, [])

  const filteredRecords = records.filter(item => {
    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      const haystack = [
        item.first_name, item.middle_name, item.last_name, item.suffix,
        item.email_address, item.office, item.designation, item.present_address
      ].join(' ').toLowerCase()
      if (!haystack.includes(lower)) return false
    }
    if (dateRange.start && dateRange.end) {
      const d = new Date(item.birthdate || item.timestamp || item.created_at || 0)
      const start = new Date(dateRange.start)
      const end = new Date(dateRange.end); end.setHours(23, 59, 59, 999)
      if (d < start || d > end) return false
    }
    return true
  })

  const loadRecords = async () => {
    try {
      setLoading(true); setError(null)
      const { data, error } = await supabase
        .from('drrm_office_training')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setRecords(data || [])
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  const handleViewDetails = (rec) => { handleOpenEdit(rec); setIsViewing(true) }
  const handleEditFromView = (e) => { e.preventDefault(); e.stopPropagation(); setIsViewing(false) }
  const handleDeleteFromView = async () => { const id = selectedId; setIsModalOpen(false); await handleDelete(id) }

  const handleOpenAdd = () => {
    setIsEditing(false); setIsViewing(false); setSelectedId(null)
    const year = new Date().getFullYear()
    const rand = Math.floor(1000 + Math.random() * 9000)
    setFormData({ ...INITIAL_FORM_STATE, record_id: `DRT-${year}-${rand}`, timestamp: new Date().toISOString() })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (rec) => {
    setIsEditing(true); setIsViewing(false); setSelectedId(rec.id)
    const rawSuffix = (rec.suffix || '').trim()
    const cleanSuffix = JUNK_SUFFIXES.has(rawSuffix.toLowerCase()) ? 'N/A' : rawSuffix
    setFormData({
      record_id:           rec.record_id || '',
      timestamp:           rec.timestamp || '',
      first_name:          rec.first_name || '',
      middle_name:         rec.middle_name || '',
      last_name:           rec.last_name || '',
      suffix:              cleanSuffix,
      name_on_certificate: rec.name_on_certificate || '',
      gender:              rec.gender || '',
      contact_number:      rec.contact_number || '',
      email_address:       rec.email_address || '',
      office:              rec.office || '',
      designation:         rec.designation || '',
      civil_status:        rec.civil_status || '',
      birthdate:           rec.birthdate || '',
      present_address:     rec.present_address || '',
      photo_url:           rec.photo_url || '',
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
        birthdate: formData.birthdate || null,
        timestamp: formData.timestamp || new Date().toISOString(),
      }
      if (isEditing) {
        const { data, error } = await supabase.from('drrm_office_training').update(payload).eq('id', selectedId).select()
        if (error) throw error
        setRecords(records.map(r => r.id === selectedId ? data[0] : r))
        await logAudit('Updated', 'DrrmTraining', formData.record_id || selectedId, 'Updated DRRM training registration')
        toast.success('Record updated successfully!')
      } else {
        const { data, error } = await supabase.from('drrm_office_training').insert([payload]).select()
        if (error) throw error
        setRecords([data[0], ...records])
        await logAudit('Added', 'DrrmTraining', data[0].record_id || data[0].id, 'New DRRM training registration')
        toast.success('Record added successfully!')
      }
      setIsModalOpen(false)
    } catch (err) { toast.error('Error saving record: ' + err.message) }
    finally { setIsSaving(false) }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This record will be permanently removed. This action cannot be undone.', { title: 'Delete Record' })
    if (!ok) return
    try {
      const { error } = await supabase.from('drrm_office_training').delete().eq('id', id)
      if (error) throw error
      setRecords(records.filter(r => r.id !== id))
      await logAudit('Deleted', 'DrrmTraining', id, 'Deleted DRRM training registration')
      toast.success('Record deleted successfully!')
    } catch (err) { toast.error('Failed to delete: ' + err.message) }
  }

  // Suffixes that should not appear in the displayed name
  const JUNK_SUFFIXES = new Set(['n/a', 'na', 'none', 'no', '-', '.', ''])
  const fullName = (r) => {
    const suffix = (r.suffix || '').trim()
    const validSuffix = !JUNK_SUFFIXES.has(suffix.toLowerCase()) ? suffix : ''
    return [r.first_name, r.middle_name, r.last_name, validSuffix].filter(Boolean).join(' ')
  }

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const pagedRecords = filteredRecords.slice((safePage - 1) * pageSize, safePage * pageSize)

  const exportPreviewRows = records.filter(item => {
    if (!exportFrom && !exportTo) return true
    const d = new Date(item.timestamp || item.created_at || 0)
    if (exportFrom && d < new Date(exportFrom)) return false
    if (exportTo) { const e = new Date(exportTo); e.setHours(23,59,59,999); if (d > e) return false }
    return true
  })

  const handleExport = () => {
    if (!window.XLSX) { toast.error('Export library not loaded.'); return }
    if (exportPreviewRows.length === 0) { toast.error('No records in selected range.'); return }
    const COLS = ['record_id','timestamp','first_name','middle_name','last_name','suffix',
      'name_on_certificate','gender','contact_number','email_address','office','designation',
      'civil_status','birthdate','present_address','photo_url']
    const HDRS = { record_id:'Record ID', timestamp:'Timestamp', first_name:'First Name',
      middle_name:'Middle Name', last_name:'Last Name', suffix:'Suffix',
      name_on_certificate:'Name on Certificate', gender:'Gender',
      contact_number:'Contact Number', email_address:'Email Address', office:'Office',
      designation:'Designation/Position', civil_status:'Civil Status', birthdate:'Birthdate',
      present_address:'Present Address', photo_url:'Photo URL' }
    const rows = exportPreviewRows.map(r => {
      const row = {}
      COLS.forEach(c => { row[HDRS[c]] = r[c] ?? '' })
      return row
    })
    const ws = window.XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = COLS.map(c => ({ wch: Math.max(HDRS[c].length + 2, 14) }))
    const wb = window.XLSX.utils.book_new()
    window.XLSX.utils.book_append_sheet(wb, ws, 'DRRM Training')
    window.XLSX.writeFile(wb, `drrm_training_${exportFrom||'all'}_to_${exportTo||'all'}.xlsx`)
    setIsExportOpen(false)
    toast.success(`Exported ${exportPreviewRows.length} records.`)
  }

  const getGenderBadge = (g) => {
    const map = { Male: { bg: '#dbeafe', color: '#1e40af' }, Female: { bg: '#fce7f3', color: '#9d174d' }, 'Prefer not to say': { bg: '#f3f4f6', color: '#374151' } }
    const s = map[g] || { bg: '#f3f4f6', color: '#374151' }
    return <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', background: s.bg, color: s.color }}>{g || '-'}</span>
  }

  if (loading) return <div className="loading-container"><i className="ri-loader-4-line loading-spinner"></i><p>Loading records...</p></div>
  if (error) return (
    <div style={{ padding: '32px', textAlign: 'center' }}>
      <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: '24px', color: '#991b1b', maxWidth: '500px', margin: '0 auto' }}>
        <p>{error}</p>
        <button onClick={loadRecords} style={{ marginTop: '16px', padding: '10px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}>Try Again</button>
      </div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h2><i className="ri-award-line" style={{ marginRight: '12px' }}></i>DRRM Office Training</h2>
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: (isAdmin || canCreate) ? '' : 'none' }}>
          <i className="ri-add-line"></i> Add Record
        </button>
      </div>

      {/* Filters bar */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '160px' }}>
          <i className="ri-search-line" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '15px', pointerEvents: 'none' }} />
          <input type="text" placeholder="Search name, office, email…" value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1) }}
            style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontSize: '13px', boxSizing: 'border-box' }} />
        </div>

        {/* Gender filter */}
        
        {/* Date range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input type="date" value={dateRange.start} onChange={e => { setDateRange(p => ({ ...p, start: e.target.value })); setCurrentPage(1) }}
            style={{ padding: '7px 8px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontSize: '13px' }} />
          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>–</span>
          <input type="date" value={dateRange.end} onChange={e => { setDateRange(p => ({ ...p, end: e.target.value })); setCurrentPage(1) }}
            style={{ padding: '7px 8px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontSize: '13px' }} />
        </div>

        {/* Clear */}
        {(searchTerm || dateRange.start || dateRange.end) && (
          <button onClick={() => { setSearchTerm(''); setDateRange({ start: '', end: '' }); setCurrentPage(1) }}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <i className="ri-close-line" /> Clear
          </button>
        )}

        {/* Page size + Export */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Show</span>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontSize: '13px', cursor: 'pointer' }}>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>per page</span>
          <div style={{ width: '1px', height: '20px', background: 'var(--border-light)' }} />
          <button onClick={() => { setExportFrom(''); setExportTo(''); setIsExportOpen(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', background: '#16a34a', color: '#fff', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
            <i className="ri-file-excel-2-line" style={{ fontSize: '15px' }} /> Export XLSX
          </button>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="empty-state">
          <i className="ri-award-line"></i>
          <h3>No Records Yet</h3>
          <p>Click "Add Record" to register a DRRM Office Training participant.</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="empty-state"><i className="ri-filter-off-line"></i><h3>No Matching Records</h3><p>Try adjusting your search or filters.</p></div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Timestamp</th>
                <th>Full Name</th>
                <th>Gender</th>
                <th>Contact No.</th>
                <th>Office</th>
                <th>Designation</th>
                <th>Civil Status</th>
              </tr>
            </thead>
            <tbody>
              {pagedRecords.map(record => (
                <tr key={record.id} onClick={() => handleViewDetails(record)} style={{ cursor: 'pointer' }} className="table-row-clickable">
                  <td><code style={{ fontWeight: '700' }}>{record.record_id || '-'}</code></td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '13px', color: 'var(--text-muted)' }}>
                    {record.timestamp ? format(new Date(record.timestamp), 'MMM dd, yyyy') : '-'}
                  </td>
                  <td style={{ fontWeight: '700', textTransform: 'uppercase' }}>{fullName(record) || '-'}</td>
                  <td>{getGenderBadge(record.gender)}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{record.contact_number || '-'}</td>
                  <td style={{ fontSize: '13px' }}>{record.office || '-'}</td>
                  <td style={{ fontSize: '13px', textTransform: 'uppercase' }}>{record.designation || '-'}</td>
                  <td style={{ fontSize: '13px' }}>{record.civil_status || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {filteredRecords.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Showing <strong>{(safePage - 1) * pageSize + 1}</strong>–<strong>{Math.min(safePage * pageSize, filteredRecords.length)}</strong> of <strong>{filteredRecords.length}</strong> records
          </span>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <button onClick={() => setCurrentPage(1)} disabled={safePage === 1}
              style={{ padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', cursor: safePage === 1 ? 'not-allowed' : 'pointer', opacity: safePage === 1 ? 0.4 : 1, fontSize: '14px' }}>
              <i className="ri-skip-back-line" /></button>
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
              style={{ padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', cursor: safePage === 1 ? 'not-allowed' : 'pointer', opacity: safePage === 1 ? 0.4 : 1, fontSize: '14px' }}>
              <i className="ri-arrow-left-s-line" /></button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx-1] > 1) acc.push('...'); acc.push(p); return acc }, [])
              .map((item, idx) => item === '...'
                ? <span key={`e${idx}`} style={{ padding: '0 4px', color: 'var(--text-muted)', fontSize: '13px' }}>…</span>
                : <button key={item} onClick={() => setCurrentPage(item)} style={{ padding: '6px 11px', borderRadius: '7px', fontSize: '13px', fontWeight: '700', border: `1px solid ${safePage === item ? 'var(--primary)' : 'var(--border-light)'}`, background: safePage === item ? 'var(--primary)' : 'var(--bg-surface)', color: safePage === item ? '#fff' : 'var(--text)', cursor: 'pointer' }}>{item}</button>
              )}
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
              style={{ padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', cursor: safePage === totalPages ? 'not-allowed' : 'pointer', opacity: safePage === totalPages ? 0.4 : 1, fontSize: '14px' }}>
              <i className="ri-arrow-right-s-line" /></button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={safePage === totalPages}
              style={{ padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', cursor: safePage === totalPages ? 'not-allowed' : 'pointer', opacity: safePage === totalPages ? 0.4 : 1, fontSize: '14px' }}>
              <i className="ri-skip-forward-line" /></button>
          </div>
        </div>
      )}

      {/* Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        title={isViewing ? 'View Record' : (isEditing ? 'Edit Record' : 'Add DRRM Training Record')}
        maxWidth="860px">
        <form onSubmit={handleSubmit} className="modal-form">
          <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Record ID + Timestamp */}
              <div className="form-row" style={{ gap: '12px' }}>
                <div className="form-group">
                  <label>Record ID</label>
                  <input type="text" name="record_id" value={formData.record_id} disabled
                    style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280' }} />
                </div>
                <div className="form-group">
                  <label>Timestamp</label>
                  <input type="datetime-local" name="timestamp"
                    value={formData.timestamp ? formData.timestamp.slice(0, 16) : ''}
                    onChange={handleInputChange} style={{ padding: '6px' }} />
                </div>
              </div>

              {/* Name row */}
              <div className="form-row" style={{ gap: '12px' }}>
                <div className="form-group" style={{ flex: 2 }}>
                  <label>First Name *</label>
                  <input type="text" name="first_name" value={formData.first_name} onChange={handleInputChange} required placeholder="e.g. Juan" />
                </div>
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Middle Name</label>
                  <input type="text" name="middle_name" value={formData.middle_name} onChange={handleInputChange} placeholder="e.g. Santos" />
                </div>
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Last Name *</label>
                  <input type="text" name="last_name" value={formData.last_name} onChange={handleInputChange} required placeholder="e.g. dela Cruz" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Suffix</label>
                  <input type="text" name="suffix" value={formData.suffix} onChange={handleInputChange} placeholder="Jr., Sr., II…" />
                </div>
              </div>

              {/* Certificate name */}
              <div className="form-group">
                <label>Name to be Printed on Certificate *</label>
                <input type="text" name="name_on_certificate" value={formData.name_on_certificate} onChange={handleInputChange} required
                  placeholder="Full name exactly as it should appear on certificate" />
              </div>

              {/* Gender + Civil Status + Birthdate */}
              <div className="form-row" style={{ gap: '12px' }}>
                <div className="form-group">
                  <label>Gender *</label>
                  <select name="gender" value={formData.gender} onChange={handleInputChange} required>
                    <option value="">-- Select --</option>
                    {/* Include the current value if it's not in the predefined list (e.g. from Google Sheets) */}
                    {formData.gender && !GENDER_OPTIONS.includes(formData.gender) && (
                      <option value={formData.gender}>{formData.gender}</option>
                    )}
                    {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Civil Status *</label>
                  <select name="civil_status" value={formData.civil_status} onChange={handleInputChange} required>
                    <option value="">-- Select --</option>
                    {CIVIL_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Birthdate *</label>
                  <input type="date" name="birthdate" value={formData.birthdate} onChange={handleInputChange} required />
                </div>
              </div>

              {/* Contact + Email */}
              <div className="form-row" style={{ gap: '12px' }}>
                <div className="form-group">
                  <label>Contact Number *</label>
                  <input type="tel" name="contact_number" value={formData.contact_number} onChange={handleInputChange} required placeholder="e.g. 09171234567" />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input type="email" name="email_address" value={formData.email_address} onChange={handleInputChange} placeholder="e.g. juan@email.com" />
                </div>
              </div>

              {/* Office + Designation */}
              <div className="form-row" style={{ gap: '12px' }}>
                <div className="form-group">
                  <label>Office</label>
                  <input type="text" name="office" value={formData.office} onChange={handleInputChange} placeholder="e.g. Palayan City DRRMO" />
                </div>
                <div className="form-group">
                  <label>Designation / Position</label>
                  <input type="text" name="designation" value={formData.designation} onChange={handleInputChange} placeholder="e.g. Admin Officer II" />
                </div>
              </div>

              {/* Address */}
              <div className="form-group">
                <label>Present Address *</label>
                <input type="text" name="present_address" value={formData.present_address} onChange={handleInputChange} required
                  placeholder="e.g. Brgy. Ganaderia, Palayan City, Nueva Ecija" />
              </div>

              {/* Photo URL */}
              <div className="form-group">
                <label>2x2 / Passport Size Photo URL</label>
                <input type="url" name="photo_url" value={formData.photo_url} onChange={handleInputChange}
                  placeholder="Paste Google Drive or image link here" />
                {formData.photo_url && isViewing && (
                  <div style={{ marginTop: '10px' }}>
                    <a href={formData.photo_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--primary)', fontWeight: '600' }}>
                      <i className="ri-external-link-line" /> View Photo
                    </a>
                  </div>
                )}
              </div>

            </div>
          </fieldset>

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
            <div></div>
            {isViewing ? (
              <div style={{ display: 'flex', gap: '12px' }}>
                {(isAdmin || canDelete) && (
                  <button type="button" onClick={handleDeleteFromView}
                    style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <i className="ri-delete-bin-line" style={{ marginRight: '6px' }}></i> Delete
                  </button>
                )}
                {(isAdmin || canUpdate) && (
                  <button type="button" className="btn-edit" onClick={handleEditFromView}
                    style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
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
                <button type="submit" className="btn-submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</button>
              </div>
            )}
          </div>
        </form>
      </Modal>
      {/* Export Modal */}
      {isExportOpen && (
        <div onClick={e => { if (e.target === e.currentTarget) setIsExportOpen(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', width: '100%', maxWidth: '460px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ri-file-excel-2-line" style={{ fontSize: '20px', color: '#16a34a' }} />
                </div>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '16px' }}>Export to Excel</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>drrm_training.xlsx</div>
                </div>
              </div>
              <button onClick={() => setIsExportOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '20px', padding: '4px' }}>
                <i className="ri-close-line" /></button>
            </div>
            <div style={{ padding: '24px' }}>
              <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                Select a date range to filter which records to export. Leave both empty to export all.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>From</label>
                  <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)}
                    style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-app)', fontSize: '13px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>To</label>
                  <input type="date" value={exportTo} min={exportFrom || undefined} onChange={e => setExportTo(e.target.value)}
                    style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-app)', fontSize: '13px', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '10px', background: exportPreviewRows.length > 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${exportPreviewRows.length > 0 ? '#bbf7d0' : '#fecaca'}`, marginBottom: '24px' }}>
                <i className={exportPreviewRows.length > 0 ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'} style={{ fontSize: '22px', color: exportPreviewRows.length > 0 ? '#16a34a' : '#dc2626', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: '800', fontSize: '15px', color: exportPreviewRows.length > 0 ? '#15803d' : '#b91c1c' }}>
                    {exportPreviewRows.length} {exportPreviewRows.length === 1 ? 'record' : 'records'} will be exported
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {exportFrom && exportTo ? `${format(new Date(exportFrom),'MMM dd, yyyy')} – ${format(new Date(exportTo),'MMM dd, yyyy')}`
                      : exportFrom ? `From ${format(new Date(exportFrom),'MMM dd, yyyy')} onwards`
                      : exportTo ? `Up to ${format(new Date(exportTo),'MMM dd, yyyy')}`
                      : 'All dates — no filter applied'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setIsExportOpen(false)} style={{ padding: '9px 20px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-app)', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleExport} disabled={exportPreviewRows.length === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 22px', borderRadius: '8px', background: exportPreviewRows.length > 0 ? '#16a34a' : '#9ca3af', color: '#fff', border: 'none', fontSize: '13px', fontWeight: '700', cursor: exportPreviewRows.length > 0 ? 'pointer' : 'not-allowed' }}>
                  <i className="ri-download-2-line" /> Download XLSX
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
