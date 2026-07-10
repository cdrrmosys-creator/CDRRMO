import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../services/supabase'
import { uploadFile } from '../../services/storage'
import { logAudit } from '../../services/audit'
import { format } from 'date-fns'
import { printPDF } from '../../utils/printPDF'
import { validateForm } from '../../utils/validation'
import Modal from '../../components/Modal'
import ModuleToolbar from '../../components/ModuleToolbar'
import ListPagination from '../../components/ListPagination'
import ExportModal from '../../components/ExportModal'
import TableGhostRows from '../../components/TableGhostRows'
import StatusSelect from '../../components/StatusSelect'
import useListPagination from '../../hooks/useListPagination'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'

const INITIAL_FORM_STATE = {
  record_id: '',
  borrower_name: '',
  office: '',
  address: '',
  date_released: '',
  date_returned: '',
  contact_no: '',
  item_type: '',
  quantity: 1,
  item_condition: 'Good',
  return_condition: '',
  return_photo_url: '',
  person_in_charge: '',
  status: 'Pending',
  created_by: '',
  updated_by: '',
  created_at: '',
  updated_at: ''
}

const ITEM_CONDITIONS = ['Good', 'Fair', 'Bad', 'New', 'Damaged']
const RETURN_CONDITIONS = ['Good', 'Fair', 'Bad', 'Lost / Missing', 'Damaged']

const STATUS_OPTIONS = [
  { value: 'Pending',   label: 'Pending',   icon: 'ri-time-line',            bg: '#fef3c7', color: '#92400e' },
  { value: 'Completed', label: 'Completed', icon: 'ri-checkbox-circle-line', bg: '#d1fae5', color: '#065f46' }
]

export default function Logistic() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isViewing, setIsViewing] = useState(false)
  const [formData, setFormData] = useState(INITIAL_FORM_STATE)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  // Photo upload states
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const photoInputRef = useRef(null)

  const isAdmin = useIsAdmin()
  const { canCreate, canUpdate, canDelete } = usePermissions('logistic')
  const toast = useToast()
  const confirm = useConfirm()

  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [isExportOpen, setIsExportOpen] = useState(false)

  useEffect(() => { loadRecords() }, [])

  const loadRecords = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase.from('logistic').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Error loading logistic records:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredRecords = records.filter(item => {
    let matchesSearch = true
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      matchesSearch = (
        (item.borrower_name?.toLowerCase() || '').includes(q) ||
        (item.item_type?.toLowerCase() || '').includes(q) ||
        (item.office?.toLowerCase() || '').includes(q) ||
        (item.person_in_charge?.toLowerCase() || '').includes(q) ||
        (item.record_id?.toLowerCase() || '').includes(q)
      )
    }
    const matchesFilter = !filter || item.status === filter
    let matchesDate = true
    if (dateRange.start && dateRange.end) {
      const d = item.date_released ? new Date(item.date_released) : null
      if (d) {
        const s = new Date(dateRange.start)
        const e = new Date(dateRange.end)
        e.setHours(23,59,59,999)
        matchesDate = d >= s && d <= e
      }
    }
    return matchesSearch && matchesFilter && matchesDate
  })

  const { currentPage, setCurrentPage, pageSize, setPageSize, totalPages, safePage, pagedRecords } = useListPagination(filteredRecords)
  const hasActiveFilters = Boolean(searchTerm || filter || dateRange.start || dateRange.end)

  const handleClearFilters = () => { setSearchTerm(''); setFilter(''); setDateRange({ start: '', end: '' }); setCurrentPage(1) }

  const resetPhoto = () => { setPhotoFile(null); setPhotoPreview(null); setIsDragOver(false) }

  const populateForm = (rec) => ({
    record_id: rec.record_id || '',
    borrower_name: rec.borrower_name || '',
    office: rec.office || '',
    address: rec.address || '',
    date_released: rec.date_released || '',
    date_returned: rec.date_returned || '',
    contact_no: rec.contact_no || '',
    item_type: rec.item_type || '',
    quantity: rec.quantity || 1,
    item_condition: rec.item_condition || 'Good',
    return_condition: rec.return_condition || '',
    return_photo_url: rec.return_photo_url || '',
    person_in_charge: rec.person_in_charge || '',
    status: rec.status || 'Pending',
    created_by: rec.created_by || '',
    updated_by: rec.updated_by || '',
    created_at: rec.created_at || '',
    updated_at: rec.updated_at || ''
  })

  const handleOpenAdd = () => {
    setIsEditing(false); setIsViewing(false); setSelectedId(null); resetPhoto()
    const year = new Date().getFullYear()
    const rand = Math.floor(1000 + Math.random() * 9000)
    setFormData({ ...INITIAL_FORM_STATE, record_id: `LGT-${year}-${rand}`, date_released: new Date().toISOString().split('T')[0] })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (rec) => {
    setIsEditing(true); setIsViewing(false); setSelectedId(rec.id); resetPhoto()
    setFormData(populateForm(rec))
    setIsModalOpen(true)
  }

  const handleViewDetails = (rec) => { handleOpenEdit(rec); setIsViewing(true) }
  const handleEditFromView = (e) => { e.preventDefault(); e.stopPropagation(); setIsViewing(false) }

  const handleDeleteFromView = async () => {
    const id = selectedId
    setIsModalOpen(false)
    await handleDelete(id)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => {
      const u = { ...prev, [name]: value }
      if (name === 'date_returned' || name === 'return_condition') {
        u.status = (u.date_returned && u.return_condition) ? 'Completed' : 'Pending'
      }
      return u
    })
  }

  // Photo drag & drop
  const handlePhotoDrop = (e) => {
    e.preventDefault(); setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) { setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file)) }
    else toast.error('Please drop an image file.')
  }
  const handlePhotoSelect = (e) => {
    const file = e.target.files[0]
    if (file && file.type.startsWith('image/')) { setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file)) }
  }
  const handleRemovePhoto = () => {
    resetPhoto()
    if (photoInputRef.current) photoInputRef.current.value = ''
    setFormData(prev => ({ ...prev, return_photo_url: '' }))
  }

  const handleStatusChange = async (id, newStatus) => {
    try {
      const rec = records.find(r => r.id === id)
      if (!rec) return
      if (newStatus === 'Completed' && (!rec.date_returned || !rec.return_condition)) {
        toast.warning('Please set return date and condition before completing.')
        handleOpenEdit(rec)
        return
      }
      const patch = { status: newStatus }
      if (newStatus === 'Pending') { patch.date_returned = null; patch.return_condition = null }
      const { data, error } = await supabase.from('logistic').update(patch).eq('id', id).select()
      if (error) throw error
      setRecords(records.map(r => r.id === id ? data[0] : r))
      await logAudit('Updated', 'Logistic', rec.record_id || id, `Changed status to ${newStatus}`)
      toast.success(`Transaction marked as ${newStatus}`)
    } catch (err) {
      toast.error('Failed to change status: ' + err.message)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errors = validateForm({
      'Borrower\'s Name': { rule: 'name', value: formData.borrower_name, required: true },
      'Contact Number':   { rule: 'mobile', value: formData.contact_no },
    })
    if (Object.keys(errors).length > 0) { Object.values(errors).forEach(msg => toast.error(msg)); return }
    if (!formData.item_type) { toast.error('Item Type is required.'); return }
    setIsSaving(true)

    let photoUrl = formData.return_photo_url || ''
    if (photoFile) {
      try {
        setIsUploadingPhoto(true)
        const ext = photoFile.name.split('.').pop()
        photoUrl = await uploadFile('logistic-returns', `${formData.record_id}_${Date.now()}.${ext}`, photoFile)
      } catch (uploadErr) {
        toast.error('Photo upload failed: ' + uploadErr.message)
        setIsSaving(false); setIsUploadingPhoto(false); return
      } finally { setIsUploadingPhoto(false) }
    }

    const payload = {
      record_id: formData.record_id,
      borrower_name: formData.borrower_name,
      office: formData.office,
      address: formData.address,
      date_released: formData.date_released,
      date_returned: formData.date_returned || null,
      contact_no: formData.contact_no,
      item_type: formData.item_type,
      quantity: Number(formData.quantity) || 1,
      item_condition: formData.item_condition,
      return_condition: formData.return_condition || null,
      return_photo_url: photoUrl || null,
      person_in_charge: formData.person_in_charge,
      status: formData.status
    }

    try {
      if (isEditing) {
        const { data, error } = await supabase.from('logistic').update(payload).eq('id', selectedId).select()
        if (error) throw error
        setRecords(records.map(rec => rec.id === selectedId ? data[0] : rec))
        await logAudit('Updated', 'Logistic', formData.record_id || selectedId, 'Updated borrow/return details')
        toast.success('Record updated successfully!')
      } else {
        const { data, error } = await supabase.from('logistic').insert([payload]).select()
        if (error) throw error
        setRecords([data[0], ...records])
        await logAudit('Added', 'Logistic', data[0].record_id || data[0].id, 'Logged new borrowed item')
        toast.success('Borrowed item logged successfully!')
      }
      setIsModalOpen(false); resetPhoto()
    } catch (err) {
      toast.error('Error saving record: ' + err.message)
    } finally { setIsSaving(false) }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This borrowed item record will be permanently removed.', { title: 'Delete Record' })
    if (!ok) return
    try {
      const { error } = await supabase.from('logistic').delete().eq('id', id)
      if (error) throw error
      setRecords(records.filter(rec => rec.id !== id))
      await logAudit('Deleted', 'Logistic', id, 'Deleted borrowed item record')
      toast.success('Record deleted successfully!')
    } catch (err) { toast.error('Failed to delete: ' + err.message) }
  }

  const handlePrintPDF = () => printPDF({
    title: 'Borrowed Items Report',
    subtitle: `${filteredRecords.length} records`,
    columns: [
      { header: 'ID', key: 'record_id' },
      { header: 'Borrower', key: 'borrower_name' },
      { header: 'Office', key: 'office' },
      { header: 'Released', key: 'date_released', format: v => v ? format(new Date(v), 'MMM dd, yyyy') : '—' },
      { header: 'Returned', key: 'date_returned', format: v => v ? format(new Date(v), 'MMM dd, yyyy') : '—' },
      { header: 'Item', key: 'item_type' },
      { header: 'Qty', key: 'quantity' },
      { header: 'Status', key: 'status' },
    ],
    records: filteredRecords,
  })

  const handleMarkAsReturnedQuick = (e, rec) => {
    e.stopPropagation()
    resetPhoto()
    setFormData({ ...populateForm(rec), date_returned: new Date().toISOString().split('T')[0], return_condition: 'Good', status: 'Completed' })
    setSelectedId(rec.id); setIsEditing(true); setIsViewing(false); setIsModalOpen(true)
  }

  const totalCount = records.length
  const pendingCount = records.filter(r => r.status === 'Pending').length
  const completedCount = records.filter(r => r.status === 'Completed').length
  const isReturned = formData.status === 'Completed' || !!formData.date_returned
  const todayStr = new Date().toLocaleDateString('en-CA')

  return (
    <div className="module-container">
      <div className="module-header">
        <div>
          <h1 className="module-title">
            <i className="ri-shopping-bag-line" style={{ marginRight: '10px', color: 'var(--primary)' }}></i>
            Logistic (Borrowed Items)
          </h1>
          <p className="module-subtitle">Track borrowed items, release dates, and return status</p>
        </div>
        {(isAdmin || canCreate) && (
          <button className="btn-add" onClick={handleOpenAdd}>
            <i className="ri-add-line"></i> Log Borrowed Item
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { label: 'Total Records', value: totalCount, icon: 'ri-file-list-3-line', color: '#3b82f6', bg: '#dbeafe' },
          { label: 'Pending (Not Returned)', value: pendingCount, icon: 'ri-time-line', color: '#d97706', bg: '#fef3c7' },
          { label: 'Completed (Returned)', value: completedCount, icon: 'ri-checkbox-circle-line', color: '#059669', bg: '#d1fae5' },
        ].map(card => (
          <div key={card.label} style={{ flex: '1 1 160px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className={card.icon} style={{ fontSize: '20px', color: card.color }}></i>
            </div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text)' }}>{card.value}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      <ModuleToolbar
        searchTerm={searchTerm}
        onSearchChange={v => { setSearchTerm(v); setCurrentPage(1) }}
        filter={filter}
        onFilterChange={v => { setFilter(v); setCurrentPage(1) }}
        onDateRangeChange={r => { setDateRange(r); setCurrentPage(1) }}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        onExportClick={() => setIsExportOpen(true)}
        onPrintClick={handlePrintPDF}
        onClearFilters={handleClearFilters}
        filterLabel="All Statuses"
        filterOptions={[
          { label: 'Pending', value: 'Pending' },
          { label: 'Completed', value: 'Completed' },
        ]}
        filterColorMap={{
          'Pending':   { bg: '#fef3c7', color: '#92400e', icon: 'ri-time-line' },
          'Completed': { bg: '#d1fae5', color: '#065f46', icon: 'ri-checkbox-circle-line' },
        }}
        hasActiveFilters={hasActiveFilters}
      />

      {loading ? (
        <div className="data-table">
          <table>
            <thead><tr><th>Borrower</th><th>Item</th><th>Released</th><th>Returned</th><th>Person In Charge</th><th>Status</th></tr></thead>
            <tbody><TableGhostRows count={10} colSpan={6} /></tbody>
          </table>
        </div>
      ) : error ? (
        <div className="empty-state">
          <i className="ri-error-warning-line"></i>
          <h3>Failed to Load Records</h3>
          <p>{error}</p>
          <button className="btn-add" onClick={loadRecords}>Try Again</button>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="empty-state">
          <i className="ri-shopping-bag-line"></i>
          <h3>{hasActiveFilters ? 'No Matching Records' : 'No Borrowed Item Records'}</h3>
          <p>{hasActiveFilters ? 'Try adjusting your search or filters.' : 'Log your first borrowed item by clicking "Log Borrowed Item".'}</p>
        </div>
      ) : (
        <>
          <div className="data-table" style={{ overflow: 'visible' }}>
            <table style={{ position: 'relative', zIndex: 1 }}>
              <thead>
                <tr>
                  <th>Borrower</th>
                  <th>Item</th>
                  <th>Released</th>
                  <th>Returned</th>
                  <th>Person In Charge</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pagedRecords.map(record => (
                  <tr key={record.id} onClick={() => handleViewDetails(record)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: '700' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span>{record.borrower_name}</span>
                        {record.created_by && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'normal' }}>
                            <i className="ri-user-line" style={{ fontSize: '12px' }}></i>
                            {record.created_by.split('@')[0]}
                            {record.updated_by && record.updated_by !== record.created_by && (
                              <span style={{ marginLeft: '6px' }}>• updated by: {record.updated_by.split('@')[0]}</span>
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: '600' }}>{record.item_type}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Qty: {record.quantity} • {record.office || 'No office'}</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                      {record.date_released ? format(new Date(record.date_released), 'MMM dd, yyyy') : '—'}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                      {record.date_returned ? (
                        <span style={{ color: '#059669' }}>{format(new Date(record.date_returned), 'MMM dd, yyyy')}</span>
                      ) : (
                        <span style={{ color: '#d97706', fontStyle: 'italic', fontSize: '12px' }}>Not yet returned</span>
                      )}
                    </td>
                    <td style={{ fontWeight: '600' }}>
                      {record.person_in_charge || '—'}
                    </td>
                    <td>
                      <StatusSelect
                        value={record.status}
                        options={STATUS_OPTIONS}
                        onChange={(ns) => handleStatusChange(record.id, ns)}
                        disabled={!(isAdmin || canUpdate)}
                        onClick={e => e.stopPropagation()}
                        align="right"
                      />
                    </td>
                  </tr>
                ))}
                <TableGhostRows count={Math.max(0, pageSize - pagedRecords.length)} colSpan={6} />
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
        records={filteredRecords}
        tableName="logistic"
        columnLabels={{
          record_id: 'Record ID',
          borrower_name: "Borrower's Name",
          office: 'Office',
          address: 'Address',
          contact_no: 'Contact No.',
          item_type: 'Type of Item',
          quantity: 'Quantity',
          item_condition: 'Release Condition',
          date_released: 'Date Released',
          date_returned: 'Date Returned',
          return_condition: 'Return Condition',
          person_in_charge: 'Person In Charge',
          status: 'Status'
        }}
        onSuccess={(count) => toast.success(`Exported ${count} logs successfully.`)}
        onError={(msg) => toast.error(msg)}
      />

      {/* Add / Edit / View Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isViewing ? 'View Transaction Details' : (isEditing ? 'Edit Transaction Details' : 'Log Borrowed Item')}
        maxWidth={(isEditing || isViewing) ? '1100px' : '900px'}
      >
        <form onSubmit={handleSubmit} className="modal-form">
          {/* Two-column layout when editing/viewing */}
          <div style={{ display: 'flex', gap: '24px', alignItems: 'stretch' }}>

            {/* === LEFT PANEL: Borrower & Item Info === */}
            <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, flex: '1 1 0', minWidth: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                <div className="form-row" style={{ gap: '16px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Record ID</label>
                    <input type="text" name="record_id" value={formData.record_id} disabled style={{ background: 'var(--bg-app)', color: 'var(--text-muted)' }} />
                  </div>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label>Borrower's Full Name *</label>
                    <input type="text" name="borrower_name" value={formData.borrower_name} onChange={handleInputChange} required placeholder="e.g. John Doe" />
                  </div>
                </div>

                <div className="form-row" style={{ gap: '16px' }}>
                  <div className="form-group">
                    <label>Office / Affiliation</label>
                    <input type="text" name="office" value={formData.office} onChange={handleInputChange} placeholder="e.g. CDRRMO Rescue Section" />
                  </div>
                  <div className="form-group">
                    <label>Contact Number</label>
                    <input type="text" name="contact_no" value={formData.contact_no} onChange={handleInputChange} placeholder="e.g. 0912-345-6789" />
                  </div>
                </div>

                <div className="form-group">
                  <label>Address</label>
                  <input type="text" name="address" value={formData.address} onChange={handleInputChange} placeholder="Present address of the borrower" />
                </div>

                <div style={{ height: '1px', background: 'var(--border-light)', margin: '4px 0' }} />

                <div className="form-row" style={{ gap: '16px' }}>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label>Type of Item *</label>
                    <input type="text" name="item_type" value={formData.item_type} onChange={handleInputChange} required placeholder="e.g. Spine Board, Rescue Helmet" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Quantity *</label>
                    <input type="number" name="quantity" min="1" value={formData.quantity} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group" style={{ flex: 1.5 }}>
                    <label>Condition Upon Release</label>
                    <select name="item_condition" value={formData.item_condition} onChange={handleInputChange}>
                      {ITEM_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-row" style={{ gap: '16px' }}>
                  <div className="form-group">
                    <label>Date of Release *</label>
                    <input type="date" name="date_released" value={formData.date_released} onChange={handleInputChange} required max={todayStr} />
                  </div>
                  <div className="form-group">
                    <label>Person In Charge (Release)</label>
                    <input type="text" name="person_in_charge" value={formData.person_in_charge} onChange={handleInputChange} placeholder="Officer in charge of releasing" />
                  </div>
                </div>

              </div>
            </fieldset>

            {/* === RIGHT PANEL: Return Details === */}
            {(isEditing || isViewing) && (
              <div style={{
                flex: '0 0 320px',
                minWidth: '260px',
                background: isReturned ? 'rgba(240,253,244,0.8)' : 'var(--bg-app)',
                border: `1.5px solid ${isReturned ? '#86efac' : 'var(--border-light)'}`,
                borderRadius: '14px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Panel header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '12px', borderBottom: `1px solid ${isReturned ? '#86efac' : 'var(--border-light)'}`, flexShrink: 0 }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: isReturned ? '#dcfce7' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={isReturned ? 'ri-checkbox-circle-fill' : 'ri-time-line'} style={{ fontSize: '18px', color: isReturned ? '#16a34a' : '#d97706' }}></i>
                  </div>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text)', lineHeight: 1.2 }}>Return Details</div>
                    <div style={{ fontSize: '11px', color: isReturned ? '#16a34a' : '#d97706', fontWeight: '600', marginTop: '2px' }}>
                      {isReturned ? '✓ Item has been returned' : 'Item not yet returned'}
                    </div>
                  </div>
                </div>

                {/* ── NOT-YET-RETURNED: single full-panel overlay ── */}
                {isViewing && !isReturned ? (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    background: 'rgba(254,243,199,0.55)',
                    borderRadius: '10px',
                    border: '1.5px dashed #f59e0b',
                    padding: '24px 16px',
                    textAlign: 'center'
                  }}>
                    <i className="ri-time-line" style={{ fontSize: '36px', color: '#d97706' }}></i>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#92400e' }}>Not yet returned</div>
                    <div style={{ fontSize: '11px', color: '#b45309', fontWeight: '500', lineHeight: 1.5 }}>
                      Return date, condition, and photo<br />will appear here once logged.
                    </div>
                  </div>
                ) : (
                  <>
                {/* Date of Return */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Date of Return</label>
                  <input
                    type="date"
                    name="date_returned"
                    value={formData.date_returned || ''}
                    onChange={handleInputChange}
                    disabled={isViewing}
                    required={formData.status === 'Completed'}
                    min={formData.date_released}
                    max={todayStr}
                  />
                </div>

                {/* Condition Upon Return */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Condition Upon Return</label>
                  <select name="return_condition" value={formData.return_condition || ''} onChange={handleInputChange} disabled={isViewing} required={formData.status === 'Completed'}>
                    <option value="">-- Select Condition --</option>
                    {RETURN_CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Photo Upload */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Photo Upon Return</label>
                  {isViewing ? (
                    formData.return_photo_url ? (
                      <a href={formData.return_photo_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                        <img src={formData.return_photo_url} alt="Return photo" style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--border-light)', cursor: 'pointer' }} />
                        <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--primary)', marginTop: '4px' }}>
                          <i className="ri-external-link-line"></i> Click to view full photo
                        </div>
                      </a>
                    ) : null
                  ) : (
                    <>
                      {photoPreview || formData.return_photo_url ? (
                        <div style={{ position: 'relative' }}>
                          <img src={photoPreview || formData.return_photo_url} alt="Preview" style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '10px', border: '2px solid var(--primary)' }} />
                          <button type="button" onClick={handleRemovePhoto} style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
                            <i className="ri-close-line"></i>
                          </button>
                        </div>
                      ) : (
                        <div
                          onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
                          onDragLeave={() => setIsDragOver(false)}
                          onDrop={handlePhotoDrop}
                          onClick={() => photoInputRef.current?.click()}
                          style={{
                            border: `2px dashed ${isDragOver ? 'var(--primary)' : 'var(--border-light)'}`,
                            borderRadius: '10px', padding: '24px 12px', textAlign: 'center', cursor: 'pointer',
                            background: isDragOver ? 'rgba(59,130,246,0.06)' : 'var(--bg-surface)',
                            transition: 'all 0.2s'
                          }}
                        >
                          <i className="ri-upload-cloud-2-line" style={{ fontSize: '26px', color: isDragOver ? 'var(--primary)' : 'var(--text-muted)', display: 'block', marginBottom: '6px' }}></i>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: isDragOver ? 'var(--primary)' : 'var(--text)' }}>
                            {isDragOver ? 'Drop photo here' : 'Drag & drop a photo'}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>or click to browse</div>
                        </div>
                      )}
                      <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoSelect} />
                    </>
                  )}
                </div>

                {/* Hint */}
                {!isViewing && formData.status === 'Pending' && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: '8px', padding: '8px 10px', border: '1px solid var(--border-light)', lineHeight: 1.5 }}>
                    <i className="ri-information-line" style={{ marginRight: '4px', color: 'var(--primary)' }}></i>
                    Fill in Date of Return + Condition to automatically mark as <strong>Completed</strong>.
                  </div>
                )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
            {isViewing && (formData.created_by || formData.updated_by) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                {formData.created_by && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="ri-user-add-line" style={{ fontSize: '14px', color: 'var(--primary)' }}></i>
                    <span>Encoded by: <strong style={{ color: 'var(--text)' }}>{formData.created_by.split('@')[0]}</strong>{formData.created_at && <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}> ({format(new Date(formData.created_at), 'MMM d, h:mm a')})</span>}</span>
                  </div>
                )}
                {formData.updated_by && (formData.status === 'Completed' || formData.updated_at !== formData.created_at) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="ri-edit-line" style={{ fontSize: '14px', color: 'var(--primary)' }}></i>
                    <span>Updated by: <strong style={{ color: 'var(--text)' }}>{formData.updated_by.split('@')[0]}</strong>{formData.updated_at && <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}> ({format(new Date(formData.updated_at), 'MMM d, h:mm a')})</span>}</span>
                  </div>
                )}
              </div>
            ) : <div></div>}

            {isViewing ? (
              <div style={{ display: 'flex', gap: '12px' }}>
                {/* Return button — only shown for Pending items */}
                {formData.status === 'Pending' && (isAdmin || canUpdate) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      const rec = records.find(r => r.id === selectedId)
                      if (rec) handleMarkAsReturnedQuick(e, rec)
                    }}
                    style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7', cursor: 'pointer' }}
                  >
                    <i className="ri-arrow-go-back-line" style={{ marginRight: '6px' }}></i> Return
                  </button>
                )}
                {(isAdmin || canDelete) && (
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
                <button type="submit" className="btn-submit" disabled={isSaving || isUploadingPhoto}>
                  {isUploadingPhoto ? 'Uploading photo...' : isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </div>
  )
}
