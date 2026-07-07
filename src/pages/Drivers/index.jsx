import ModuleToolbar from '../../components/ModuleToolbar'
import PhotoUploadPanel from '../../components/PhotoUploadPanel'
import useListPagination from '../../hooks/useListPagination'
import ListPagination from '../../components/ListPagination'
import ExportModal from '../../components/ExportModal'
import TableGhostRows from '../../components/TableGhostRows'
import StatusSelect from '../../components/StatusSelect'
import { useState, useEffect } from 'react'
import { validateForm } from '../../utils/validation'
import { supabase } from '../../services/supabase'
import { logAudit } from '../../services/audit'
import { uploadFile, deleteFiles } from '../../services/storage'
import { compressImage } from '../../utils/imageCompression'
import { format, isPast } from 'date-fns'
import { printPDF } from '../../utils/printPDF'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'

const INITIAL_FORM_STATE = {
  driver_id: '',
  name: '',
  license_no: '',
  license_expiry: '',
  contact: '',
  status: 'Available',
  notes: '',
  photos: []
}

export default function Drivers() {
  const [drivers, setDrivers] = useState([])
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
  const { canCreate, canUpdate, canDelete } = usePermissions('drivers')
  const toast = useToast()
  const confirm = useConfirm()

  // Toolbar states
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  useEffect(() => { loadDrivers() }, [])

  const filteredRecords = drivers.filter(item => {
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
      const dateStr = item.created_at
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

  const loadDrivers = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setDrivers(data || [])
    } catch (err) {
      console.error('Error loading drivers:', err)
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
    setFormData({ ...INITIAL_FORM_STATE, driver_id: `DRV-${year}-${rand}` })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (d) => {
    setIsEditing(true); setIsViewing(false); setSelectedId(d.id); setPendingPhotos([])
    setFormData({
      driver_id: d.driver_id || '',
      name: d.name || '',
      license_no: d.license_no || '',
      license_expiry: d.license_expiry || '',
      contact: d.contact || '',
      status: d.status || 'Available',
      notes: d.notes || '',
      photos: d.photos || []
    })
    setIsModalOpen(true)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
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
      'Driver Name': { rule: 'name', value: formData.name, required: true },
      'Contact No.': { rule: 'mobile', value: formData.contact },
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
            const path = `driver-photos/${Date.now()}-${compressed.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            const url = await uploadFile('drivers', path, compressed)
            newPhotoUrls.push(url)
          }
        } catch (err) {
          toast.error('Failed to upload photos. Make sure a public "drivers" bucket exists in Supabase.')
          throw err
        } finally {
          setIsUploading(false)
        }
      }

      const payload = {
        ...formData,
        license_expiry: formData.license_expiry || null,
        photos: [...(formData.photos || []), ...newPhotoUrls]
      }

      if (isEditing) {
        const { data, error } = await supabase.from('drivers').update(payload).eq('id', selectedId).select()
        if (error) throw error
        setDrivers(drivers.map(d => d.id === selectedId ? data[0] : d))
        await logAudit('Updated', 'Drivers', formData.driver_id || selectedId, 'Updated record details')
        toast.success('Driver updated successfully!')
      } else {
        const { data, error } = await supabase.from('drivers').insert([payload]).select()
        if (error) throw error
        setDrivers([data[0], ...drivers])
        await logAudit('Added', 'Drivers', data[0].driver_id || data[0].id, 'Created new record')
        toast.success('Driver added successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving driver:', err)
      toast.error('Error saving driver: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This driver will be permanently removed. This action cannot be undone.', { title: 'Delete Record' })
    if (!ok) return
    try {
      const rec = drivers.find(d => d.id === id)
      if (rec?.photos?.length > 0) {
        const paths = rec.photos.map(url => { const i = url.indexOf('driver-photos/'); return i !== -1 ? url.substring(i) : null }).filter(Boolean)
        if (paths.length > 0) await deleteFiles('drivers', paths)
      }
      const { error } = await supabase.from('drivers').delete().eq('id', id)
      if (error) throw error
      setDrivers(drivers.filter(d => d.id !== id))
      await logAudit('Deleted', 'Drivers', id, 'Deleted record')
      toast.success('Driver record deleted successfully!')
    } catch (err) {
      toast.error('Failed to delete driver: ' + err.message)
    }
  }

  const getStatusBadge = (status) => {
    const colors = { 'Available': { bg: '#d1fae5', color: '#065f46' }, 'On Duty': { bg: '#fef3c7', color: '#92400e' }, 'Off Duty': { bg: '#f3f4f6', color: '#374151' }, 'Unavailable': { bg: '#fee2e2', color: '#991b1b' } }
    const style = colors[status] || colors['Available']
    return <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', background: style.bg, color: style.color }}>{status || 'Available'}</span>
  }

  const handleStatusChange = async (id, newStatus) => {
    try {
      const { error } = await supabase.from('drivers').update({ status: newStatus }).eq('id', id)
      if (error) throw error
      setDrivers(drivers.map(d => d.id === id ? { ...d, status: newStatus } : d))
    } catch (err) {
      toast.error('Failed to update status: ' + err.message)
    }
  }

  const getLicenseStatus = (expiryDate) => {
    if (!expiryDate) return null
    const isExpired = isPast(new Date(expiryDate))
    return <span style={{ fontSize: '11px', fontWeight: '700', color: isExpired ? '#991b1b' : '#065f46' }}>{isExpired ? '⚠️ EXPIRED' : '✓ Valid'}</span>
  }

  const handlePrintPDF = () => {
    printPDF({
      title: 'Drivers Report',
      subtitle: `${filteredRecords.length} drivers`,
      columns: [
        { header: 'Driver ID', key: 'driver_id' },
        { header: 'Name', key: 'name' },
        { header: 'License No.', key: 'license_no' },
        { header: 'License Expiry', key: 'license_expiry', format: v => v ? format(new Date(v), 'MMM dd, yyyy') : '—' },
        { header: 'Contact', key: 'contact' },
        { header: 'Status', key: 'status' },
      ],
      records: filteredRecords,
    })
  }

  if (loading) return (
    <div className="loading-container">
      <i className="ri-loader-4-line loading-spinner"></i>
      <p>Loading drivers...</p>
    </div>
  )

  if (error) return (
    <div style={{ padding: '32px', textAlign: 'center' }}>
      <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: '24px', color: '#991b1b', maxWidth: '500px', margin: '0 auto' }}>
        <i className="ri-error-warning-line" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading Drivers</h3>
        <p>{error}</p>
        <button onClick={loadDrivers} style={{ marginTop: '16px', padding: '10px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}>Try Again</button>
      </div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="ri-steering-2-line" style={{ marginRight: '12px' }}></i>
          Drivers
        </h2>
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: (isAdmin || canCreate) ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Add Driver
        </button>
      </div>

      {drivers.length > 0 && (() => {
        const STATUSES = ['Available', 'On Duty', 'Off Duty', 'Unavailable']
        const cards = [
          { label: 'Total',       count: drivers.length,                                      icon: 'ri-steering-2-line',    accent: '#2563eb' },
          { label: 'Available',   count: drivers.filter(d => d.status === 'Available').length, icon: 'ri-checkbox-circle-line', accent: '#16a34a' },
          { label: 'On Duty',     count: drivers.filter(d => d.status === 'On Duty').length,   icon: 'ri-run-line',           accent: '#d97706' },
          { label: 'Off Duty',    count: drivers.filter(d => d.status === 'Off Duty').length,  icon: 'ri-user-line',          accent: '#6b7280' },
          { label: 'Unavailable', count: drivers.filter(d => d.status === 'Unavailable').length, icon: 'ri-close-circle-line', accent: '#dc2626' },
        ]
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {cards.map(c => (
              <div key={c.label} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px 16px', borderRadius: '12px',
                background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
                borderTop: `3px solid ${c.accent}`, boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${c.accent}12` }}>
                  <i className={c.icon} style={{ fontSize: '18px', color: c.accent }} />
                </div>
                <div>
                  <div style={{ fontSize: '22px', fontWeight: '900', lineHeight: 1, color: c.accent }}>{c.count}</div>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{c.label}</div>
                </div>
              </div>
            ))}
          </div>
        )
      })()}

      {drivers.length > 0 && (
        <ModuleToolbar
          onSearch={(v) => { setSearchTerm(v); setCurrentPage(1) }}
          onFilterChange={(v) => { setFilter(v); setCurrentPage(1) }}
          onDateRangeChange={(r) => { setDateRange(r); setCurrentPage(1) }}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          onExportClick={() => setIsExportOpen(true)}
          onPrintClick={handlePrintPDF}
          onClearFilters={() => { setSearchTerm(''); setFilter(''); setDateRange({ start: '', end: '' }); setCurrentPage(1) }}
          hasActiveFilters={Boolean(searchTerm || filter || dateRange.start || dateRange.end)}
          filterLabel="All Status"
          filterOptions={[
            { label: 'Available',   value: 'Available' },
            { label: 'On Duty',     value: 'On Duty' },
            { label: 'Off Duty',    value: 'Off Duty' },
            { label: 'Unavailable', value: 'Unavailable' },
          ]}
          filterColorMap={{
            'Available':   { bg: '#d1fae5', color: '#065f46', icon: 'ri-checkbox-circle-line' },
            'On Duty':     { bg: '#fef3c7', color: '#92400e', icon: 'ri-run-line' },
            'Off Duty':    { bg: '#f3f4f6', color: '#374151', icon: 'ri-user-line' },
            'Unavailable': { bg: '#fee2e2', color: '#991b1b', icon: 'ri-close-circle-line' },
          }}
        />
      )}

      {drivers.length === 0 ? (
        <div className="empty-state">
          <i className="ri-steering-2-line"></i>
          <h3>No Drivers Found</h3>
          <p>Click "Add Driver" to register your first driver.</p>
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
                <th>Driver ID</th>
                <th>Name</th>
                <th>License No.</th>
                <th>License Expiry</th>
                <th>Contact</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pagedRecords.map((driver) => (
                <tr key={driver.id} onClick={() => handleViewDetails(driver)} style={{ cursor: 'pointer', height: '49px' }} className="table-row-clickable">
                  <td><code style={{ fontWeight: '700' }}>{driver.driver_id || '-'}</code></td>
                  <td style={{ fontWeight: '700' }}>{driver.name || '-'}</td>
                  <td><div style={{ fontFamily: 'monospace', fontWeight: '600' }}>{driver.license_no || 'Not provided'}</div></td>
                  <td>
                    {driver.license_expiry ? (
                      <div>
                        <div>{format(new Date(driver.license_expiry), 'MMM dd, yyyy')}</div>
                        {getLicenseStatus(driver.license_expiry)}
                      </div>
                    ) : 'Not provided'}
                  </td>
                  <td>{driver.contact || '-'}</td>
                  <td onClick={e => (isAdmin || canUpdate) ? e.stopPropagation() : undefined}>
                    {(isAdmin || canUpdate) ? (
                      <StatusSelect
                        value={driver.status || 'Available'}
                        options={[
                          { value: 'Available',   label: 'Available',   icon: 'ri-checkbox-circle-fill', bg: '#d1fae5', color: '#065f46' },
                          { value: 'On Duty',     label: 'On Duty',     icon: 'ri-run-line',             bg: '#fef3c7', color: '#92400e' },
                          { value: 'Off Duty',    label: 'Off Duty',    icon: 'ri-user-line',            bg: '#f3f4f6', color: '#374151' },
                          { value: 'Unavailable', label: 'Unavailable', icon: 'ri-close-circle-fill',    bg: '#fee2e2', color: '#991b1b' },
                        ]}
                        onChange={v => handleStatusChange(driver.id, v)}
                      />
                    ) : getStatusBadge(driver.status)}
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
        records={drivers}
        filename="drivers_report.xlsx"
        sheetName="Drivers"
        dateField="created_at"
        columns={['driver_id', 'name', 'license_no', 'license_expiry', 'contact', 'status', 'notes', 'photos']}
        headers={{
          driver_id: 'Driver ID',
          name: 'Name',
          license_no: 'License Number',
          license_expiry: 'License Expiry',
          contact: 'Contact',
          status: 'Status',
          notes: 'Notes',
          photos: 'Photo URLs'
        }}
        transformValue={(col, val) => {
          if (col === 'photos') {
            if (Array.isArray(val) && val.length > 0) {
              return val.join('\n')
            }
            return ''
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
        title={isViewing ? 'View Details' : (isEditing ? 'Edit Driver Details' : 'Register Driver')}
        maxWidth="1000px"
      >
        <style>{`
          .driver-form-layout { display: flex; flex-wrap: wrap; gap: 32px; }
          .driver-details-col { flex: 1 1 420px; min-width: 0; }
          .driver-photos-col { flex: 1 1 320px; min-width: 0; border-left: 2px solid var(--border-light); padding-left: 32px; }
          @media (max-width: 1050px) {
            .driver-form-layout { flex-direction: column; gap: 24px; }
            .driver-photos-col { border-left: none; padding-left: 0; border-top: 2px solid var(--border-light); padding-top: 24px; }
          }
        `}</style>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="driver-form-layout">

            {/* Left: Driver Details */}
            <div className="driver-details-col">
              <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Driver ID *</label>
                      <input type="text" name="driver_id" value={formData.driver_id} onChange={handleInputChange} required disabled style={{ backgroundColor: 'var(--bg-app)', cursor: 'not-allowed', color: 'var(--text-muted)' }} />
                    </div>
                    <div className="form-group">
                      <label>Full Name *</label>
                      <input type="text" name="name" value={formData.name} onChange={handleInputChange} required placeholder="e.g. Juan dela Cruz" />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>License Number</label>
                      <input type="text" name="license_no" value={formData.license_no} onChange={handleInputChange} placeholder="e.g. N01-XX-XXXXXX" />
                    </div>
                    <div className="form-group">
                      <label>License Expiry</label>
                      <input type="date" name="license_expiry" value={formData.license_expiry} onChange={handleInputChange} />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Contact Number</label>
                      <input type="text" name="contact" value={formData.contact} onChange={handleInputChange} placeholder="e.g. 0917-XXX-XXXX" />
                    </div>
                    <div className="form-group">
                      <label>Duty Status</label>
                      <select name="status" value={formData.status} onChange={handleInputChange}>
                        <option value="Available">Available</option>
                        <option value="On Duty">On Duty</option>
                        <option value="Off Duty">Off Duty</option>
                        <option value="Unavailable">Unavailable</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Notes</label>
                    <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows={2} placeholder="e.g. Authorized to drive heavy trucks, fire truck" />
                  </div>

                </div>
              </fieldset>
            </div>

            {/* Right: Photos */}
            <div className="driver-photos-col">
              <PhotoUploadPanel
                title="Driver Photos"
                emptyMessage="No photos uploaded for this driver yet."
                photos={formData.photos}
                pendingPhotos={pendingPhotos}
                isViewing={isViewing}
                isUploading={isUploading}
                isSaving={isSaving}
                onFileUpload={handleFileUpload}
                onRemoveExisting={removeExistingPhoto}
                onRemovePending={removePendingPhoto}
                minHeight="300px"
                addButtonLabel="Add Photos"
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
