import ModuleToolbar from '../../components/ModuleToolbar'
import ListPagination from '../../components/ListPagination'
import ExportModal from '../../components/ExportModal'
import TableGhostRows from '../../components/TableGhostRows'
import useListPagination from '../../hooks/useListPagination'
import StatusSelect from '../../components/StatusSelect'
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

const TRAINING_OPTIONS = ['Basic Life Support – CPR', 'Standard First Aid']

const GENDER_OPTIONS = ['Male', 'Female', 'LGBTQ+', 'Preferred Not to Say']
const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Separated', 'Widowed', "It's Complicated"]

const REGISTRATION_EXPORT_COLUMNS = [
  'record_id', 'full_name', 'gender', 'contact_number', 'email_address', 
  'trainings', 'organization', 'designation', 'civil_status', 'birth_date', 'address', 'status'
]

const REGISTRATION_EXPORT_HEADERS = {
  record_id: 'Record ID',
  full_name: 'Full Name',
  gender: 'Gender',
  contact_number: 'Contact Number',
  email_address: 'Email Address',
  trainings: 'Training/s',
  organization: 'Organization',
  designation: 'Designation',
  civil_status: 'Civil Status',
  birth_date: 'Birth Date',
  address: 'Address',
  status: 'Status'
}

const INITIAL_FORM_STATE = {
  record_id: '',
  full_name: '',
  gender: '',
  contact_number: '',
  email_address: '',
  trainings: [],
  organization: '',
  designation: '',
  civil_status: '',
  birth_date: '',
  address: '',
  status: 'Pending',
  created_by: '',
  updated_by: '',
  created_at: '',
  updated_at: ''
}

export default function TrainingRegistrations() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isViewing, setIsViewing] = useState(false)
  const [formData, setFormData] = useState(INITIAL_FORM_STATE)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const isAdmin = useIsAdmin()
  const { canCreate, canUpdate, canDelete } = usePermissions('documentation')
  const toast = useToast()
  const confirm = useConfirm()

  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  useEffect(() => { loadRecords() }, [])

  const filteredRecords = records.filter(item => {
    let matchesSearch = true
    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      matchesSearch = Object.values(item).some(val =>
        val && typeof val === 'string' && val.toLowerCase().includes(lower)
      )
    }

    const matchesFilter = !filter || item.status === filter

    let matchesDate = true
    if (dateRange.start && dateRange.end) {
      const dateStr = item.birth_date || item.created_at
      if (dateStr) {
        const d = new Date(dateStr)
        const start = new Date(dateRange.start)
        const end = new Date(dateRange.end)
        end.setHours(23, 59, 59, 999)
        matchesDate = d >= start && d <= end
      }
    }
    return matchesSearch && matchesFilter && matchesDate
  })

  const [isExportOpen, setIsExportOpen] = useState(false)
  const { currentPage, setCurrentPage, pageSize, setPageSize: handlePageSizeChange, totalPages, safePage, pagedRecords } = useListPagination(filteredRecords)

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
      title: 'Training Registrations Report',
      subtitle: `${filteredRecords.length} registrations`,
      columns: [
        { header: 'Full Name', key: 'full_name' },
        { header: 'Gender', key: 'gender' },
        { header: 'Contact No.', key: 'contact_number' },
        { 
          header: 'Training/s', 
          key: 'trainings',
          format: (val) => Array.isArray(val) ? val.join(', ') : (val || '—')
        },
        { header: 'Organization', key: 'organization' },
        { header: 'Designation', key: 'designation' },
        { header: 'Civil Status', key: 'civil_status' },
      ],
      records: filteredRecords,
    })
  }

  const loadRecords = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('training_registrations')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      
      // Custom sort: Pending → Completed → Cancelled, then by date within each status
      const statusOrder = { 'Pending': 1, 'Completed': 2, 'Cancelled': 3 }
      const sorted = (data || []).sort((a, b) => {
        const statusA = statusOrder[a.status] || 999
        const statusB = statusOrder[b.status] || 999
        
        if (statusA !== statusB) {
          return statusA - statusB
        }
        
        // Within same status, sort by created_at descending (newest first)
        return new Date(b.created_at) - new Date(a.created_at)
      })
      
      setRecords(sorted)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetails = (rec) => { handleOpenEdit(rec); setIsViewing(true) }
  const handleEditFromView = (e) => { e.preventDefault(); e.stopPropagation(); setIsViewing(false) }
  const handleDeleteFromView = async () => { const id = selectedId; setIsModalOpen(false); await handleDelete(id) }

  const handleOpenAdd = () => {
    setIsEditing(false); setIsViewing(false); setSelectedId(null)
    const year = new Date().getFullYear()
    const rand = Math.floor(1000 + Math.random() * 9000)
    setFormData({ ...INITIAL_FORM_STATE, record_id: `TRG-${year}-${rand}` })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (rec) => {
    setIsEditing(true); setIsViewing(false); setSelectedId(rec.id)
    
    // Normalize gender to proper case
    let normalizedGender = rec.gender || ''
    if (normalizedGender) {
      const lower = normalizedGender.toLowerCase()
      if (lower === 'male') normalizedGender = 'Male'
      else if (lower === 'female') normalizedGender = 'Female'
      else if (lower === 'lgbtq+') normalizedGender = 'LGBTQ+'
      else if (lower === 'preferred not to say') normalizedGender = 'Preferred Not to Say'
    }
    
    setFormData({
      record_id: rec.record_id || '',
      full_name: rec.full_name || '',
      gender: normalizedGender,
      contact_number: rec.contact_number || '',
      email_address: rec.email_address || '',
      trainings: rec.trainings || [],
      organization: rec.organization || '',
      designation: rec.designation || '',
      civil_status: rec.civil_status || '',
      birth_date: rec.birth_date || '',
      address: rec.address || '',
      status: rec.status || 'Pending',
      created_by: rec.created_by || '',
      updated_by: rec.updated_by || '',
      created_at: rec.created_at || '',
      updated_at: rec.updated_at || ''
    })
    setIsModalOpen(true)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleTrainingToggle = (training) => {
    setFormData(prev => {
      const already = prev.trainings.includes(training)
      return {
        ...prev,
        trainings: already
          ? prev.trainings.filter(t => t !== training)
          : [...prev.trainings, training]
      }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.trainings || formData.trainings.length === 0) {
      toast.error('Please select at least one training.')
      return
    }
    setIsSaving(true)
    try {
      const payload = { ...formData, birth_date: formData.birth_date || null }
      if (isEditing) {
        const { data, error } = await supabase.from('training_registrations').update(payload).eq('id', selectedId).select()
        if (error) throw error
        setRecords(records.map(r => r.id === selectedId ? data[0] : r))
        await logAudit('Updated', 'TrainingRegistrations', formData.record_id || selectedId, 'Updated registration')
        toast.success('Registration updated successfully!')
      } else {
        const { data, error } = await supabase.from('training_registrations').insert([payload]).select()
        if (error) throw error
        setRecords([data[0], ...records])
        await logAudit('Added', 'TrainingRegistrations', data[0].record_id || data[0].id, 'New training registration')
        toast.success('Registration added successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      toast.error('Error saving registration: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This registration will be permanently removed. This action cannot be undone.', { title: 'Delete Registration' })
    if (!ok) return
    try {
      const { error } = await supabase.from('training_registrations').delete().eq('id', id)
      if (error) throw error
      setRecords(records.filter(r => r.id !== id))
      await logAudit('Deleted', 'TrainingRegistrations', id, 'Deleted registration')
      toast.success('Registration deleted successfully!')
    } catch (err) {
      toast.error('Failed to delete: ' + err.message)
    }
  }

  const handleStatusChange = async (id, newStatus) => {
    if (!isAdmin && !canUpdate) {
      toast.error('You do not have permission to update status.')
      return
    }
    try {
      const { data, error } = await supabase
        .from('training_registrations')
        .update({ status: newStatus })
        .eq('id', id)
        .select()
      if (error) throw error
      
      // Update and re-sort records
      const updatedRecords = records.map(r => r.id === id ? data[0] : r)
      
      // Custom sort: Pending → Completed → Cancelled, then by date within each status
      const statusOrder = { 'Pending': 1, 'Completed': 2, 'Cancelled': 3 }
      const sorted = updatedRecords.sort((a, b) => {
        const statusA = statusOrder[a.status] || 999
        const statusB = statusOrder[b.status] || 999
        
        if (statusA !== statusB) {
          return statusA - statusB
        }
        
        // Within same status, sort by created_at descending (newest first)
        return new Date(b.created_at) - new Date(a.created_at)
      })
      
      setRecords(sorted)
      await logAudit('Updated', 'TrainingRegistrations', id, `Changed status to ${newStatus}`)
      toast.success(`Status updated to ${newStatus}`)
    } catch (err) {
      toast.error('Failed to update status: ' + err.message)
    }
  }

  const getGenderBadge = (gender) => {
    if (!gender) return <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', background: '#f3f4f6', color: '#374151' }}>-</span>
    
    // Normalize gender to proper case for display
    const normalized = gender.toLowerCase()
    let displayValue = gender
    let colorScheme = { bg: '#f3f4f6', color: '#374151' }
    
    if (normalized === 'male') {
      displayValue = 'Male'
      colorScheme = { bg: '#dbeafe', color: '#1e40af' }
    } else if (normalized === 'female') {
      displayValue = 'Female'
      colorScheme = { bg: '#fce7f3', color: '#9d174d' }
    } else if (normalized === 'lgbtq+') {
      displayValue = 'LGBTQ+'
      colorScheme = { bg: '#ede9fe', color: '#5b21b6' }
    } else if (normalized === 'preferred not to say') {
      displayValue = 'Preferred Not to Say'
      colorScheme = { bg: '#f3f4f6', color: '#374151' }
    }
    
    return <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', background: colorScheme.bg, color: colorScheme.color }}>{displayValue}</span>
  }

  if (loading) return (
    <div className="loading-container">
      <i className="ri-loader-4-line loading-spinner"></i>
      <p>Loading registrations...</p>
    </div>
  )

  if (error) return (
    <div style={{ padding: '32px', textAlign: 'center' }}>
      <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: '24px', color: '#991b1b', maxWidth: '500px', margin: '0 auto' }}>
        <i className="ri-error-warning-line" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading Registrations</h3>
        <p>{error}</p>
        <button onClick={loadRecords} style={{ marginTop: '16px', padding: '10px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}>Try Again</button>
      </div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="ri-user-add-line" style={{ marginRight: '12px' }}></i>
          Training Registration Requests
        </h2>
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: (isAdmin || canCreate) ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Add Registration
        </button>
      </div>

      {/* Status Cards */}
      {records.length > 0 && (() => {
        const counts = {
          total: records.length,
          pending: records.filter(r => (r.status || 'Pending') === 'Pending').length,
          completed: records.filter(r => r.status === 'Completed').length,
          cancelled: records.filter(r => r.status === 'Cancelled').length,
        }
        const cards = [
          { label: 'Total', count: counts.total, icon: 'ri-group-line', accent: '#2563eb' },
          { label: 'Pending', count: counts.pending, icon: 'ri-time-line', accent: '#d97706' },
          { label: 'Completed', count: counts.completed, icon: 'ri-checkbox-circle-line', accent: '#16a34a' },
          { label: 'Cancelled', count: counts.cancelled, icon: 'ri-close-circle-line', accent: '#dc2626' },
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

      

      {records.length > 0 && (
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
          filterOptions={[
            { label: 'Pending', value: 'Pending' },
            { label: 'Completed', value: 'Completed' },
            { label: 'Cancelled', value: 'Cancelled' },
          ]}
          filterColorMap={{
            'Pending': { bg: '#fef3c7', color: '#92400e', icon: 'ri-time-line' },
            'Completed': { bg: '#d1fae5', color: '#065f46', icon: 'ri-checkbox-circle-line' },
            'Cancelled': { bg: '#fee2e2', color: '#991b1b', icon: 'ri-close-circle-line' },
          }}
        />
      )}

      {records.length === 0 ? (
        <div className="empty-state">
          <i className="ri-user-add-line"></i>
          <h3>No Registrations Yet</h3>
          <p>Click "Add Registration" to log a training registration request.</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="empty-state">
          <i className="ri-filter-off-line"></i>
          <h3>No Matching Records</h3>
          <p>Try adjusting your search or filters.</p>
        </div>
      ) : (
        <>
        <style>{`
          .training-registrations-table {
            overflow: visible !important;
          }
          .training-registrations-table table {
            position: relative;
            z-index: 1;
          }
          .training-registrations-table tbody tr {
            position: relative;
          }
        `}</style>
        <div className="data-table training-registrations-table">
          <table>
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Gender</th>
                <th>Contact No.</th>
                <th>Training/s</th>
                <th>Organization</th>
                <th>Designation</th>
                <th>Civil Status</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {pagedRecords.map(record => (
                <tr key={record.id} onClick={() => handleViewDetails(record)} style={{ cursor: 'pointer' }} className="table-row-clickable">
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: '700' }}>{record.full_name || '-'}</span>
                      {record.created_by && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <i className="ri-user-line" style={{ fontSize: '12px' }}></i>
                          {record.created_by.split('@')[0]}
                          {record.updated_by && record.updated_by !== record.created_by && (
                            <span style={{ marginLeft: '6px', color: 'var(--text-muted)' }}>
                              • updated by: {record.updated_by.split('@')[0]}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{getGenderBadge(record.gender)}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{record.contact_number || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {(record.trainings || []).map(t => (
                        <span key={t} style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', background: '#d1fae5', color: '#065f46' }}>{t}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ fontSize: '13px' }}>{record.organization || '-'}</td>
                  <td style={{ fontSize: '13px' }}>{record.designation || '-'}</td>
                  <td style={{ fontSize: '13px' }}>{record.civil_status || '-'}</td>
                  <td onClick={(e) => e.stopPropagation()} style={{ position: 'relative', overflow: 'visible' }}>
                    <StatusSelect
                      value={record.status || 'Pending'}
                      options={[
                        { value: 'Pending', label: 'Pending', icon: 'ri-time-line', bg: '#fef3c7', color: '#92400e' },
                        { value: 'Completed', label: 'Completed', icon: 'ri-checkbox-circle-fill', bg: '#d1fae5', color: '#065f46' },
                        { value: 'Cancelled', label: 'Cancelled', icon: 'ri-close-circle-fill', bg: '#fee2e2', color: '#991b1b' },
                      ]}
                      onChange={(val) => handleStatusChange(record.id, val)}
                      disabled={!isAdmin && !canUpdate}
                    />
                  </td>
                </tr>
              ))}
              <TableGhostRows count={Math.max(0, pageSize - pagedRecords.length)} colSpan={8} />
            </tbody>
          </table>
        </div>
        </>
      )}

      <ListPagination
        currentPage={safePage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalRecords={filteredRecords.length}
        onPageChange={setCurrentPage}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        records={records}
        filename="training_registrations_report.xlsx"
        sheetName="Training Registrations"
        dateField="birth_date"
        columns={REGISTRATION_EXPORT_COLUMNS}
        headers={REGISTRATION_EXPORT_HEADERS}
        transformValue={(col, val) => {
          if (col === 'trainings') {
            return Array.isArray(val) ? val.join(', ') : ''
          }
          return val
        }}
        onSuccess={(count) => toast.success(`Exported ${count} records.`)}
        onError={(msg) => toast.error(msg)}
      />

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isViewing ? 'View Registration' : (isEditing ? 'Edit Registration' : 'Add Training Registration')}
        maxWidth="780px"
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Row 1: Full Name + Status */}
              <div className="form-row">
                <div className="form-group">
                  <label>Full Name *</label>
                  <input type="text" name="full_name" value={formData.full_name} onChange={handleInputChange} required placeholder="e.g. Juan dela Cruz" />
                </div>
                <div className="form-group">
                  <label>Status *</label>
                  <select name="status" value={formData.status} onChange={handleInputChange} required disabled={isViewing}>
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Gender + Civil Status */}
              <div className="form-row">
                <div className="form-group">
                  <label>Gender *</label>
                  {isViewing ? (
                    <div style={{ 
                      padding: '10px 12px', 
                      border: '1px solid var(--border-light)', 
                      borderRadius: '8px',
                      background: 'var(--bg-app)',
                      minHeight: '42px',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      {formData.gender || '-'}
                    </div>
                  ) : (
                    <select name="gender" value={formData.gender} onChange={handleInputChange} required>
                      <option value="">-- Select Gender --</option>
                      {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  )}
                </div>
                <div className="form-group">
                  <label>Civil Status *</label>
                  <select name="civil_status" value={formData.civil_status} onChange={handleInputChange} required>
                    <option value="">-- Select Status --</option>
                    {CIVIL_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 3: Contact + Email */}
              <div className="form-row">
                <div className="form-group">
                  <label>Contact Number *</label>
                  <input type="tel" name="contact_number" value={formData.contact_number} onChange={handleInputChange} required placeholder="e.g. 09171234567" />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input type="email" name="email_address" value={formData.email_address} onChange={handleInputChange} placeholder="e.g. juan@email.com" />
                </div>
              </div>

              {/* Row 4: Birth Date + Organization */}
              <div className="form-row">
                <div className="form-group">
                  <label>Birth Date *</label>
                  <input max={new Date().toISOString().split('T')[0]} type="date" name="birth_date" value={formData.birth_date} onChange={handleInputChange} required />
                </div>
                <div className="form-group">
                  <label>Office / School / Organization / Company</label>
                  <input type="text" name="organization" value={formData.organization} onChange={handleInputChange} placeholder="e.g. Palayan City DRRMO" />
                </div>
              </div>

              {/* Row 5: Designation + Address */}
              <div className="form-row">
                <div className="form-group">
                  <label>Designation / Position</label>
                  <input type="text" name="designation" value={formData.designation} onChange={handleInputChange} placeholder="e.g. Responder, Teacher, Admin Officer" />
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input type="text" name="address" value={formData.address} onChange={handleInputChange} placeholder="e.g. Brgy. Ganaderia, Palayan City" />
                </div>
              </div>

              {/* Training Checkboxes */}
              <div className="form-group">
                <label>Training to Attend *</label>
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  marginTop: '6px',
                  padding: '14px 16px',
                  border: '1.5px solid var(--border-light)',
                  borderRadius: '10px',
                  background: 'var(--bg-app)'
                }}>
                  {TRAINING_OPTIONS.map(training => {
                    const checked = (formData.trainings || []).includes(training)
                    return (
                      <label
                        key={training}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          cursor: isViewing ? 'default' : 'pointer',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: `1.5px solid ${checked ? 'var(--primary)' : 'var(--border-light)'}`,
                          background: checked ? 'var(--primary-bg)' : 'var(--bg-surface)',
                          color: checked ? 'var(--primary)' : 'var(--text-main)',
                          fontWeight: checked ? '700' : '500',
                          transition: 'all 0.15s',
                          userSelect: 'none'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => !isViewing && handleTrainingToggle(training)}
                          style={{ display: 'none' }}
                        />
                        <i className={checked ? 'ri-checkbox-circle-fill' : 'ri-checkbox-blank-circle-line'} style={{ fontSize: '16px' }}></i>
                        {training}
                      </label>
                    )
                  })}
                </div>
              </div>

            </div>
          </fieldset>

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
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
              <div style={{ display: 'flex', gap: '12px' }}>
                {(isAdmin || canDelete) && (
                    <button type="button" onClick={handleDeleteFromView} style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <i className="ri-delete-bin-line" style={{ marginRight: '6px' }}></i> Delete
                    </button>
                  )}
                  {(isAdmin || canUpdate) && (
                    <button type="button" onClick={handleEditFromView} style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}>
                      <i className="ri-pencil-line" style={{ marginRight: '6px' }}></i> Edit
                    </button>
                  )}
                {!(isAdmin || canUpdate || canDelete) && <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Close</button>}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</button>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </div>
  )
}
