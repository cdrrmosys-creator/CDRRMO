import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { logAudit } from '../../services/audit'
import { uploadFile, deleteFiles } from '../../services/storage'
import { compressImage } from '../../utils/imageCompression'
import { format } from 'date-fns'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'
import ModuleToolbar from '../../components/ModuleToolbar'

const INITIAL_FORM_STATE = {
  record_id: '',
  stock_number: '',
  property_no: '',
  serial_no: '',
  item_name: '',
  category: '',
  quantity: '',
  unit: '',
  condition: 'Good',
  acquisition_cost: '',
  date_acquired: '',
  property_custodian: '',
  serviceable: true,
  remarks: '',
  photos: []
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
  const [isDragging, setIsDragging] = useState(false)
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

  const handleOpenEdit = (item) => {
    setIsEditing(true)
    setIsViewing(false)
    setSelectedId(item.id)
    setPendingPhotos([])
    setFormData({
      record_id: item.record_id || '',
      stock_number: item.stock_number || '',
      property_no: item.property_no || '',
      serial_no: item.serial_no || '',
      item_name: item.item_name || '',
      category: item.category || '',
      quantity: item.quantity || '',
      unit: item.unit || '',
      condition: item.condition || 'Good',
      acquisition_cost: item.acquisition_cost || '',
      date_acquired: item.date_acquired || '',
      property_custodian: item.property_custodian || '',
      serviceable: item.serviceable !== false, // default true
      remarks: item.remarks || '',
      photos: item.photos || []
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

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files)
    if (!files || files.length === 0) return
    setPendingPhotos(prev => [...prev, ...files])
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

  const handleDrop = (e) => {
    if (isViewing) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload({ target: { files: e.dataTransfer.files } });
    }
  };

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

  const categories = [...new Set(items.map(item => item.category).filter(Boolean))]
  
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
          exportData={filteredItems}
          exportFilename="inventory_report.xlsx"
          filterOptions={categories.map(cat => ({ label: cat, value: cat }))}
        />
      )}

      {/* Summary */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        marginBottom: '24px',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        gap: '32px'
      }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Items ({filter})
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary)' }}>
            {filteredItems.length}
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Total Quantity
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#16a34a' }}>
            {totalItems}
          </div>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="empty-state">
          <i className="ri-archive-line"></i>
          <h3>No Items Found</h3>
          <p>Click "Add Item" to add your first inventory item.</p>
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Item Name</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Status</th>
                <th>Date Acquired</th>
                
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr 
                  key={item.id}
                  onClick={() => handleViewDetails(item)}
                  style={{ cursor: 'pointer' }}
                  className="table-row-clickable"
                >
                  <td><code style={{ fontWeight: '700' }}>{item.record_id || '-'}</code></td>
                  <td style={{ fontWeight: '700' }}>{item.item_name || '-'}</td>
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
                      {item.category || 'Uncategorized'}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '16px' }}>
                    {item.quantity || 0}
                  </td>
                  <td>{item.serviceable !== false ? (
                    <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', background: '#d1fae5', color: '#065f46' }}>Serviceable</span>
                  ) : (
                    <span style={{ padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', background: '#fee2e2', color: '#991b1b' }}>Not Serviceable</span>
                  )}</td>
                  <td>
                    {item.date_acquired 
                      ? format(new Date(item.date_acquired), 'MMM dd, yyyy')
                      : 'Not recorded'}
                  </td>
                  
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Record ID *</label>
                      <input type="text" name="record_id" value={formData.record_id} onChange={handleInputChange} required disabled style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280', padding: '8px' }} />
                    </div>
                    <div className="form-group" style={{ flex: 2 }}>
                      <label>Item Name *</label>
                      <input type="text" name="item_name" value={formData.item_name} onChange={handleInputChange} required placeholder="e.g. VHF Handheld Radio, Rescue Rope" style={{ padding: '8px' }} />
                    </div>
                  </div>

                  <div className="form-row" style={{ gap: '12px' }}>
                    <div className="form-group">
                      <label>Category *</label>
                      <input type="text" name="category" value={formData.category} onChange={handleInputChange} required placeholder="e.g. Communications, Rescue Gear" style={{ padding: '8px' }} />
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
                      <label>Property Custodian</label>
                      <input type="text" name="property_custodian" value={formData.property_custodian} onChange={handleInputChange} style={{ padding: '8px' }} />
                    </div>
                  </div>

                  <div className="form-row" style={{ gap: '12px' }}>
                    <div className="form-group">
                      <label>Quantity *</label>
                      <input type="number" name="quantity" value={formData.quantity} onChange={handleInputChange} required placeholder="0" style={{ padding: '8px' }} />
                    </div>
                    <div className="form-group">
                      <label>Unit *</label>
                      <input type="text" name="unit" value={formData.unit} onChange={handleInputChange} placeholder="e.g. pcs, boxes" required style={{ padding: '8px' }} />
                    </div>
                  </div>

                  <div className="form-row" style={{ gap: '12px' }}>
                    <div className="form-group">
                      <label>Acquisition Cost</label>
                      <input type="number" name="acquisition_cost" value={formData.acquisition_cost} onChange={handleInputChange} step="0.01" min="0" placeholder="0.00" style={{ padding: '8px' }} />
                    </div>
                    <div className="form-group">
                      <label>Date Acquired *</label>
                      <input type="date" name="date_acquired" value={formData.date_acquired} onChange={handleInputChange} required style={{ padding: '8px' }} />
                    </div>
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
              <div style={{ minHeight: '350px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <h4 style={{ margin: '0 0 12px 0', color: 'var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Item Photos
                  {!isViewing && (
                    <div style={{ position: 'relative' }}>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
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
                        {(isUploading || isSaving) ? <i className="ri-loader-4-line ri-spin" style={{ fontSize: '16px' }}></i> : <i className="ri-camera-line" style={{ fontSize: '16px' }}></i>}
                        {(isUploading || isSaving) ? 'Uploading...' : 'Add Photos'}
                      </button>
                    </div>
                  )}
                </h4>

                {(!formData.photos || formData.photos.length === 0) && pendingPhotos.length === 0 ? (
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
                      background: isDragging ? 'var(--primary-bg)' : '#f8fafc',
                      borderRadius: '8px',
                      border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border-light)'}`,
                      color: isDragging ? 'var(--primary)' : 'var(--text-muted)',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}
                  >
                    {!isViewing && (
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileUpload}
                        disabled={isUploading || isSaving}
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: isDragging ? 'copy' : 'pointer', zIndex: 10 }}
                      />
                    )}
                    <i className="ri-image-line" style={{ fontSize: '48px', color: isDragging ? 'var(--primary)' : 'var(--border-light)', transition: 'all 0.2s' }}></i>
                    <p style={{ marginTop: '12px', fontWeight: '600' }}>{isDragging ? 'Drop photos here' : 'No photos uploaded for this item yet.'}</p>
                    {!isViewing && <p style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>Drag and drop or click to upload</p>}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
                    {/* Existing Photos */}
                    {formData.photos && formData.photos.map((url, idx) => (
                      <div key={`existing-${idx}`} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt={`Item photo ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </a>
                        {!isViewing && (
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); removeExistingPhoto(idx); }}
                            style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                            title="Remove photo"
                          >
                            <i className="ri-close-line" style={{ fontSize: '14px' }}></i>
                          </button>
                        )}
                      </div>
                    ))}
                    {/* Pending Photos */}
                    {pendingPhotos.map((file, idx) => {
                      const objectUrl = URL.createObjectURL(file);
                      return (
                        <div key={`pending-${idx}`} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--primary)', opacity: isUploading ? 0.6 : 1 }}>
                          <img src={objectUrl} alt={`Pending ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onLoad={() => URL.revokeObjectURL(objectUrl)} />
                          {!isViewing && !isUploading && (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); removePendingPhoto(idx); }}
                              style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                            >
                              <i className="ri-close-line" style={{ fontSize: '14px' }}></i>
                            </button>
                          )}
                          {isUploading && (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', color: 'white' }}>
                              <i className="ri-loader-4-line ri-spin" style={{ fontSize: '24px' }}></i>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
