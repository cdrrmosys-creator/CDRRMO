import ModuleToolbar from '../../components/ModuleToolbar'
import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { logAudit } from '../../services/audit'
import { format } from 'date-fns'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'

const INITIAL_FORM_STATE = {
  record_id: '',
  beneficiary_name: '',
  amount: '',
  purpose: '',
  date: '',
  status: 'Pending',
  has_insurance: false,
  insurance_number: '',
  insurance_id: ''
}

export default function Vouchers() {
  const [vouchers, setVouchers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isViewing, setIsViewing] = useState(false)
  const [formData, setFormData] = useState(INITIAL_FORM_STATE)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const isAdmin = useIsAdmin()
  const toast = useToast()
  const confirm = useConfirm()

  // Toolbar states
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  useEffect(() => {
    loadVouchers()
  }, [])

  const filteredRecords = vouchers.filter(item => {
    let matchesSearch = true
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase()
      matchesSearch = Object.values(item).some(val => 
        val && typeof val === 'string' && val.toLowerCase().includes(lowerSearch)
      )
    }
    
    let matchesFilter = true
    
    let matchesDate = true
    if (dateRange.start && dateRange.end) {
      const dateStr = item.date_time || item.created_at || item.date || item.start_date
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

  const handleViewDetails = (rec) => {
    handleOpenEdit(rec)
    setIsViewing(true)
  }

  const handleEditFromView = () => {
    setIsViewing(false)
  }

  const handleDeleteFromView = async () => {
    const idToDelete = selectedId
    setIsModalOpen(false)
    await handleDelete(idToDelete)
  }

  const handleOpenAdd = () => {
    setIsEditing(false)
    setIsViewing(false)
    setSelectedId(null)
    const year = new Date().getFullYear()
    const rand = Math.floor(1000 + Math.random() * 9000)
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
    setIsViewing(false)
    setSelectedId(v.id)
    setFormData({
      record_id: v.record_id || '',
      beneficiary_name: v.beneficiary_name || '',
      amount: v.amount || '',
      purpose: v.purpose || '',
      date: v.date || '',
      status: v.status || 'Pending',
      has_insurance: v.has_insurance || false,
      insurance_number: v.insurance_number || '',
      insurance_id: v.insurance_id || ''
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        insurance_number: formData.has_insurance ? formData.insurance_number : null,
        insurance_id: formData.has_insurance ? formData.insurance_id : null
      }

      if (isEditing) {
        const { data, error } = await supabase
          .from('vouchers')
          .update(payload)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setVouchers(vouchers.map(v => v.id === selectedId ? data[0] : v))
        await logAudit('Updated', 'Vouchers', formData.record_id || selectedId, 'Updated record details')
        toast.success('Voucher updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('vouchers')
          .insert([payload])
          .select()

        if (error) throw error
        setVouchers([data[0], ...vouchers])
        await logAudit('Added', 'Vouchers', formData.record_id || data[0].record_id || data[0].id, 'Created new record')
        toast.success('Voucher created successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving voucher:', err)
      toast.error('Error saving voucher: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This voucher will be permanently removed. This action cannot be undone.', { title: 'Delete Record' })
    if (!ok) return

    try {
      const { error } = await supabase
        .from('vouchers')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setVouchers(vouchers.filter(v => v.id !== id))
      await logAudit('Deleted', 'Vouchers', id, 'Deleted record')
      toast.success('Voucher deleted successfully!')
    } catch (err) {
      console.error('Error deleting voucher:', err)
      toast.error('Failed to delete voucher: ' + err.message)
    }
  }

  const handleStatusChange = async (e, id) => {
    e.stopPropagation()
    const newStatus = e.target.value
    
    try {
      const { error } = await supabase
        .from('vouchers')
        .update({ status: newStatus })
        .eq('id', id)

      if (error) throw error

      setVouchers(vouchers.map(v => v.id === id ? { ...v, status: newStatus } : v))
      toast.success('Status updated successfully!')
      await logAudit('Updated', 'Vouchers', id, `Updated status to ${newStatus}`)
    } catch (err) {
      console.error('Error updating status:', err)
      toast.error('Failed to update status: ' + err.message)
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

      {vouchers.length > 0 && (
        <ModuleToolbar 
          onSearch={setSearchTerm}
          onFilterChange={setFilter}
          onDateRangeChange={setDateRange}
          exportData={filteredRecords}
          exportFilename="vouchers_report.xlsx"
        />
      )}

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
                <th>Insurance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((voucher) => (
                <tr 
                  key={voucher.id}
                  onClick={() => handleViewDetails(voucher)}
                  style={{ cursor: 'pointer' }}
                  className="table-row-clickable"
                >
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
                  <td>
                    {voucher.has_insurance ? (
                      <span style={{ padding: '4px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', background: '#dbeafe', color: '#1e40af' }}>
                        With Insurance
                      </span>
                    ) : (
                      <span style={{ padding: '4px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', background: '#f3f4f6', color: '#4b5563' }}>
                        Without Insurance
                      </span>
                    )}
                  </td>
                  <td onClick={(e) => isAdmin ? e.stopPropagation() : undefined}>
                    {isAdmin ? (
                      <select 
                        value={voucher.status || 'Pending'}
                        onChange={(e) => handleStatusChange(e, voucher.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '700',
                          border: '1px solid var(--border-light)',
                          background: voucher.status === 'Approved' ? '#d1fae5' :
                                      voucher.status === 'Paid' ? '#dbeafe' :
                                      voucher.status === 'Rejected' ? '#fee2e2' : '#fef3c7',
                          color: voucher.status === 'Approved' ? '#065f46' :
                                 voucher.status === 'Paid' ? '#1e40af' :
                                 voucher.status === 'Rejected' ? '#991b1b' : '#92400e',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Approved">Approved</option>
                        <option value="Paid">Paid</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    ) : (
                      getStatusBadge(voucher.status)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{
        marginTop: '16px',
        fontSize: '14px',
        color: 'var(--text-muted)',
        textAlign: 'center'
      }}>
        Showing <strong>{filteredRecords.length}</strong> of <strong>{vouchers.length}</strong>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isViewing ? 'View Voucher Details' : (isEditing ? 'Edit Voucher Record' : 'Create Voucher Record')}
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
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

          <div style={{
            background: 'var(--bg-app)',
            border: '1px solid var(--border-light)',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px',
            marginTop: '8px'
          }}>
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', padding: formData.has_insurance ? '0 0 16px 0' : '0', marginBottom: formData.has_insurance ? '16px' : '0', borderBottom: formData.has_insurance ? '1px solid var(--border-light)' : 'none' }}>
              <input 
                type="checkbox" 
                id="has_insurance" 
                name="has_insurance" 
                checked={formData.has_insurance} 
                onChange={handleInputChange} 
                style={{ width: '16px', height: '16px', cursor: 'pointer' }} 
              />
              <label htmlFor="has_insurance" style={{ marginBottom: 0, fontWeight: '700', cursor: 'pointer', color: 'var(--text)' }}>With Insurance</label>
            </div>

            {formData.has_insurance && (
              <div className="form-row" style={{ marginBottom: 0 }}>
                <div className="form-group">
                  <label>Insurance Number *</label>
                  <input 
                    type="text" 
                    name="insurance_number" 
                    value={formData.insurance_number} 
                    onChange={handleInputChange} 
                    required={formData.has_insurance} 
                    placeholder="Enter Insurance Number"
                    style={{ background: 'var(--bg-surface)' }}
                  />
                </div>
                <div className="form-group">
                  <label>Insurance ID *</label>
                  <input 
                    type="text" 
                    name="insurance_id" 
                    value={formData.insurance_id} 
                    onChange={handleInputChange} 
                    required={formData.has_insurance} 
                    placeholder="Enter Insurance ID"
                    style={{ background: 'var(--bg-surface)' }}
                  />
                </div>
              </div>
            )}
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

          </fieldset>

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div></div>
            {isViewing ? (
              <div style={{ display: 'flex', gap: '12px' }}>
                {isAdmin && (
                  <>
                    <button 
                      type="button"
                      className="btn-delete"
                      onClick={handleDeleteFromView}
                      style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      <i className="ri-delete-bin-line" style={{ marginRight: '6px' }}></i> Delete
                    </button>
                    <button 
                      type="button"
                      className="btn-submit"
                      onClick={handleEditFromView}
                      style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}
                    >
                      <i className="ri-pencil-line" style={{ marginRight: '6px' }}></i> Edit
                    </button>
                  </>
                )}
                {!isAdmin && (
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
