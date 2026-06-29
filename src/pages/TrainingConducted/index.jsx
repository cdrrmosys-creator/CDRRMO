import ModuleToolbar from '../../components/ModuleToolbar'
import useListPagination from '../../hooks/useListPagination'
import ListPagination from '../../components/ListPagination'
import ExportModal from '../../components/ExportModal'
import TableGhostRows from '../../components/TableGhostRows'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../services/supabase'
import { logAudit } from '../../services/audit'
import { uploadFile, deleteFiles } from '../../services/storage'
import { compressImage } from '../../utils/imageCompression'
import { format, parseISO } from 'date-fns'
import Modal from '../../components/Modal'
import PhotoUploadPanel from '../../components/PhotoUploadPanel'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const INITIAL_FORM_STATE = {
  record_id: '',
  training_title: '',
  date: '',
  venue: '',
  facilitator: '',
  participants: '',
  participants_data: [],
  remarks: '',
  photos: []
}

const EMPTY_PARTICIPANT = { name: '', birthdate: '', gender: '', address: '', civil_status: '', office: '', designation: '', contact_no: '', email: '' }

export default function TrainingConducted() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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
  const { canCreate, canUpdate, canDelete } = usePermissions('training-conducted')
  const toast = useToast()
  const confirm = useConfirm()

  // Toolbar states
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  useEffect(() => { loadRecords() }, [])

  const filteredRecords = records.filter(item => {
    let matchesSearch = true
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase()
      matchesSearch = Object.values(item).some(val =>
        val && typeof val === 'string' && val.toLowerCase().includes(lowerSearch)
      )
    }
    let matchesDate = true
    if (dateRange.start && dateRange.end) {
      const dateStr = item.date
      if (dateStr) {
        const created = new Date(dateStr)
        const start = new Date(dateRange.start)
        const end = new Date(dateRange.end)
        end.setHours(23, 59, 59, 999)
        matchesDate = created >= start && created <= end
      }
    }
    return matchesSearch && matchesDate
  })

  const [isExportOpen, setIsExportOpen] = useState(false)
  const { currentPage, setCurrentPage, pageSize, setPageSize, totalPages, safePage, pagedRecords } = useListPagination(filteredRecords)

  // Available years derived from records
  const availableYears = useMemo(() => {
    const years = new Set()
    records.forEach(rec => {
      if (rec.date) years.add(parseISO(rec.date).getFullYear())
    })
    years.add(new Date().getFullYear())
    return Array.from(years).sort((a, b) => b - a)
  }, [records])

  // Build monthly trend data for selected year
  const monthlyTrend = useMemo(() => {
    const months = []
    for (let m = 0; m < 12; m++) {
      const d = new Date(selectedYear, m, 1)
      months.push({
        key: `${selectedYear}-${String(m + 1).padStart(2, '0')}`,
        label: format(d, 'MMM'),
        count: 0
      })
    }
    records.forEach(rec => {
      if (!rec.date) return
      const d = parseISO(rec.date)
      if (d.getFullYear() !== selectedYear) return
      const key = `${selectedYear}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const m = months.find(x => x.key === key)
      if (m) m.count++
    })
    return months
  }, [records, selectedYear])

  const loadRecords = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('training_conducted')
        .select('*')
        .order('date', { ascending: false })
      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Error loading training conducted records:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetails = (rec) => { handleOpenEdit(rec); setIsViewing(true) }
  const handleEditFromView = (e) => { e.preventDefault(); e.stopPropagation(); setIsViewing(false) }
  const handleDeleteFromView = async () => { const id = selectedId; setIsModalOpen(false); await handleDelete(id) }

  const handleOpenAdd = () => {
    setIsEditing(false); setIsViewing(false); setSelectedId(null); setPendingPhotos([])
    const year = new Date().getFullYear()
    const rand = Math.floor(1000 + Math.random() * 9000)
    const todayStr = new Date().toISOString().split('T')[0]
    setFormData({ ...INITIAL_FORM_STATE, record_id: `TTC-${year}-${rand}`, date: todayStr })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (rec) => {
    setIsEditing(true); setIsViewing(false); setSelectedId(rec.id); setPendingPhotos([])
    setFormData({
      record_id: rec.record_id || '',
      training_title: rec.training_title || '',
      date: rec.date || '',
      venue: rec.venue || '',
      facilitator: rec.facilitator || '',
      participants: rec.participants || '',
      participants_data: Array.isArray(rec.participants_data) ? rec.participants_data : [],
      remarks: rec.remarks || '',
      photos: rec.photos || []
    })
    setIsModalOpen(true)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files)
    if (!files || files.length === 0) return
    setPendingPhotos(prev => [...prev, ...files])
  }

  const removeExistingPhoto = (idx) => setFormData(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== idx) }))
  const removePendingPhoto = (idx) => setPendingPhotos(prev => prev.filter((_, i) => i !== idx))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      let newPhotoUrls = []
      if (pendingPhotos.length > 0) {
        setIsUploading(true)
        try {
          for (const file of pendingPhotos) {
            const compressed = await compressImage(file)
            const path = `training-conducted-photos/${Date.now()}-${compressed.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            const url = await uploadFile('training-conducted', path, compressed)
            newPhotoUrls.push(url)
          }
        } catch (err) {
          toast.error('Failed to upload photos. Make sure a public "training-conducted" bucket exists in Supabase.')
          throw err
        } finally {
          setIsUploading(false)
        }
      }

      const payload = { ...formData, photos: [...(formData.photos || []), ...newPhotoUrls] }

      if (isEditing) {
        const { data, error } = await supabase.from('training_conducted').update(payload).eq('id', selectedId).select()
        if (error) throw error
        setRecords(records.map(r => r.id === selectedId ? data[0] : r))
        await logAudit('Updated', 'TrainingConducted', formData.record_id || selectedId, 'Updated record details')
        toast.success('Training record updated successfully!')
      } else {
        const { data, error } = await supabase.from('training_conducted').insert([payload]).select()
        if (error) throw error
        setRecords([data[0], ...records])
        await logAudit('Added', 'TrainingConducted', data[0].record_id || data[0].id, 'Created new record')
        toast.success('Training record added successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving:', err)
      toast.error('Error saving record: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This record will be permanently removed. This action cannot be undone.', { title: 'Delete Record' })
    if (!ok) return
    try {
      const rec = records.find(r => r.id === id)
      if (rec?.photos?.length > 0) {
        const paths = rec.photos.map(url => { const i = url.indexOf('training-conducted-photos/'); return i !== -1 ? url.substring(i) : null }).filter(Boolean)
        if (paths.length > 0) await deleteFiles('training-conducted', paths)
      }
      const { error } = await supabase.from('training_conducted').delete().eq('id', id)
      if (error) throw error
      setRecords(records.filter(r => r.id !== id))
      await logAudit('Deleted', 'TrainingConducted', id, 'Deleted record')
      toast.success('Training course deleted successfully!')
    } catch (err) {
      toast.error('Failed to delete record: ' + err.message)
    }
  }

  if (loading) return (
    <div className="loading-container">
      <i className="ri-loader-4-line loading-spinner"></i>
      <p>Loading training records...</p>
    </div>
  )

  if (error) return (
    <div style={{ padding: '32px', textAlign: 'center' }}>
      <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: '24px', color: '#991b1b', maxWidth: '500px', margin: '0 auto' }}>
        <i className="ri-error-warning-line" style={{ fontSize: '48px', marginBottom: '16px' }}></i>
        <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading Records</h3>
        <p>{error}</p>
        <button onClick={loadRecords} style={{ marginTop: '16px', padding: '10px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '700' }}>Try Again</button>
      </div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h2>
          <i className="ri-presentation-line" style={{ marginRight: '12px' }}></i>
          Training Conducted
        </h2>
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: (isAdmin || canCreate) ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Log Training Conducted
        </button>
      </div>

      {/* Monthly Trend Line Chart */}
      {records.length > 0 && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          marginBottom: '24px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
                <i className="ri-line-chart-line" style={{ marginRight: '8px', color: 'var(--primary)' }}></i>
                Training Conducted per Month
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Monthly breakdown for selected year</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--primary)' }}>
                  {monthlyTrend.reduce((s, m) => s + m.count, 0)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>TOTAL IN {selectedYear}</div>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyTrend} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '8px', fontSize: '13px' }}
                formatter={(value) => [value, 'Trainings']}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="var(--primary)"
                strokeWidth={2.5}
                dot={{ r: 4, fill: 'var(--primary)', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {records.length > 0 && (
        <ModuleToolbar
          onSearch={(v) => { setSearchTerm(v); setCurrentPage(1) }}
          onFilterChange={(v) => { setFilter(v); setCurrentPage(1) }}
          onDateRangeChange={(r) => { setDateRange(r); setCurrentPage(1) }}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          onExportClick={() => setIsExportOpen(true)}
          onClearFilters={() => { setSearchTerm(''); setFilter(''); setDateRange({ start: '', end: '' }); setCurrentPage(1) }}
          hasActiveFilters={Boolean(searchTerm || filter || dateRange.start || dateRange.end)}
        />
      )}

      {records.length === 0 ? (
        <div className="empty-state">
          <i className="ri-presentation-line"></i>
          <h3>No Conducted Trainings Logged</h3>
          <p>Click "Log Training Conducted" to create your first training record.</p>
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
                <th>Training Title</th>
                <th>Date</th>
                <th>Venue</th>
                <th>Facilitator</th>
                <th>Participants</th>
              </tr>
            </thead>
            <tbody>
              {pagedRecords.map((record) => (
                <tr key={record.id} onClick={() => handleViewDetails(record)} style={{ cursor: 'pointer', height: '49px' }} className="table-row-clickable">
                  <td style={{ fontWeight: '700' }}>{record.training_title || '-'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                    {record.date ? format(new Date(record.date), 'MMM dd, yyyy') : '-'}
                  </td>
                  <td>{record.venue || '-'}</td>
                  <td>{record.facilitator || '-'}</td>
                  <td>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {Array.isArray(record.participants_data) && record.participants_data.length > 0
                        ? `${record.participants_data.length} participant${record.participants_data.length !== 1 ? 's' : ''}`
                        : record.participants || '-'}
                    </span>
                  </td>
                </tr>
              ))}
              <TableGhostRows count={Math.max(0, pageSize - pagedRecords.length)} colSpan={6} />
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
        records={records}
        filename="trainingconducted_report.xlsx"
        sheetName="TrainingConducted"
        dateField="date"
        onSuccess={(count) => toast.success(`Exported ${count} records successfully.`)}
        onError={(msg) => toast.error(msg)}
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isViewing ? 'View Details' : (isEditing ? 'Edit Training Conducted' : 'Log Training Conducted')}
        maxWidth="1000px"
      >
        <style>{`
          .tc-form-layout { display: flex; flex-wrap: wrap; gap: 32px; }
          .tc-details-col { flex: 1 1 420px; min-width: 0; }
          .tc-photos-col { flex: 1 1 320px; min-width: 0; border-left: 2px solid var(--border-light); padding-left: 32px; }
          @media (max-width: 1050px) {
            .tc-form-layout { flex-direction: column; gap: 24px; }
            .tc-photos-col { border-left: none; padding-left: 0; border-top: 2px solid var(--border-light); padding-top: 24px; }
          }
        `}</style>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="tc-form-layout">

            {/* Left: Details */}
            <div className="tc-details-col">
              <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                  <div className="form-row">
                    
                    <div className="form-group">
                      <label>Date *</label>
                      <input type="date" name="date" value={formData.date} onChange={handleInputChange} required />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Training Title *</label>
                    <input type="text" name="training_title" value={formData.training_title} onChange={handleInputChange} required placeholder="e.g. Community-based DRRM Seminar" />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Venue</label>
                      <input type="text" name="venue" value={formData.venue} onChange={handleInputChange} placeholder="e.g. Brgy. Ganaderia Covered Court" />
                    </div>
                    <div className="form-group">
                      <label>Facilitator / Speaker</label>
                      <input type="text" name="facilitator" value={formData.facilitator} onChange={handleInputChange} placeholder="e.g. Chief DRRMO Officer" />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Participants Summary (optional)</label>
                    <textarea name="participants" value={formData.participants} onChange={handleInputChange} rows={2} placeholder="e.g. 50 Barangay Health Workers, Brgy officials..." />
                  </div>

                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ marginBottom: 0 }}>Participant List <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>({(formData.participants_data || []).length} entries)</span></label>
                      {!isViewing && (
                        <button
                          type="button"
                          onClick={() => setFormData(p => ({ ...p, participants_data: [...(p.participants_data || []), { ...EMPTY_PARTICIPANT }] }))}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--primary)', background: 'transparent', color: 'var(--primary)', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          <i className="ri-add-line"></i> Add Participant
                        </button>
                      )}
                    </div>
                    {(formData.participants_data || []).length === 0 ? (
                      <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px dashed var(--border-light)' }}>No participants added yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto' }}>
                        {(formData.participants_data || []).map((p, idx) => (
                          <div key={idx} style={{ border: '1px solid var(--border-light)', borderRadius: '8px', padding: '10px 12px', background: 'var(--bg-app)', position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)' }}>#{idx + 1}</span>
                              {!isViewing && (
                                <button type="button" onClick={() => setFormData(prev => ({ ...prev, participants_data: prev.participants_data.filter((_, i) => i !== idx) }))}
                                  style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', padding: '2px 7px', cursor: 'pointer', fontSize: '12px' }}>
                                  <i className="ri-delete-bin-line"></i>
                                </button>
                              )}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                              {[
                                { field: 'name', label: 'Full Name', type: 'text' },
                                { field: 'birthdate', label: 'Birthdate', type: 'date' },
                                { field: 'gender', label: 'Gender', type: 'select', opts: ['','Male','Female','Prefer not to say'] },
                                { field: 'civil_status', label: 'Civil Status', type: 'select', opts: ['','Single','Married','Widowed','Separated'] },
                                { field: 'office', label: 'Office/Organization', type: 'text' },
                                { field: 'designation', label: 'Designation', type: 'text' },
                                { field: 'contact_no', label: 'Contact No.', type: 'text' },
                                { field: 'email', label: 'Email', type: 'email' },
                                { field: 'address', label: 'Address', type: 'text', full: true },
                              ].map(({ field, label, type, opts, full }) => (
                                <div key={field} style={full ? { gridColumn: '1/-1' } : {}}>
                                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', display: 'block', marginBottom: '3px' }}>{label}</label>
                                  {type === 'select' ? (
                                    <select value={p[field] || ''}
                                      onChange={e => { const u = [...(formData.participants_data||[])]; u[idx] = { ...u[idx], [field]: e.target.value }; setFormData(prev => ({ ...prev, participants_data: u })) }}
                                      disabled={isViewing}
                                      style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '12px', background: isViewing ? 'var(--bg-app)' : 'var(--bg-surface)', color: 'var(--text-main)' }}>
                                      {opts.map(o => <option key={o} value={o}>{o || '-- Select --'}</option>)}
                                    </select>
                                  ) : (
                                    <input type={type} value={p[field] || ''}
                                      onChange={e => { const u = [...(formData.participants_data||[])]; u[idx] = { ...u[idx], [field]: e.target.value }; setFormData(prev => ({ ...prev, participants_data: u })) }}
                                      disabled={isViewing}
                                      style={{ width: '100%', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border-light)', fontSize: '12px', boxSizing: 'border-box' }} />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Remarks / Narrative</label>
                    <textarea name="remarks" value={formData.remarks} onChange={handleInputChange} rows={3} placeholder="Enter a narrative or remarks about the training..." />
                  </div>

                </div>
              </fieldset>
            </div>

            {/* Right: Photos */}
            <div className="tc-photos-col">
              <PhotoUploadPanel
                title="Training Photos"
                emptyMessage="No photos uploaded for this conducted training yet."
                photos={formData.photos}
                pendingPhotos={pendingPhotos}
                isViewing={isViewing}
                isUploading={isUploading}
                isSaving={isSaving}
                minHeight="300px"
                onFileUpload={handleFileUpload}
                onRemoveExisting={removeExistingPhoto}
                onRemovePending={removePendingPhoto}
              />
            </div>

          </div>

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
            <div></div>
            {isViewing ? (
              <div style={{ display: 'flex', gap: '12px' }}>{(isAdmin || canDelete) && (
                    <button type="button" className="btn-delete" onClick={handleDeleteFromView} style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <i className="ri-delete-bin-line" style={{ marginRight: '6px' }}></i> Delete
                    </button>
                  )}
                  {(isAdmin || canUpdate) && (
                    <button type="button" className="btn-edit" onClick={handleEditFromView} style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}>
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
