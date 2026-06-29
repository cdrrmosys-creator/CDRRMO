import ModuleToolbar from '../../components/ModuleToolbar'
import ListPagination from '../../components/ListPagination'
import ExportModal from '../../components/ExportModal'
import TableGhostRows from '../../components/TableGhostRows'
import useListPagination from '../../hooks/useListPagination'
import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { logAudit } from '../../services/audit'
import { format } from 'date-fns'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { usePermissions } from '../../hooks/usePermissions'
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
  insurance_id: '',
  payee: '',
  particular: '',
  check_number: '',
  or_number: '',
  account_code: '',
  bank_name: ''
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
  const { canCreate, canUpdate, canDelete } = usePermissions('vouchers')
  const toast = useToast()
  const confirm = useConfirm()

  // Toolbar states
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [isExportOpen, setIsExportOpen] = useState(false)

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

  const { currentPage, setCurrentPage, pageSize, setPageSize, totalPages, safePage, pagedRecords } = useListPagination(filteredRecords)
  const hasActiveFilters = !!(searchTerm || filter || dateRange.start || dateRange.end)

  const handleClearFilters = () => {
    setSearchTerm('')
    setFilter('')
    setDateRange({ start: '', end: '' })
    setCurrentPage(1)
  }

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

  const handleOpenEdit = (rec) => {
    setIsEditing(true)
    setIsViewing(false)
    setSelectedId(rec.id)
    setFormData({
      record_id: rec.record_id || '',
      beneficiary_name: rec.beneficiary_name || '',
      amount: rec.amount || '',
      purpose: rec.purpose || '',
      date: rec.date || '',
      status: rec.status || 'Pending',
      has_insurance: rec.has_insurance || false,
      insurance_number: rec.insurance_number || '',
      insurance_id: rec.insurance_id || '',
      payee: rec.payee || '',
      particular: rec.particular || '',
      check_number: rec.check_number || '',
      or_number: rec.or_number || '',
      account_code: rec.account_code || '',
      bank_name: rec.bank_name || ''
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
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: (isAdmin || canCreate) ? '' : 'none' }}>
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
          onSearch={v => { setSearchTerm(v); setCurrentPage(1) }}
          onFilterChange={v => { setFilter(v); setCurrentPage(1) }}
          onDateRangeChange={r => { setDateRange(r); setCurrentPage(1) }}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          onExportClick={() => setIsExportOpen(true)}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      )}

      {vouchers.length === 0 ? (
        <div className="empty-state">
          <i className="ri-file-text-line"></i>
          <h3>No Vouchers Found</h3>
          <p>Click "Create Voucher" to add your first voucher.</p>
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
                <th>Date</th>
                <th>Beneficiary/Payee</th>
                <th>Check No.</th>
                <th>Purpose / Particular</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pagedRecords.map((voucher) => (
                <tr 
                  key={voucher.id}
                  onClick={() => handleViewDetails(voucher)}
                  style={{ cursor: 'pointer', height: '49px' }}
                  className="table-row-clickable"
                >
                  <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                    {voucher.date 
                      ? format(new Date(voucher.date), 'MMM dd, yyyy')
                      : '-'}
                  </td>
                  <td style={{ fontWeight: '700' }}>
                    {voucher.beneficiary_name || voucher.payee || '-'}
                  </td>
                  <td style={{ fontFamily: 'monospace' }}>{voucher.check_number || '-'}</td>
                  <td>
                    <div style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px' }}>
                      {voucher.particular || voucher.purpose || '-'}
                    </div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontWeight: '700', color: '#16a34a' }}>
                    {formatCurrency(voucher.amount)}
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
              <TableGhostRows count={pageSize - pagedRecords.length} colSpan={7} />
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
        records={vouchers}
        filename="vouchers_report.xlsx"
        sheetName="Vouchers"
        dateField="date"
        transformValue={(col, val) => {
          if (col === 'has_insurance') return val ? 'Yes' : 'No'
          return val
        }}
        onSuccess={(count) => toast.success(`Exported ${count} records successfully.`)}
        onError={(msg) => toast.error(msg)}
      />

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

          <div className="form-row">
            <div className="form-group">
              <label>Payee</label>
              <input type="text" name="payee" value={formData.payee} onChange={handleInputChange} placeholder="Name of Payee" />
            </div>
            <div className="form-group">
              <label>Bank Name</label>
              <input type="text" name="bank_name" value={formData.bank_name} onChange={handleInputChange} placeholder="e.g. Landbank" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Check Number</label>
              <input type="text" name="check_number" value={formData.check_number} onChange={handleInputChange} placeholder="Check No." />
            </div>
            <div className="form-group">
              <label>OR Number</label>
              <input type="text" name="or_number" value={formData.or_number} onChange={handleInputChange} placeholder="Official Receipt No." />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Account Code</label>
              <input type="text" name="account_code" value={formData.account_code} onChange={handleInputChange} placeholder="Account Code" />
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
          </div>

          <div className="form-group">
            <label>Particular / Details</label>
            <textarea name="particular" value={formData.particular} onChange={handleInputChange} rows={3} placeholder="Particulars of the voucher..." />
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
