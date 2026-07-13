import ModuleToolbar from '../../components/ModuleToolbar'
import ListPagination from '../../components/ListPagination'
import ExportModal from '../../components/ExportModal'
import TableGhostRows from '../../components/TableGhostRows'
import useListPagination from '../../hooks/useListPagination'
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
import StatusCards from '../../components/StatusCards'

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
  bank_name: '',
  created_by: '',
  updated_by: '',
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
    
    const matchesFilter = !filter || item.status === filter
    
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

  const handlePrintPDF = () => {
    printPDF({
      title: 'Vouchers Report',
      subtitle: `${filteredRecords.length} vouchers`,
      columns: [
        { header: 'Date', key: 'date', format: v => v ? format(new Date(v), 'MMM dd, yyyy') : '—' },
        { header: 'Beneficiary/Payee', key: 'beneficiary_name', format: (v, rec) => v || rec.payee || '—' },
        { header: 'Check No.', key: 'check_number' },
        { header: 'Purpose', key: 'purpose' },
        { header: 'Amount', key: 'amount', format: v => v ? `₱${parseFloat(v).toFixed(2)}` : '—' },
        { header: 'Insurance', key: 'has_insurance', format: v => v ? 'Insured' : 'None' },
        { header: 'Status', key: 'status' },
      ],
      records: filteredRecords,
    })
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
      bank_name: rec.bank_name || '',
      created_by: rec.created_by || '',
      updated_by: rec.updated_by || '',
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
      const { data, error } = await supabase
        .from('vouchers')
        .update({ status: newStatus })
        .eq('id', id)
        .select()

      if (error) throw error

      // Update local state with the returned data that includes updated_by and updated_at from trigger
      if (data && data[0]) {
        setVouchers(vouchers.map(v => v.id === id ? data[0] : v))
      } else {
        setVouchers(vouchers.map(v => v.id === id ? { ...v, status: newStatus } : v))
      }
      
      toast.success('Status updated successfully!')
      await logAudit('Updated', 'Vouchers', id, `Updated status to ${newStatus}`)
    } catch (err) {
      console.error('Error updating status:', err)
      toast.error('Failed to update status: ' + err.message)
    }
  }

  const VOUCHER_STATUS_OPTIONS = [
    { value: 'Pending',  label: 'Pending',  icon: 'ri-time-fill',            bg: '#fef3c7', color: '#92400e' },
    { value: 'Approved', label: 'Approved', icon: 'ri-checkbox-circle-fill', bg: '#d1fae5', color: '#065f46' },
    { value: 'Paid',     label: 'Paid',     icon: 'ri-money-dollar-circle-fill', bg: '#dbeafe', color: '#1e40af' },
    { value: 'Rejected', label: 'Rejected', icon: 'ri-close-circle-fill',    bg: '#fee2e2', color: '#991b1b' },
  ]

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
      <StatusCards cards={[
        { label: 'Total',    count: vouchers.length,                                      icon: 'ri-file-text-line',       accent: '#2563eb' },
        { label: 'Pending',  count: vouchers.filter(v=>v.status==='Pending').length,       icon: 'ri-time-line',            accent: '#d97706' },
        { label: 'Approved', count: vouchers.filter(v=>v.status==='Approved').length,      icon: 'ri-checkbox-circle-line', accent: '#16a34a' },
        { label: 'Paid',     count: vouchers.filter(v=>v.status==='Paid').length,          icon: 'ri-coin-line',            accent: '#0891b2' },
        { label: 'Rejected', count: vouchers.filter(v=>v.status==='Rejected').length,      icon: 'ri-close-circle-line',    accent: '#dc2626' },
        { label: 'Total Amt',count: <span style={{fontSize:'14px'}}>{formatCurrency(totalAmount)}</span>, icon: 'ri-money-dollar-circle-line', accent: '#7c3aed' },
      ]} />

      {vouchers.length > 0 && (
        <ModuleToolbar
          onSearch={v => { setSearchTerm(v); setCurrentPage(1) }}
          onFilterChange={v => { setFilter(v); setCurrentPage(1) }}
          onDateRangeChange={r => { setDateRange(r); setCurrentPage(1) }}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          onExportClick={() => setIsExportOpen(true)}
          onPrintClick={handlePrintPDF}
          onClearFilters={handleClearFilters}
          filterLabel="All Status"
          filterOptions={[
            { label: 'Pending', value: 'Pending' },
            { label: 'Approved', value: 'Approved' },
            { label: 'Paid', value: 'Paid' },
            { label: 'Rejected', value: 'Rejected' },
          ]}
          filterColorMap={{
            'Pending': { bg: '#fef3c7', color: '#92400e', icon: 'ri-time-line' },
            'Approved': { bg: '#d1fae5', color: '#065f46', icon: 'ri-checkbox-circle-line' },
            'Paid': { bg: '#dbeafe', color: '#1e40af', icon: 'ri-coin-line' },
            'Rejected': { bg: '#fee2e2', color: '#991b1b', icon: 'ri-close-circle-line' },
          }}

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
        <div className="data-table" style={{ overflow: 'visible' }}>
          <table style={{ position: 'relative', zIndex: 1 }}>
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
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                        {voucher.date 
                          ? format(new Date(voucher.date), 'MMM dd, yyyy')
                          : '-'}
                      </span>
                      {voucher.created_by && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <i className="ri-user-line" style={{ fontSize: '12px' }}></i>
                          {voucher.created_by.split('@')[0]}
                          {voucher.updated_by && voucher.updated_at && voucher.created_at && voucher.updated_at !== voucher.created_at && (
                            <span style={{ marginLeft: '6px', color: 'var(--text-muted)' }}>
                              • updated by: {voucher.updated_by.split('@')[0]}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ fontWeight: '700' }}>{voucher.beneficiary_name || voucher.payee || '-'}</td>
                  <td style={{ fontFamily: 'monospace' }}>{voucher.check_number || '-'}</td>
                  <td>
                    <div style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px' }}>
                      {voucher.particular || voucher.purpose || '-'}
                    </div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontWeight: '700', color: '#16a34a' }}>
                    {formatCurrency(voucher.amount)}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <StatusSelect
                      value={voucher.status || 'Pending'}
                      options={VOUCHER_STATUS_OPTIONS}
                      onChange={(val) => handleStatusChange({ stopPropagation: () => {}, target: { value: val } }, voucher.id)}
                      disabled={!isAdmin}
                      align="right"
                    />
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
                max={new Date().toISOString().split('T')[0]} type="date" 
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
            {isViewing && (formData.created_by || formData.updated_by) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: 'var(--text-muted)' }}>
                {formData.created_by && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="ri-user-add-line" style={{ fontSize: '14px', color: 'var(--primary)' }}></i>
                    <span>Encoded by: <strong style={{ color: 'var(--text)' }}>{formData.created_by.split('@')[0]}</strong> {formData.created_at && <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>({format(new Date(formData.created_at), 'MMM d, h:mm a')})</span>}</span>
                  </div>
                )}
                {formData.updated_by && formData.updated_at && formData.created_at && formData.updated_at !== formData.created_at && (
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
