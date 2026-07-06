import ModuleToolbar from '../../components/ModuleToolbar'
import StatusSelect from '../../components/StatusSelect'
import PhotoUploadPanel from '../../components/PhotoUploadPanel'
import useListPagination from '../../hooks/useListPagination'
import ListPagination from '../../components/ListPagination'
import ExportModal from '../../components/ExportModal'
import TableGhostRows from '../../components/TableGhostRows'
import { useState, useEffect } from 'react'
import { validateForm } from '../../utils/validation'
import { supabase } from '../../services/supabase'
import { logAudit } from '../../services/audit'
import { uploadFile, deleteFiles } from '../../services/storage'
import { compressImage } from '../../utils/imageCompression'
import { format } from 'date-fns'
import { printPDF } from '../../utils/printPDF'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'

const INITIAL_FORM_STATE = {
  record_id: '',
  volunteer_name: '',
  organization: '',
  birthdate: '',
  address: '',
  contact_no: '',
  civil_status: '',
  blood_type: '',
  emergency_contact_person: '',
  emergency_contact_no: '',
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
    const matchesFilter = !filter || item.status === filter
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
    return matchesSearch && matchesFilter && matchesDate
  })

  const [isExportOpen, setIsExportOpen] = useState(false)
  const { currentPage, setCurrentPage, pageSize, setPageSize, totalPages, safePage, pagedRecords } = useListPagination(filteredRecords)

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
      birthdate: rec.birthdate || '',
      address: rec.address || '',
      contact_no: rec.contact_no || '',
      civil_status: rec.civil_status || '',
      blood_type: rec.blood_type || '',
      emergency_contact_person: rec.emergency_contact_person || '',
      emergency_contact_no: rec.emergency_contact_no || '',
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

  const removeExistingPhoto = (idx) => setFormData(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== idx) }))
  const removePendingPhoto = (idx) => setPendingPhotos(prev => prev.filter((_, i) => i !== idx))

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Pre-submit validation
    const errors = validateForm({
      'Volunteer Name': { rule: 'name', value: formData.volunteer_name, required: true },
      'Contact No.': { rule: 'mobile', value: formData.contact_no },
      'Emergency Contact No.': { rule: 'mobile', value: formData.emergency_contact_no },
    })
    if (Object.keys(errors).length > 0) {
      Object.values(errors).forEach(msg => toast.error(msg))
      return
    }

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

  const VOLUNTEER_STATUS_OPTIONS = [
    { value: 'Active',   label: 'Active',   icon: 'ri-user-follow-fill', bg: '#d1fae5', color: '#065f46' },
    { value: 'Inactive', label: 'Inactive', icon: 'ri-user-line',         bg: '#fef3c7', color: '#92400e' },
    { value: 'Expired',  label: 'Expired',  icon: 'ri-user-unfollow-fill',bg: '#fee2e2', color: '#991b1b' },
  ]

  const handleStatusChange = async (id, newStatus) => {
    try {
      const { error } = await supabase.from('volunteers').update({ status: newStatus }).eq('id', id)
      if (error) throw error
      setRecords(records.map(r => r.id === id ? { ...r, status: newStatus } : r))
    } catch (err) {
      toast.error('Failed to update status: ' + err.message)
    }
  }

  const handlePrintPDF = () => {
    printPDF({
      title: 'Volunteers Registry Report',
      subtitle: `${filteredRecords.length} volunteers`,
      columns: [
        { header: 'Name', key: 'volunteer_name' },
        { header: 'Organization', key: 'organization' },
        { header: 'Accreditation No.', key: 'accreditation_no' },
        { header: 'Date Registered', key: 'date', format: v => v ? format(new Date(v), 'MMM dd, yyyy') : '—' },
        { header: 'Status', key: 'status' },
      ],
      records: filteredRecords,
    })
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
          onSearch={(v) => { setSearchTerm(v); setCurrentPage(1) }}
          onFilterChange={(v) => { setFilter(v); setCurrentPage(1) }}
          onDateRangeChange={(r) => { setDateRange(r); setCurrentPage(1) }}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          onExportClick={() => setIsExportOpen(true)}
          onPrintClick={handlePrintPDF}
          onClearFilters={() => { setSearchTerm(''); setFilter(''); setDateRange({ start: '', end: '' }); setCurrentPage(1) }}
                    filterLabel="All Status"
          filterOptions={[
            { label: 'Active', value: 'Active' },
            { label: 'Inactive', value: 'Inactive' },
            { label: 'Expired', value: 'Expired' },
          ]}
          filterColorMap={{
            'Active': { bg: '#d1fae5', color: '#065f46', icon: 'ri-user-follow-line' },
            'Inactive': { bg: '#fef3c7', color: '#92400e', icon: 'ri-user-line' },
            'Expired': { bg: '#fee2e2', color: '#991b1b', icon: 'ri-user-unfollow-line' },
          }}

          hasActiveFilters={Boolean(searchTerm || filter || dateRange.start || dateRange.end)}
        />
      )}

      {records.length === 0 ? (
        <div className="empty-state">
          <i className="ri-user-star-line"></i>
          <h3>No Volunteers Registered</h3>
          <p>Click "Register Volunteer" to add your first volunteer.</p>
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
                <th>Volunteer Name</th>
                <th>Organization</th>
                <th>Accreditation No.</th>
                <th>Date Registered</th>
                <th>Insurance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pagedRecords.map((record) => (
                <tr key={record.id} onClick={() => handleViewDetails(record)} style={{ cursor: 'pointer', height: '49px' }} className="table-row-clickable">
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
                  <td onClick={e => (isAdmin || canUpdate) ? e.stopPropagation() : undefined}>
                    {(isAdmin || canUpdate)
                      ? <StatusSelect
                          value={record.status || 'Active'}
                          options={VOLUNTEER_STATUS_OPTIONS}
                          onChange={v => handleStatusChange(record.id, v)}
                        />
                      : getStatusBadge(record.status)
                    }
                  </td>
                </tr>
              ))}
              <TableGhostRows count={Math.max(0, pageSize - pagedRecords.length)} colSpan={7} />
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
        filename="volunteers_report.xlsx"
        sheetName="Volunteers"
        dateField="date"
        onSuccess={(count) => toast.success(`Exported ${count} records successfully.`)}
        onError={(msg) => toast.error(msg)}
      />

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
                      <label>Volunteer Name *</label>
                      <input type="text" name="volunteer_name" value={formData.volunteer_name} onChange={handleInputChange} required placeholder="e.g. Juan dela Cruz" />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Group / Organization</label>
                      <input type="text" name="organization" value={formData.organization} onChange={handleInputChange} placeholder="e.g. Red Cross Youth, React Ph" />
                    </div>
                    <div className="form-group">
                      <label>Accreditation No. *</label>
                      <input type="text" name="accreditation_no" value={formData.accreditation_no} onChange={handleInputChange} required placeholder="e.g. ACC-2026-0045" />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Birthdate</label>
                      <input max={new Date().toISOString().split('T')[0]} type="date" name="birthdate" value={formData.birthdate} onChange={handleInputChange} />
                    </div>
                    <div className="form-group">
                      <label>Civil Status</label>
                      <select name="civil_status" value={formData.civil_status} onChange={handleInputChange}>
                        <option value="">-- Select --</option>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="Widowed">Widowed</option>
                        <option value="Separated">Separated</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Contact No.</label>
                      <input type="text" name="contact_no" value={formData.contact_no} onChange={handleInputChange} placeholder="e.g. 09123456789" />
                    </div>
                    <div className="form-group">
                      <label>Blood Type</label>
                      <select name="blood_type" value={formData.blood_type} onChange={handleInputChange}>
                        <option value="">-- Select --</option>
                        <option value="A+">A+</option><option value="A-">A-</option>
                        <option value="B+">B+</option><option value="B-">B-</option>
                        <option value="AB+">AB+</option><option value="AB-">AB-</option>
                        <option value="O+">O+</option><option value="O-">O-</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Address</label>
                    <input type="text" name="address" value={formData.address} onChange={handleInputChange} placeholder="e.g. Brgy. Singasina, Palayan City, Nueva Ecija" />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Emergency Contact Person</label>
                      <input type="text" name="emergency_contact_person" value={formData.emergency_contact_person} onChange={handleInputChange} placeholder="e.g. Maria dela Cruz" />
                    </div>
                    <div className="form-group">
                      <label>Emergency Contact No.</label>
                      <input type="text" name="emergency_contact_no" value={formData.emergency_contact_no} onChange={handleInputChange} placeholder="e.g. 09987654321" />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Date Registered</label>
                      <input max={new Date().toISOString().split('T')[0]} type="date" name="date" value={formData.date} onChange={handleInputChange} />
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
                    background: formData.with_insurance ? 'var(--primary-bg)' : 'var(--bg-app)',
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
              <PhotoUploadPanel
                title="Volunteer Photo"
                emptyMessage="No photo uploaded for this volunteer yet."
                photos={formData.photos}
                pendingPhotos={pendingPhotos}
                isViewing={isViewing}
                isUploading={isUploading}
                isSaving={isSaving}
                onFileUpload={handleFileUpload}
                onRemoveExisting={removeExistingPhoto}
                onRemovePending={removePendingPhoto}
                minHeight="300px"
                addButtonLabel="Add Photo"
              />
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
