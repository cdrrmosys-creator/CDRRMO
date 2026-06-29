import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { logAudit } from '../../services/audit'
import { format } from 'date-fns'
import Modal from '../../components/Modal'
import ModuleToolbar from '../../components/ModuleToolbar'
import ListPagination from '../../components/ListPagination'
import ExportModal from '../../components/ExportModal'
import TableGhostRows from '../../components/TableGhostRows'
import useListPagination from '../../hooks/useListPagination'
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

const DRRM_EXPORT_COLUMNS = [
  'record_id', 'timestamp', 'first_name', 'middle_name', 'last_name', 'suffix',
  'name_on_certificate', 'gender', 'contact_number', 'email_address', 'office', 'designation',
  'civil_status', 'birthdate', 'present_address', 'photo_url',
]

const DRRM_EXPORT_HEADERS = {
  record_id: 'Record ID', timestamp: 'Timestamp', first_name: 'First Name',
  middle_name: 'Middle Name', last_name: 'Last Name', suffix: 'Suffix',
  name_on_certificate: 'Name on Certificate', gender: 'Gender',
  contact_number: 'Contact Number', email_address: 'Email Address', office: 'Office',
  designation: 'Designation/Position', civil_status: 'Civil Status', birthdate: 'Birthdate',
  present_address: 'Present Address', photo_url: 'Photo URL',
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
  const [isExportOpen, setIsExportOpen] = useState(false)

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

  const { currentPage, setCurrentPage, pageSize, setPageSize, totalPages, safePage, pagedRecords } = useListPagination(filteredRecords)

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

      {records.length > 0 && (
        <ModuleToolbar
          onSearch={(v) => { setSearchTerm(v); setCurrentPage(1) }}
          onDateRangeChange={(r) => { setDateRange(r); setCurrentPage(1) }}
          searchPlaceholder="Search name, office, email…"
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          onExportClick={() => setIsExportOpen(true)}
          onClearFilters={() => { setSearchTerm(''); setDateRange({ start: '', end: '' }); setCurrentPage(1) }}
          hasActiveFilters={Boolean(searchTerm || dateRange.start || dateRange.end)}
        />
      )}

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
                <tr key={record.id} onClick={() => handleViewDetails(record)} style={{ cursor: 'pointer', height: '49px' }} className="table-row-clickable">
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
              <TableGhostRows count={Math.max(0, pageSize - pagedRecords.length)} colSpan={8} />
            </tbody>
          </table>
        </div>
      )}

      {filteredRecords.length > 0 && (
        <ListPagination
          currentPage={safePage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalRecords={filteredRecords.length}
          onPageChange={setCurrentPage}
        />
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
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        records={records}
        filename="drrm_training.xlsx"
        sheetName="DRRM Training"
        dateField="timestamp"
        columns={DRRM_EXPORT_COLUMNS}
        headers={DRRM_EXPORT_HEADERS}
        onSuccess={(count) => toast.success(`Exported ${count} records successfully.`)}
        onError={(msg) => toast.error(msg)}
      />
    </div>
  )
}
