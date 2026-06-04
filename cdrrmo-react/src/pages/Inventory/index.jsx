import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { format } from 'date-fns'

export default function Inventory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('All')

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

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setItems(items.filter(item => item.id !== id))
    } catch (err) {
      console.error('Error deleting item:', err)
      alert('Failed to delete item: ' + err.message)
    }
  }

  const getConditionBadge = (condition) => {
    const colors = {
      'Excellent': { bg: '#d1fae5', color: '#065f46' },
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
        <button className="btn-add" onClick={() => alert('Add Item modal - Coming soon!')}>
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
                <th>Item Name</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Condition</th>
                <th>Date Acquired</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id}>
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
                  <td style={{ fontSize: '13px' }}>
                    {item.date_acquired 
                      ? format(new Date(item.date_acquired), 'MMM dd, yyyy')
                      : 'Not recorded'}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button 
                        className="btn-icon btn-edit"
                        onClick={() => alert('Edit item - Coming soon!')}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
