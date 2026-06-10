import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { format } from 'date-fns'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'

const INITIAL_FORM_STATE = {
  record_id: '',
  beneficiary_name: '',
  amount: '',
  purpose: '',
  date: '',
  status: 'Pending'
}

export default function Vouchers() {
  const [vouchers, setVouchers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [formData, setFormData] = useState(INITIAL_FORM_STATE)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const isAdmin = useIsAdmin()

  useEffect(() => {
    loadVouchers()
  }, [])

  const loadVouchers = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('vouchers')
        .select('*')
        .order('date', { ascending: false })
      
      if (error) throw error
      setVouchers(data || [])
    } catch (err) {
      console.error('Error loading vouchers:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenAdd = () => {
    setIsEditing(false)
    setSelectedId(null)
    // Generate voucher ID
    const year = new Date().getFullYear()
    const rand = Math.floor(1000 + Math.random() * 9000)
    // Local date string (YYYY-MM-DD)
    const todayStr = new Date().toISOString().split('T')[0]
    
    setFormData({
      ...INITIAL_FORM_STATE,
      record_id: `VOU-${year}-${rand}`,
      date: todayStr
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (v) => {
    setIsEditing(true)
    setSelectedId(v.id)
    setFormData({
      record_id: v.record_id || '',
      beneficiary_name: v.beneficiary_name || '',
      amount: v.amount || '',
      purpose: v.purpose || '',
      date: v.date || '',
      status: v.status || 'Pending'
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
        amount: parseFloat(formData.amount)
      }

      if (isEditing) {
        const { data, error } = await supabase
          .from('vouchers')
          .update(payload)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setVouchers(vouchers.map(v => v.id === selectedId ? data[0] : v))
        alert('Voucher updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('vouchers')
          .insert([payload])
          .select()

        if (error) throw error
        setVouchers([data[0], ...vouchers])
        alert('Voucher created successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving voucher:', err)
      alert('Error saving voucher: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this voucher?')) return

    try {
      const { error } = await supabase
        .from('vouchers')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setVouchers(vouchers.filter(v => v.id !== id))
    } catch (err) {
      console.error('Error deleting voucher:', err)
      alert('Failed to delete voucher: ' + err.message)
    }
  }

  const getStatusBadge = (status) => {
    const colors = {
      'Pending': { bg: '#fef3c7', color: '#92400e' },
      'Approved': { bg: '#d1fae5', color: '#065f46' },
      'Paid': { bg: '#dbeafe', color: '#1e40af' },
      'Rejected': { bg: '#fee2e2', color: '#991b1b' }
    }
    const style = colors[status] || colors['Pending']
    
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
        {status || 'Pending'}
      </span>
    )
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount || 0)
  }

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading vouchers...</p>
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
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading Vouchers</h3>
          <p>{error}</p>
          <button 
            onClick={loadVouchers}
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

  const totalAmount = vouchers.reduce((sum, v) => sum + (Number(v.amount) || 0), 0)

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="ri-file-text-line" style={{ marginRight: '12px' }}></i>
          Vouchers
        </h2>
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: isAdmin ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Create Voucher
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Total Vouchers
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--primary)' }}>
            {vouchers.length}
          </div>
        </div>
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Total Amount
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#16a34a' }}>
            {formatCurrency(totalAmount)}
          </div>
        </div>
      </div>

      {vouchers.length === 0 ? (
        <div className="empty-state">
          <i className="ri-file-text-line"></i>
          <h3>No Vouchers Found</h3>
          <p>Click "Create Voucher" to add your first voucher.</p>
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Date</th>
                <th>Beneficiary</th>
                <th>Purpose</th>
                <th>Amount</th>
                <th>Status</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {vouchers.map((voucher) => (
                <tr key={voucher.id}>
                  <td><code style={{ fontWeight: '700' }}>{voucher.record_id || '-'}</code></td>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                    {voucher.date 
                      ? format(new Date(voucher.date), 'MMM dd, yyyy')
                      : '-'}
                  </td>
                  <td style={{ fontWeight: '700' }}>{voucher.beneficiary_name || '-'}</td>
                  <td>
                    <div style={{
                      maxWidth: '250px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '13px'
                    }}>
                      {voucher.purpose || '-'}
                    </div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontWeight: '700', color: '#16a34a' }}>
                    {formatCurrency(voucher.amount)}
                  </td>
                  <td>{getStatusBadge(voucher.status)}</td>
                  {isAdmin && (
                  <td>
                    <div className="table-actions">
                      <button 
                        className="btn-icon btn-edit"
                        onClick={() => handleOpenEdit(voucher)}
                        title="Edit"
                      >
                        <i className="ri-pencil-line"></i>
                      </button>
                      <button 
                        className="btn-icon btn-delete"
                        onClick={() => handleDelete(voucher.id)}
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
        title={isEditing ? 'Edit Voucher Record' : 'Create Voucher Record'}
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
              <label>Beneficiary Name *</label>
              <input 
                type="text" 
                name="beneficiary_name" 
                value={formData.beneficiary_name} 
                onChange={handleInputChange} 
                required 
                placeholder="Name of recipient"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Amount (PHP) *</label>
              <input 
                type="number" 
                step="0.01"
                name="amount" 
                value={formData.amount} 
                onChange={handleInputChange} 
                required 
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label>Date *</label>
              <input 
                type="date" 
                name="date" 
                value={formData.date} 
                onChange={handleInputChange} 
                required 
              />
            </div>
          </div>

          <div className="form-group">
            <label>Status *</label>
            <select name="status" value={formData.status} onChange={handleInputChange} required>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Paid">Paid</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="form-group">
            <label>Purpose *</label>
            <textarea 
              name="purpose" 
              value={formData.purpose} 
              onChange={handleInputChange} 
              required 
              rows={3} 
              placeholder="State the purpose of this voucher..."
            />
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
