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

const TRAINING_OPTIONS = ['Basic Life Support – CPR', 'Standard First Aid']

const GENDER_OPTIONS = ['Male', 'Female', 'LGBTQ+', 'Preferred Not to Say']
const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Separated', 'Widowed', "It's Complicated"]

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
  address: ''
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
    return matchesSearch && matchesDate
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

  const loadRecords = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('training_registrations')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      setRecords(data || [])
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
    setFormData({
      record_id: rec.record_id || '',
      full_name: rec.full_name || '',
      gender: rec.gender || '',
      contact_number: rec.contact_number || '',
      email_address: rec.email_address || '',
      trainings: rec.trainings || [],
      organization: rec.organization || '',
      designation: rec.designation || '',
      civil_status: rec.civil_status || '',
      birth_date: rec.birth_date || '',
      address: rec.address || ''
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

  const getGenderBadge = (gender) => {
    const map = {
      'Male': { bg: '#dbeafe', color: '#1e40af' },
      'Female': { bg: '#fce7f3', color: '#9d174d' },
      'LGBTQ+': { bg: '#ede9fe', color: '#5b21b6' },
      'Preferred Not to Say': { bg: '#f3f4f6', color: '#374151' }
    }
    const s = map[gender] || { bg: '#f3f4f6', color: '#374151' }
    return <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', background: s.bg, color: s.color }}>{gender || '-'}</span>
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

      {records.length > 0 && (
        <ModuleToolbar
          onSearch={setSearchTerm}
          onFilterChange={setFilter}
          onDateRangeChange={setDateRange}
          pageSize={pageSize}
          onPageSizeChange={handlePageSizeChange}
          onExportClick={() => setIsExportOpen(true)}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
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
        <div className="data-table">
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
              </tr>
            </thead>
            <tbody>
              {pagedRecords.map(record => (
                <tr key={record.id} onClick={() => handleViewDetails(record)} style={{ cursor: 'pointer', height: '49px' }} className="table-row-clickable">
                  <td style={{ fontWeight: '700' }}>{record.full_name || '-'}</td>
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
                </tr>
              ))}
              <TableGhostRows count={Math.max(0, pageSize - pagedRecords.length)} colSpan={8} />
            </tbody>
          </table>
        </div>
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

              {/* Row 1: Record ID + Full Name */}
              <div className="form-row">
                
                <div className="form-group">
                  <label>Full Name *</label>
                  <input type="text" name="full_name" value={formData.full_name} onChange={handleInputChange} required placeholder="e.g. Juan dela Cruz" />
                </div>
              </div>

              {/* Row 2: Gender + Civil Status */}
              <div className="form-row">
                <div className="form-group">
                  <label>Gender *</label>
                  <select name="gender" value={formData.gender} onChange={handleInputChange} required>
                    <option value="">-- Select Gender --</option>
                    {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
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
                  <input type="date" name="birth_date" value={formData.birth_date} onChange={handleInputChange} required />
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
            <div></div>
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
