import ModuleToolbar from '../../components/ModuleToolbar'
import PhotoUploadPanel from '../../components/PhotoUploadPanel'
import useListPagination from '../../hooks/useListPagination'
import ListPagination from '../../components/ListPagination'
import ExportModal from '../../components/ExportModal'
import TableGhostRows from '../../components/TableGhostRows'
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
import StatusSelect from '../../components/StatusSelect'
import { uploadFile, deleteFiles } from '../../services/storage'
import { compressImage } from '../../utils/imageCompression'

const INITIAL_FORM_STATE = {
  vehicle_id: '',
  plate: '',
  model: '',
  manufacturer: '',
  year: '',
  type: '',
  type_other: '',
  capacity: '',
  status: 'Available',
  last_maintenance: '',
  notes: '',
  orcr: '',
  photos: []
}

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([])
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
  const [activeTab, setActiveTab] = useState('details')
  const isAdmin = useIsAdmin()
  const { canCreate, canUpdate, canDelete } = usePermissions('vehicles')
  const toast = useToast()
  const confirm = useConfirm()


  // Toolbar states
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  useEffect(() => {
    loadVehicles()
  }, [])

  const filteredRecords = vehicles.filter(item => {
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
  const { currentPage, setCurrentPage, pageSize, setPageSize, totalPages, safePage, pagedRecords } = useListPagination(filteredRecords)

  const loadVehicles = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setVehicles(data || [])
    } catch (err) {
      console.error('Error loading vehicles:', err)
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
    setActiveTab('details')
    setPendingPhotos([])
    const year = new Date().getFullYear()
    const rand = Math.floor(1000 + Math.random() * 9000)
    setFormData({
      ...INITIAL_FORM_STATE,
      vehicle_id: `VEH-${year}-${rand}`
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (v) => {
    setIsEditing(true)
    setIsViewing(false)
    setSelectedId(v.id)
    setActiveTab('details')
    setPendingPhotos([])
    setFormData({
      vehicle_id: v.vehicle_id || '',
      plate: v.plate || '',
      model: v.model || '',
      manufacturer: v.manufacturer || '',
      year: v.year || '',
      type: v.type || '',
      type_other: v.type_other || '',
      capacity: v.capacity || '',
      status: v.status || 'Available',
      last_maintenance: v.last_maintenance || '',
      notes: v.notes || '',
      orcr: v.orcr || '',
      photos: v.photos || []
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

  const removeExistingPhoto = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, idx) => idx !== indexToRemove)
    }))
  }

  const removePendingPhoto = (indexToRemove) => {
    setPendingPhotos(prev => prev.filter((_, idx) => idx !== indexToRemove))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      let newPhotoUrls = []
      
      if (pendingPhotos.length > 0) {
        setIsUploading(true)
        try {
          for (const file of pendingPhotos) {
            const compressedFile = await compressImage(file, 800, 0.6)
            const path = `vehicle-photos/${Date.now()}-${compressedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            const url = await uploadFile('vehicles', path, compressedFile)
            newPhotoUrls.push(url)
          }
        } catch (error) {
          console.error('Upload error:', error)
          toast.error('Failed to upload some photos. Did you create the public "vehicles" bucket in Supabase?')
          throw error 
        } finally {
          setIsUploading(false)
        }
      }

      const payload = {
        ...formData,
        last_maintenance: formData.last_maintenance || null,
        photos: [...(formData.photos || []), ...newPhotoUrls]
      }

      if (isEditing) {
        const { data, error } = await supabase
          .from('vehicles')
          .update(payload)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setVehicles(filteredRecords.map(v => v.id === selectedId ? data[0] : v))
        await logAudit('Updated', 'Vehicles', formData.record_id || formData.id || selectedId, 'Updated record details')
        toast.success('Vehicle updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('vehicles')
          .insert([payload])
          .select()

        if (error) throw error
        setVehicles([data[0], ...vehicles])
        await logAudit('Added', 'Vehicles', formData.record_id || data[0].record_id || data[0].id, 'Created new record')
        toast.success('Vehicle added successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving vehicle:', err)
      toast.error('Error saving vehicle: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This vehicle will be permanently removed. This action cannot be undone.', { title: 'Delete Record' })
    if (!ok) return

    try {
      const recordToDelete = vehicles.find(item => item.id === id)
      if (recordToDelete && recordToDelete.photos && recordToDelete.photos.length > 0) {
        const pathsToDelete = recordToDelete.photos
          .map(url => {
            const idx = url.indexOf('vehicle-photos/')
            return idx !== -1 ? url.substring(idx) : null
          })
          .filter(Boolean)
        
        if (pathsToDelete.length > 0) {
          await deleteFiles('vehicles', pathsToDelete)
        }
      }

      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setVehicles(vehicles.filter(v => v.id !== id))
      await logAudit('Deleted', 'Vehicles', id, 'Deleted record')
      toast.success('Vehicle record deleted successfully!')
    } catch (err) {
      console.error('Error deleting vehicle:', err)
      toast.error('Failed to delete vehicle: ' + err.message)
    }
  }

  const handleStatusChange = async (e, id) => {
    e.stopPropagation()
    const newStatus = e.target.value
    
    try {
      const { error } = await supabase
        .from('vehicles')
        .update({ status: newStatus })
        .eq('id', id)

      if (error) throw error

      setVehicles(vehicles.map(v => v.id === id ? { ...v, status: newStatus } : v))
      toast.success('Status updated successfully!')
      await logAudit('Updated', 'Vehicles', id, `Updated status to ${newStatus}`)
    } catch (err) {
      console.error('Error updating status:', err)
      toast.error('Failed to update status: ' + err.message)
    }
  }

  const VEHICLE_STATUS_OPTIONS = [
    { value: 'Available',   label: 'Available',   icon: 'ri-checkbox-circle-fill', bg: '#d1fae5', color: '#065f46' },
    { value: 'In Use',      label: 'In Use',      icon: 'ri-car-fill',             bg: '#fef3c7', color: '#92400e' },
    { value: 'Maintenance', label: 'Maintenance', icon: 'ri-tools-fill',           bg: '#fee2e2', color: '#991b1b' },
    { value: 'Unavailable', label: 'Unavailable', icon: 'ri-close-circle-fill',    bg: '#f3f4f6', color: '#374151' },
  ]

  const handlePrintPDF = () => {
    printPDF({
      title: 'Vehicles Report',
      subtitle: `${filteredRecords.length} vehicles`,
      columns: [
        { header: 'Vehicle ID', key: 'vehicle_id' },
        { header: 'Plate Number', key: 'plate' },
        { header: 'Model', key: 'model' },
        { header: 'Type', key: 'type' },
        { header: 'Capacity', key: 'capacity' },
        { header: 'Status', key: 'status' },
        { header: 'Last Maintenance', key: 'last_maintenance', format: v => v ? format(new Date(v), 'MMM dd, yyyy') : '—' },
      ],
      records: filteredRecords,
    })
  }

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading vehicles...</p>
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
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading Vehicles</h3>
          <p>{error}</p>
          <button 
            onClick={loadVehicles}
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
          <i className="ri-truck-line" style={{ marginRight: '12px' }}></i>
          Vehicles
        </h2>
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: (isAdmin || canCreate) ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Add Vehicle
        </button>
      </div>

      
      {vehicles.length > 0 && (() => {
        const counts = {
          total:       vehicles.length,
          available:   vehicles.filter(v => v.status === 'Available').length,
          inUse:       vehicles.filter(v => v.status === 'In Use').length,
          maintenance: vehicles.filter(v => v.status === 'Maintenance').length,
          unavailable: vehicles.filter(v => v.status === 'Unavailable').length,
        }
        const cards = [
          { label: 'Total',       count: counts.total,       value: '',            icon: 'ri-truck-line',         accent: '#2563eb' },
          { label: 'Available',   count: counts.available,   value: 'Available',   icon: 'ri-checkbox-circle-line', accent: '#16a34a' },
          { label: 'In Use',      count: counts.inUse,       value: 'In Use',      icon: 'ri-run-line',           accent: '#d97706' },
          { label: 'Maintenance', count: counts.maintenance, value: 'Maintenance', icon: 'ri-tools-line',         accent: '#dc2626' },
          { label: 'Unavailable', count: counts.unavailable, value: 'Unavailable', icon: 'ri-close-circle-line',  accent: '#6b7280' },
        ]
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {cards.map(c => (
              <div key={c.label} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px 16px', borderRadius: '12px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                borderTop: `3px solid ${c.accent}`,
                boxShadow: 'var(--shadow-sm)',
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

      {vehicles.length > 0 && (
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
            { label: 'In Use',      value: 'In Use' },
            { label: 'Maintenance', value: 'Maintenance' },
            { label: 'Unavailable', value: 'Unavailable' },
          ]}
          filterColorMap={{
            'Available':   { bg: '#d1fae5', color: '#065f46', icon: 'ri-checkbox-circle-line' },
            'In Use':      { bg: '#fef3c7', color: '#92400e', icon: 'ri-run-line' },
            'Maintenance': { bg: '#fee2e2', color: '#991b1b', icon: 'ri-tools-line' },
            'Unavailable': { bg: '#f3f4f6', color: '#374151', icon: 'ri-close-circle-line' },
          }}
        />
      )}

      {vehicles.length === 0 ? (
        <div className="empty-state">
          <i className="ri-truck-line"></i>
          <h3>No Vehicles Found</h3>
          <p>Click "Add Vehicle" to register your first vehicle.</p>
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
                <th>Vehicle ID</th>
                <th>Plate Number</th>
                <th>Model</th>
                <th>Type</th>
                <th>Capacity</th>
                <th>Status</th>
                <th>Last Maintenance</th>
                
              </tr>
            </thead>
            <tbody>
              {pagedRecords.map((vehicle) => (
                <tr 
                  key={vehicle.id}
                  onClick={() => handleViewDetails(vehicle)}
                  style={{ cursor: 'pointer', height: '49px' }}
                  className="table-row-clickable"
                >
                  <td><code style={{ fontWeight: '700' }}>{vehicle.vehicle_id || '-'}</code></td>
                  <td style={{ fontWeight: '700', fontFamily: 'monospace' }}>
                    {vehicle.plate || '-'}
                  </td>
                  <td>
                    <div style={{ fontWeight: '600' }}>{vehicle.model || '-'}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {vehicle.manufacturer} {vehicle.year ? `(${vehicle.year})` : ''}
                    </div>
                  </td>
                  <td>{vehicle.type || '-'}</td>
                  <td>{vehicle.capacity || '-'}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <StatusSelect
                      value={vehicle.status || 'Available'}
                      options={VEHICLE_STATUS_OPTIONS}
                      onChange={(val) => { handleStatusChange({ target: { value: val } }, vehicle.id) }}
                      disabled={!isAdmin}
                    />
                  </td>
                  <td>
                    {vehicle.last_maintenance 
                      ? format(new Date(vehicle.last_maintenance), 'MMM dd, yyyy')
                      : 'Not recorded'}
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
        records={vehicles}
        filename="vehicles_report.xlsx"
        sheetName="Vehicles"
        dateField="created_at"
        columns={['vehicle_id', 'plate', 'orcr', 'model', 'manufacturer', 'year', 'type', 'capacity', 'status', 'last_maintenance', 'notes', 'photos']}
        headers={{
          vehicle_id: 'Vehicle ID',
          plate: 'Plate Number',
          orcr: 'ORCR',
          model: 'Model',
          manufacturer: 'Manufacturer',
          year: 'Year',
          type: 'Type',
          capacity: 'Capacity',
          status: 'Status',
          last_maintenance: 'Last Maintenance',
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
        title={isViewing ? 'View Details' : (isEditing ? 'Edit Vehicle Record' : 'Register Vehicle')}
        maxWidth="1000px"
      >
        <style>{`
          .vehicle-form-layout {
            display: flex;
            flex-wrap: wrap;
            gap: 32px;
          }
          .vehicle-details-col {
            flex: 1 1 450px;
            min-width: 0;
          }
          .vehicle-photos-col {
            flex: 1 1 350px;
            min-width: 0;
            border-left: 2px solid var(--border-light);
            padding-left: 32px;
          }
          @media (max-width: 1050px) {
            .vehicle-form-layout {
              flex-direction: column;
              gap: 24px;
            }
            .vehicle-photos-col {
              border-left: none;
              padding-left: 0;
              border-top: 2px solid var(--border-light);
              padding-top: 24px;
            }
          }
        `}</style>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="vehicle-form-layout">
            <div className="vehicle-details-col">
              <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="form-row">
            <div className="form-group">
              <label>Vehicle ID *</label>
              <input 
                type="text" 
                name="vehicle_id" 
                value={formData.vehicle_id} 
                onChange={handleInputChange} 
                required 
               disabled style={{ backgroundColor: 'var(--bg-app)', cursor: 'not-allowed', color: 'var(--text-muted)' }} />
            </div>
            <div className="form-group">
              <label>Plate Number *</label>
              <input 
                type="text" 
                name="plate" 
                value={formData.plate} 
                onChange={handleInputChange} 
                required 
                placeholder="e.g. SAA-1234, 1201-123456"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>ORCR *</label>
              <input 
                type="text" 
                name="orcr" 
                value={formData.orcr} 
                onChange={handleInputChange} 
                required
                placeholder="Enter ORCR details"
              />
            </div>
            <div className="form-group">
              <label>Model *</label>
              <input 
                type="text" 
                name="model" 
                value={formData.model} 
                onChange={handleInputChange} 
                required 
                placeholder="e.g. Hilux, Urvan"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Manufacturer *</label>
              <input 
                type="text" 
                name="manufacturer" 
                value={formData.manufacturer} 
                onChange={handleInputChange} 
                required
                placeholder="e.g. Toyota, Nissan"
              />
            </div>
            <div className="form-group">
              <label>Year *</label>
              <select 
                name="year" 
                value={formData.year} 
                onChange={handleInputChange} 
                required
              >
                <option value="">-- Select Year --</option>
                {(() => {
                  const currentYear = new Date().getFullYear()
                  const years = []
                  for (let y = currentYear; y >= currentYear - 50; y--) {
                    years.push(y)
                  }
                  return years.map(y => <option key={y} value={y}>{y}</option>)
                })()}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Type / Classification *</label>
              <select 
                name="type" 
                value={formData.type} 
                onChange={handleInputChange} 
                required
              >
                <option value="">-- Select Type --</option>
                <option value="Ambulance">Ambulance</option>
                <option value="Rescue Vehicle">Rescue Vehicle</option>
                <option value="Fire Truck">Fire Truck</option>
                <option value="Emergency Response Vehicle">Emergency Response Vehicle</option>
                <option value="Support Vehicle">Support Vehicle</option>
                <option value="Other">Other</option>
              </select>
            </div>
            {formData.type === 'Other' && (
              <div className="form-group">
                <label>Specify Type *</label>
                <input 
                  type="text" 
                  name="type_other" 
                  value={formData.type_other} 
                  onChange={handleInputChange} 
                  required
                  placeholder="Specify vehicle type"
                />
              </div>
            )}
            <div className="form-group">
              <label>Capacity *</label>
              <input 
                type="text" 
                name="capacity" 
                value={formData.capacity} 
                onChange={handleInputChange} 
                required
                placeholder="e.g. 5 pax, 2 tons"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Status</label>
              <select name="status" value={formData.status} onChange={handleInputChange}>
                <option value="Available">Available</option>
                <option value="In Use">In Use</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Unavailable">Unavailable</option>
              </select>
            </div>
            <div className="form-group">
              <label>Last Maintenance Date</label>
              <input 
                type="date" 
                name="last_maintenance" 
                value={formData.last_maintenance} 
                onChange={handleInputChange}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Notes / Equipment List</label>
            <textarea 
              name="notes" 
              value={formData.notes} 
              onChange={handleInputChange} 
              rows={2} 
              placeholder="e.g. Equipped with stretcher, trauma kit, VHF radio"
            />
          </div>
                </div>
              </fieldset>
            </div>

            <div className="vehicle-photos-col">
              <PhotoUploadPanel
                title="Vehicle Photos"
                emptyMessage="No photos uploaded for this vehicle yet."
                photos={formData.photos}
                pendingPhotos={pendingPhotos}
                isViewing={isViewing}
                isUploading={isUploading}
                isSaving={isSaving}
                onFileUpload={handleFileUpload}
                onRemoveExisting={removeExistingPhoto}
                onRemovePending={removePendingPhoto}
                addButtonLabel="Add Photos"
              />
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
