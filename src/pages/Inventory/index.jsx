import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { format } from 'date-fns'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'

const INITIAL_FORM_STATE = {
  record_id: '',
  item_name: '',
  category: '',
  quantity: '',
  condition: 'Good',
  date_acquired: ''
}

export default function Inventory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('All')

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState(INITIAL_FORM_STATE)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const isAdmin = useIsAdmin()
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

  const handleOpenAdd = () => {
    setIsEditing(false)
    setSelectedId(null)
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
    setSelectedId(item.id)
    setFormData({
      record_id: item.record_id || '',
      item_name: item.item_name || '',
      category: item.category || '',
      quantity: item.quantity || '',
      condition: item.condition || 'Good',
      date_acquired: item.date_acquired || ''
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
        quantity: parseInt(formData.quantity)
      }

      if (isEditing) {
        const { data, error } = await supabase
          .from('inventory')
          .update(payload)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setItems(items.map(item => item.id === selectedId ? data[0] : item))
        toast.success('Item updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('inventory')
          .insert([payload])
          .select()

        if (error) throw error
        setItems([data[0], ...items])
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
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setItems(items.filter(item => item.id !== id))
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

  const categories = ['All', ...new Set(items.map(item => item.category).filter(Boolean))]
  const filteredItems = filter === 'All' ? items : items.filter(item => item.category === filter)
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
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: isAdmin ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Add Item
        </button>
      </div>

      {/* Category Filter */}
      {categories.length > 1 && (
        <div style={{ marginBottom: '24px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-light)',
                background: filter === cat ? 'var(--primary)' : 'var(--bg-surface)',
                color: filter === cat ? '#fff' : 'var(--text-main)',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {cat}
            </button>
          ))}
        </div>
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
                <th>Condition</th>
                <th>Date Acquired</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id}>
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
                  <td>{getConditionBadge(item.condition)}</td>
                  <td>
                    {item.date_acquired 
                      ? format(new Date(item.date_acquired), 'MMM dd, yyyy')
                      : 'Not recorded'}
                  </td>
                  {isAdmin && (
                  <td>
                    <div className="table-actions">
                      <button 
                        className="btn-icon btn-edit"
                        onClick={() => handleOpenEdit(item)}
                        title="Edit"
                      >
                        <i className="ri-pencil-line"></i>
                      </button>
                      <button 
                        className="btn-icon btn-delete"
                        onClick={() => handleDelete(item.id)}
                        title="Delete"
                      >
                        <i className="ri-delete-bin-line"></i>
                      </button>
                    </div>
                  </td>
                  )}
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
        title={isEditing ? 'Edit Inventory Item' : 'Add Inventory Item'}
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-row">
            <div className="form-group">
              <label>Record ID *</label>
              <input 
                type="text" 
                name="record_id" 
                value={formData.record_id} 
                onChange={handleInputChange} 
                required 
               disabled style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280' }} />
            </div>
            <div className="form-group">
              <label>Item Name *</label>
              <input 
                type="text" 
                name="item_name" 
                value={formData.item_name} 
                onChange={handleInputChange} 
                required 
                placeholder="e.g. VHF Handheld Radio, Rescue Rope"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Category *</label>
              <input 
                type="text" 
                name="category" 
                value={formData.category} 
                onChange={handleInputChange} 
                required 
                placeholder="e.g. Communications, Rescue Gear"
              />
            </div>
            <div className="form-group">
              <label>Quantity *</label>
              <input 
                type="number" 
                name="quantity" 
                value={formData.quantity} 
                onChange={handleInputChange} 
                required 
                placeholder="0"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Condition *</label>
              <select name="condition" value={formData.condition} onChange={handleInputChange} required>
                <option value="New">New</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
                <option value="Damaged">Damaged</option>
              </select>
            </div>
            <div className="form-group">
              <label>Date Acquired *</label>
              <input 
                type="date" 
                name="date_acquired" 
                value={formData.date_acquired} 
                onChange={handleInputChange} 
                required 
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
