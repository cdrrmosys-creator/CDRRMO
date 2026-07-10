import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { logAudit } from '../../services/audit'
import { uploadFile, deleteFiles } from '../../services/storage'
import { compressImage } from '../../utils/imageCompression'
import { format } from 'date-fns'
import { printPDF } from '../../utils/printPDF'
import Modal from '../../components/Modal'
import PhotoUploadPanel from '../../components/PhotoUploadPanel'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'
import ModuleToolbar from '../../components/ModuleToolbar'
import ListPagination from '../../components/ListPagination'
import ExportModal from '../../components/ExportModal'
import TableGhostRows from '../../components/TableGhostRows'
import useListPagination from '../../hooks/useListPagination'
import StatusSelect from '../../components/StatusSelect'
import ScrollableSelect from '../../components/ScrollableSelect'

const INITIAL_FORM_STATE = {
  record_id: '',
  stock_number: '',
  property_no: '',
  serial_no: '',
  item_name: '',
  category: '',
  category_other: '',
  quantity: '',
  unit: '',
  condition: 'Good',
  acquisition_cost: '',
  date_acquired: '',
  property_custodian: '',
  end_user: '',
  estimated_life: '',
  fund_cluster: '',
  serviceable: true,
  remarks: '',
  photos: [],
  created_by: '',
  updated_by: '',
  created_at: '',
  updated_at: ''
}

export default function Inventory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Toolbar states
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

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
  const { canCreate, canUpdate, canDelete } = usePermissions('inventory')
  const toast = useToast()
  const confirm = useConfirm()

  useEffect(() => {
    loadInventory()
  }, [])

  const loadInventory = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setItems(data || [])
    } catch (err) {
      console.error('Error loading inventory:', err)
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
    setPendingPhotos([])
    const year = new Date().getFullYear()
    const rand = Math.floor(1000 + Math.random() * 9000)
    const todayStr = new Date().toISOString().split('T')[0]
    
    setFormData({
      ...INITIAL_FORM_STATE,
      record_id: `INV-${year}-${rand}`,
      date_acquired: todayStr
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (rec) => {
    setIsEditing(true)
    setIsViewing(false)
    setSelectedId(rec.id)
    setPendingPhotos([])
    setFormData({
      record_id: rec.record_id || '',
      stock_number: rec.stock_number || '',
      property_no: rec.property_no || '',
      serial_no: rec.serial_no || '',
      item_name: rec.item_name || '',
      category: rec.category || '',
      category_other: rec.category_other || '',
      quantity: rec.quantity || '',
      unit: rec.unit || '',
      condition: rec.condition || 'Good',
      acquisition_cost: rec.acquisition_cost || '',
      date_acquired: rec.date_acquired || '',
      property_custodian: rec.property_custodian || '',
      end_user: rec.end_user || '',
      estimated_life: rec.estimated_life || '',
      fund_cluster: rec.fund_cluster || '',
      serviceable: rec.serviceable !== undefined ? rec.serviceable : true,
      remarks: rec.remarks || '',
      photos: rec.photos || [],
      created_by: rec.created_by || '',
      updated_by: rec.updated_by || '',
      created_at: rec.created_at || '',
      updated_at: rec.updated_at || ''
    })
    setIsModalOpen(true)
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }))
  }

  const handleServiceableChange = async (id, newValue) => {
    try {
      const { error } = await supabase
        .from('inventory')
        .update({ serviceable: newValue })
        .eq('id', id)
      if (error) throw error
      setItems(items.map(i => i.id === id ? { ...i, serviceable: newValue } : i))
      toast.success('Status updated')
    } catch (err) {
      toast.error('Failed to update status: ' + err.message)
    }
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
      
      // Upload pending photos first
      if (pendingPhotos.length > 0) {
        setIsUploading(true)
        try {
          for (const file of pendingPhotos) {
            const compressedFile = await compressImage(file, 800, 0.6)
            const path = `inventory-photos/${Date.now()}-${compressedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            const url = await uploadFile('inventory', path, compressedFile)
            newPhotoUrls.push(url)
          }
        } catch (error) {
          console.error('Upload error:', error)
          toast.error('Failed to upload some photos. Did you create the public "inventory" bucket in Supabase?')
          throw error // Abort save if uploads fail
        } finally {
          setIsUploading(false)
        }
      }

      const payload = {
        ...formData,
        quantity: formData.quantity ? parseInt(formData.quantity) : 0,
        acquisition_cost: formData.acquisition_cost ? parseFloat(formData.acquisition_cost) : null,
        photos: [...(formData.photos || []), ...newPhotoUrls]
      }

      if (isEditing) {
        const { data, error } = await supabase
          .from('inventory')
          .update(payload)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setItems(items.map(item => item.id === selectedId ? data[0] : item))
        await logAudit('Updated', 'Inventory', formData.record_id || formData.id || selectedId, 'Updated record details')
        toast.success('Item updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('inventory')
          .insert([payload])
          .select()

        if (error) throw error
        setItems([data[0], ...items])
        await logAudit('Added', 'Inventory', formData.record_id || data[0].record_id || data[0].id, 'Created new record')
        toast.success('Item added successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving item:', err)
      toast.error('Error saving item: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This item will be permanently removed. This action cannot be undone.', { title: 'Delete Record' })
    if (!ok) return

    try {
      // Find the record to get its photos
      const recordToDelete = items.find(item => item.id === id)
      if (recordToDelete && recordToDelete.photos && recordToDelete.photos.length > 0) {
        const pathsToDelete = recordToDelete.photos
          .map(url => {
            const idx = url.indexOf('inventory-photos/')
            return idx !== -1 ? url.substring(idx) : null
          })
          .filter(Boolean)
        
        if (pathsToDelete.length > 0) {
          await deleteFiles('inventory', pathsToDelete)
        }
      }

      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setItems(items.filter(item => item.id !== id))
      await logAudit('Deleted', 'Inventory', id, 'Deleted record')
      toast.success('Inventory item deleted successfully!')
    } catch (err) {
      console.error('Error deleting item:', err)
      toast.error('Failed to delete item: ' + err.message)
    }
  }

  const getConditionBadge = (condition) => {
    const colors = {
      'New': { bg: '#d1fae5', color: '#065f46' },
      'Good': { bg: '#d1fae5', color: '#065f46' },
      'Fair': { bg: '#fef3c7', color: '#92400e' },
      'Poor': { bg: '#fed7aa', color: '#9a3412' },
      'Damaged': { bg: '#fee2e2', color: '#991b1b' }
    }
    const style = colors[condition] || colors['Good']
    
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
        {condition || 'Good'}
      </span>
    )
  }

  // Predefined category list for filter dropdown
  const categories = [
    'ICT AND AUDIO VISUAL EQUIPMENT',
    'OFFICE SUPPLIES',
    'JANITORIAL SUPPLIES',
    'MEDICAL SUPPLIES',
    'OXYGEN',
    'PPE (WASAR, CSSR, EXTRICATION, HIGH ANGLE)',
    'RESCUE TOOLS (WASAR, CSSR, EXTRICATION, HIGH ANGLE)',
    'VEHICLES',
    'GENERATOR SET',
    'AIRCONDITIONING',
    'UMBRELLA',
    'AM/FM RADIO',
    'Early warning device/system',
    'Two way radio',
    'Command Center',
    'Other'
  ]
  
  const filteredItems = items.filter(item => {
    let matchesSearch = true
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase()
      matchesSearch = Object.values(item).some(val => 
        val && typeof val === 'string' && val.toLowerCase().includes(lowerSearch)
      )
    }
    
    let matchesFilter = true
    if (filter) {
      matchesFilter = item.category === filter
    }
    
    let matchesDate = true
    if (dateRange.start && dateRange.end) {
      const dateStr = item.date_acquired || item.created_at
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

  const totalItems = filteredItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)

  const [isExportOpen, setIsExportOpen] = useState(false)
  const { currentPage, setCurrentPage, pageSize, setPageSize: handlePageSizeChange, totalPages, safePage, pagedRecords } = useListPagination(filteredItems)

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

  const handlePrintPDF = () => {
    printPDF({
      title: 'Inventory Report',
      subtitle: `${filteredItems.length} items`,
      columns: [
        { header: 'Item Name', key: 'item_name' },
        { header: 'Category', key: 'category' },
        { header: 'Quantity', key: 'quantity' },
        { header: 'Unit', key: 'unit' },
        { header: 'Status', key: 'serviceable', format: v => v !== false ? 'Serviceable' : 'Unserviceable' },
        { header: 'End User', key: 'end_user' },
        { header: 'Date Acquired', key: 'date_acquired', format: v => v ? format(new Date(v), 'MMM dd, yyyy') : '—' },
      ],
      records: filteredItems,
    })
  }

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading inventory...</p>
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
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading Inventory</h3>
          <p>{error}</p>
          <button 
            onClick={loadInventory}
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
          <i className="ri-archive-line" style={{ marginRight: '12px' }}></i>
          Inventory
        </h2>
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: (isAdmin || canCreate) ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Add Item
        </button>
      </div>

      {items.length > 0 && (
        <ModuleToolbar
          onSearch={setSearchTerm}
          onFilterChange={setFilter}
          onDateRangeChange={setDateRange}
          pageSize={pageSize}
          onPageSizeChange={handlePageSizeChange}
          onExportClick={() => setIsExportOpen(true)}
          onPrintClick={handlePrintPDF}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
          filterLabel="All Categories"
          filterMinWidth="320px"
          filterOptions={categories.map(cat => ({ label: cat, value: cat }))}
          filterColorMap={{
            'ICT AND AUDIO VISUAL EQUIPMENT': { bg: '#dbeafe', color: '#1e40af', icon: 'ri-computer-line' },
            'OFFICE SUPPLIES': { bg: '#e0e7ff', color: '#4338ca', icon: 'ri-file-paper-line' },
            'JANITORIAL SUPPLIES': { bg: '#fce7f3', color: '#9f1239', icon: 'ri-brush-line' },
            'MEDICAL SUPPLIES': { bg: '#dcfce7', color: '#166534', icon: 'ri-first-aid-kit-line' },
            'OXYGEN': { bg: '#ccfbf1', color: '#115e59', icon: 'ri-heart-pulse-line' },
            'PPE (WASAR, CSSR, EXTRICATION, HIGH ANGLE)': { bg: '#fef3c7', color: '#92400e', icon: 'ri-shield-line' },
            'RESCUE TOOLS (WASAR, CSSR, EXTRICATION, HIGH ANGLE)': { bg: '#fecaca', color: '#991b1b', icon: 'ri-tools-line' },
            'VEHICLES': { bg: '#ddd6fe', color: '#5b21b6', icon: 'ri-car-line' },
            'GENERATOR SET': { bg: '#fed7aa', color: '#9a3412', icon: 'ri-flashlight-line' },
            'AIRCONDITIONING': { bg: '#bfdbfe', color: '#1e3a8a', icon: 'ri-temp-cold-line' },
            'UMBRELLA': { bg: '#e9d5ff', color: '#6b21a8', icon: 'ri-umbrella-line' },
            'AM/FM RADIO': { bg: '#fecdd3', color: '#881337', icon: 'ri-radio-line' },
            'Early warning device/system': { bg: '#fed7aa', color: '#7c2d12', icon: 'ri-alarm-warning-line' },
            'Two way radio': { bg: '#d1fae5', color: '#065f46', icon: 'ri-wireless-charging-line' },
            'Command Center': { bg: '#f3e8ff', color: '#6b21a8', icon: 'ri-home-office-line' },
            'Other': { bg: '#f3f4f6', color: '#374151', icon: 'ri-more-line' },
          }}
        />
      )}

      {/* Summary cards */}
      {items.length > 0 && (() => {
        const cards = [
          { label: 'Total Items',    count: filteredItems.length,                                      icon: 'ri-archive-line',       accent: '#2563eb' },
          { label: 'Total Quantity', count: totalItems,                                                icon: 'ri-stack-line',         accent: '#0891b2' },
          { label: 'Serviceable',    count: filteredItems.filter(i => i.serviceable !== false).length, icon: 'ri-checkbox-circle-line', accent: '#16a34a' },
          { label: 'Unserviceable',  count: filteredItems.filter(i => i.serviceable === false).length, icon: 'ri-close-circle-line',  accent: '#dc2626' },
        ]
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
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

      {items.length === 0 ? (
        <div className="empty-state">
          <i className="ri-archive-line"></i>
          <h3>No Items Found</h3>
          <p>Click "Add Item" to add your first inventory item.</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="empty-state">
          <i className="ri-filter-off-line"></i>
          <h3>No Matching Records</h3>
          <p>Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="data-table">
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Item Name</th>
                <th style={{ width: '18%' }}>Category</th>
                <th style={{ width: '12%' }}>Quantity</th>
                <th style={{ width: '14%' }}>Status</th>
                <th style={{ width: '18%' }}>End User</th>
                <th style={{ width: '13%' }}>Date Acquired</th>
                
              </tr>
            </thead>
            <tbody>
              {pagedRecords.map((item) => (
                <tr 
                  key={item.id}
                  onClick={() => handleViewDetails(item)}
                  style={{ cursor: 'pointer', height: '49px' }}
                  className="table-row-clickable"
                >
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: '700' }}>{item.item_name || '-'}</span>
                      {item.created_by && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <i className="ri-user-line" style={{ fontSize: '12px' }}></i>
                          {item.created_by.split('@')[0]}
                          {item.updated_by && item.updated_by !== item.created_by && (
                            <span style={{ marginLeft: '6px', color: 'var(--text-muted)' }}>
                              • updated by: {item.updated_by.split('@')[0]}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
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
                      {item.category === 'Other' && item.category_other 
                        ? item.category_other 
                        : item.category || 'Uncategorized'}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '16px' }}>
                    {item.quantity || 0}
                  </td>
                  <td onClick={e => (isAdmin || canUpdate) ? e.stopPropagation() : undefined}>
                    {(isAdmin || canUpdate) ? (
                      <StatusSelect
                        value={item.serviceable !== false ? 'serviceable' : 'unserviceable'}
                        options={[
                          { value: 'serviceable',   label: 'Serviceable',   icon: 'ri-checkbox-circle-fill', bg: '#d1fae5', color: '#065f46' },
                          { value: 'unserviceable', label: 'Unserviceable', icon: 'ri-close-circle-fill',    bg: '#fee2e2', color: '#991b1b' },
                        ]}
                        onChange={v => handleServiceableChange(item.id, v === 'serviceable')}
                      />
                    ) : (
                      <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '700',
                        background: item.serviceable !== false ? '#d1fae5' : '#fee2e2',
                        color: item.serviceable !== false ? '#065f46' : '#991b1b' }}>
                        {item.serviceable !== false ? 'Serviceable' : 'Unserviceable'}
                      </span>
                    )}
                  </td>
                  <td>{item.end_user || '-'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                    {item.date_acquired 
                      ? format(new Date(item.date_acquired), 'MMM dd, yyyy')
                      : 'Not recorded'}
                  </td>
                </tr>
              ))}
              <TableGhostRows count={Math.max(0, pageSize - pagedRecords.length)} colSpan={6} />
            </tbody>
          </table>
        </div>
      )}

      <ListPagination
        currentPage={safePage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalRecords={filteredItems.length}
        onPageChange={setCurrentPage}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        records={items}
        filename="inventory_report.xlsx"
        sheetName="Inventory"
        dateField="date_acquired"
        transformValue={(col, val, record) => {
          if (col === 'category' && val === 'Other' && record.category_other) {
            return record.category_other
          }
          if (col === 'serviceable') return val !== false ? 'Serviceable' : 'Unserviceable'
          if (col === 'photos') {
            if (Array.isArray(val) && val.length > 0) {
              return val.join('\n')
            }
            return ''
          }
          return val
        }}
        onSuccess={(count) => toast.success(`Exported ${count} records.`)}
        onError={(msg) => toast.error(msg)}
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isViewing ? 'View Details' : (isEditing ? 'Edit Inventory Item' : 'Add Inventory Item')}
        maxWidth="1000px"
      >
        <style>{`
          .inventory-form-layout {
            display: flex;
            flex-wrap: wrap;
            gap: 32px;
          }
          .inventory-details-col {
            flex: 1 1 450px;
            min-width: 0;
          }
          .inventory-photos-col {
            flex: 1 1 350px;
            min-width: 0;
            border-left: 2px solid var(--border-light);
            padding-left: 32px;
          }
          @media (max-width: 1050px) {
            .inventory-form-layout {
              flex-direction: column;
              gap: 24px;
            }
            .inventory-photos-col {
              border-left: none;
              padding-left: 0;
              border-top: 2px solid var(--border-light);
              padding-top: 24px;
            }
          }
        `}</style>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="inventory-form-layout">

            {/* Left: Item Details */}
            <div className="inventory-details-col">
              <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                  <div className="form-row" style={{ gap: '12px' }}>
                    <div className="form-group">
                      <label>Category *</label>
                      <select name="category" value={formData.category} onChange={handleInputChange} required style={{ padding: '8px' }}>
                        <option value="">-- Select Category --</option>
                        <option value="ICT AND AUDIO VISUAL EQUIPMENT">ICT AND AUDIO VISUAL EQUIPMENT</option>
                        <option value="OFFICE SUPPLIES">OFFICE SUPPLIES</option>
                        <option value="JANITORIAL SUPPLIES">JANITORIAL SUPPLIES</option>
                        <option value="MEDICAL SUPPLIES">MEDICAL SUPPLIES</option>
                        <option value="OXYGEN">OXYGEN</option>
                        <option value="PPE (WASAR, CSSR, EXTRICATION, HIGH ANGLE)">PPE (WASAR, CSSR, EXTRICATION, HIGH ANGLE)</option>
                        <option value="RESCUE TOOLS (WASAR, CSSR, EXTRICATION, HIGH ANGLE)">RESCUE TOOLS (WASAR, CSSR, EXTRICATION, HIGH ANGLE)</option>
                        <option value="VEHICLES">VEHICLES</option>
                        <option value="GENERATOR SET">GENERATOR SET</option>
                        <option value="AIRCONDITIONING">AIRCONDITIONING</option>
                        <option value="UMBRELLA">UMBRELLA</option>
                        <option value="AM/FM RADIO">AM/FM RADIO</option>
                        <option value="Early warning device/system">Early warning device/system</option>
                        <option value="Two way radio">Two way radio</option>
                        <option value="Command Center">Command Center</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    {formData.category === 'Other' && (
                      <div className="form-group">
                        <label>Specify Category *</label>
                        <input type="text" name="category_other" value={formData.category_other} onChange={handleInputChange} required placeholder="Specify category" style={{ padding: '8px' }} />
                      </div>
                    )}
                  </div>

                  <div className="form-row" style={{ gap: '12px' }}>
                    <div className="form-group" style={{ flex: 2 }}>
                      <label>Item Name *</label>
                      <input type="text" name="item_name" value={formData.item_name} onChange={handleInputChange} required placeholder="e.g. VHF Handheld Radio, Rescue Rope" style={{ padding: '8px' }} />
                    </div>
                    <div className="form-group">
                      <label>Condition *</label>
                      <select name="condition" value={formData.condition} onChange={handleInputChange} required style={{ padding: '8px' }}>
                        <option value="New">New</option>
                        <option value="Good">Good</option>
                        <option value="Fair">Fair</option>
                        <option value="Poor">Poor</option>
                        <option value="Damaged">Damaged</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row" style={{ gap: '12px' }}>
                    <div className="form-group">
                      <label>Stock Number</label>
                      <input type="text" name="stock_number" value={formData.stock_number} onChange={handleInputChange} style={{ padding: '8px' }} />
                    </div>
                    <div className="form-group">
                      <label>Property No.</label>
                      <input type="text" name="property_no" value={formData.property_no} onChange={handleInputChange} style={{ padding: '8px' }} />
                    </div>
                  </div>

                  <div className="form-row" style={{ gap: '12px' }}>
                    <div className="form-group">
                      <label>Serial No.</label>
                      <input type="text" name="serial_no" value={formData.serial_no} onChange={handleInputChange} style={{ padding: '8px' }} />
                    </div>
                    <div className="form-group">
                      <label>Fund Cluster</label>
                      <input type="text" name="fund_cluster" value={formData.fund_cluster} onChange={handleInputChange} placeholder="e.g. General Fund" style={{ padding: '8px' }} />
                    </div>
                  </div>

                  <div className="form-row" style={{ gap: '12px' }}>
                    <div className="form-group">
                      <label>Property Custodian</label>
                      <input type="text" name="property_custodian" value={formData.property_custodian} onChange={handleInputChange} style={{ padding: '8px' }} />
                    </div>
                    <div className="form-group">
                      <label>End User / Recipient</label>
                      <input type="text" name="end_user" value={formData.end_user} onChange={handleInputChange} placeholder="e.g. Rescue Team Alpha" style={{ padding: '8px' }} />
                    </div>
                  </div>

                  <div className="form-row" style={{ gap: '12px' }}>
                    <div className="form-group">
                      <label>Quantity *</label>
                      <input type="number" name="quantity" value={formData.quantity} onChange={handleInputChange} required placeholder="0" style={{ padding: '8px' }} />
                    </div>
                    <div className="form-group">
                      <label>Unit *</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {/* Show text input for custom unit first */}
                        {(formData.unit === '__other__' || (formData.unit !== '' && !['pcs','sets','boxes','packs','rolls','pairs','bottles','bags','units','liters','meters','sheets','kits','drums','cans','bundles','sacks','coils','gallons'].includes(formData.unit))) && (
                          <div style={{ flex: '1' }}>
                            <input
                              type="text"
                              name="unit"
                              value={formData.unit === '__other__' ? '' : formData.unit}
                              onChange={handleInputChange}
                              placeholder="Specify unit..."
                              required
                              autoFocus
                              style={{ padding: '8px', width: '100%' }}
                            />
                          </div>
                        )}
                        <div style={{ flex: (formData.unit === '__other__' || (formData.unit !== '' && !['pcs','sets','boxes','packs','rolls','pairs','bottles','bags','units','liters','meters','sheets','kits','drums','cans','bundles','sacks','coils','gallons'].includes(formData.unit))) ? '1' : '1' }}>
                          <ScrollableSelect
                            value={['pcs','sets','boxes','packs','rolls','pairs','bottles','bags','units','liters','meters','sheets','kits','drums','cans','bundles','sacks','coils','gallons'].includes(formData.unit) ? formData.unit : (formData.unit ? 'other' : '')}
                            options={[
                              { value: 'pcs',     label: 'pcs (pieces)' },
                              { value: 'sets',    label: 'sets' },
                              { value: 'boxes',   label: 'boxes' },
                              { value: 'packs',   label: 'packs' },
                              { value: 'rolls',   label: 'rolls' },
                              { value: 'pairs',   label: 'pairs' },
                              { value: 'bottles', label: 'bottles' },
                              { value: 'bags',    label: 'bags' },
                              { value: 'units',   label: 'units' },
                              { value: 'liters',  label: 'liters' },
                              { value: 'meters',  label: 'meters' },
                              { value: 'sheets',  label: 'sheets' },
                              { value: 'kits',    label: 'kits' },
                              { value: 'drums',   label: 'drums' },
                              { value: 'cans',    label: 'cans' },
                              { value: 'bundles', label: 'bundles' },
                              { value: 'sacks',   label: 'sacks' },
                              { value: 'coils',   label: 'coils' },
                              { value: 'gallons', label: 'gallons' },
                              { value: 'other',   label: 'Other' },
                            ]}
                            onChange={v => {
                              if (v === 'other') {
                                handleInputChange({ target: { name: 'unit', value: '__other__' } })
                              } else {
                                handleInputChange({ target: { name: 'unit', value: v } })
                              }
                            }}
                            placeholder="-- Select Unit --"
                            required
                            visibleCount={5}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="form-row" style={{ gap: '12px' }}>
                    <div className="form-group">
                      <label>Acquisition Cost</label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input 
                          type="number" 
                          step="0.01" 
                          name="acquisition_cost" 
                          value={formData.acquisition_cost} 
                          onChange={handleInputChange} 
                          placeholder="0.00" 
                          style={{ padding: '8px 50px 8px 8px', width: '100%' }} 
                        />
                        <span style={{
                          position: 'absolute',
                          right: '10px',
                          fontSize: '13px',
                          fontWeight: '700',
                          color: 'var(--text-muted)',
                          pointerEvents: 'none',
                          userSelect: 'none'
                        }}>PHP</span>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Date Acquired *</label>
                      <input max={new Date().toISOString().split('T')[0]} type="date" name="date_acquired" value={formData.date_acquired} onChange={handleInputChange} required style={{ padding: '8px' }} />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>Estimated Useful Life</label>
                    <input type="text" name="estimated_life" value={formData.estimated_life} onChange={handleInputChange} placeholder="e.g. 5 Years" style={{ padding: '8px' }} />
                  </div>

                  <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
                    <input type="checkbox" id="serviceable" name="serviceable" checked={formData.serviceable} onChange={handleInputChange} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                    <label htmlFor="serviceable" style={{ marginBottom: 0, fontWeight: '700', cursor: 'pointer' }}>Serviceable</label>
                  </div>

                  <div className="form-group">
                    <label>Remarks</label>
                    <textarea name="remarks" value={formData.remarks} onChange={handleInputChange} rows={2} style={{ padding: '8px' }}></textarea>
                  </div>

                </div>
              </fieldset>
            </div>

            {/* Right: Photos */}
            <div className="inventory-photos-col">
              <PhotoUploadPanel
                title="Item Photos"
                emptyMessage="No photos uploaded for this item yet."
                photos={formData.photos}
                pendingPhotos={pendingPhotos}
                isViewing={isViewing}
                isUploading={isUploading}
                isSaving={isSaving}
                onFileUpload={handleFileUpload}
                onRemoveExisting={removeExistingPhoto}
                onRemovePending={removePendingPhoto}
              />
            </div>

          </div>

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
            {isViewing && (formData.created_by || formData.updated_by) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                {formData.created_by && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="ri-user-add-line" style={{ fontSize: '14px', color: 'var(--primary)' }}></i>
                    <span>Encoded by: <strong style={{ color: 'var(--text)' }}>{formData.created_by.split('@')[0]}</strong> {formData.created_at && <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>({format(new Date(formData.created_at), 'MMM d, h:mm a')})</span>}</span>
                  </div>
                )}
                {formData.updated_by && formData.updated_by !== formData.created_by && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="ri-edit-line" style={{ fontSize: '14px', color: 'var(--primary)' }}></i>
                    <span>Updated by: <strong style={{ color: 'var(--text)' }}>{formData.updated_by.split('@')[0]}</strong> {formData.updated_at && <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>({format(new Date(formData.updated_at), 'MMM d, h:mm a')})</span>}</span>
                  </div>
                )}
              </div>
            ) : (
              <div></div>
            )}
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
