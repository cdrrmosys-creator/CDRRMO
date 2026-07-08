import { validateForm } from '../../utils/validation'
import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { format } from 'date-fns'
import { printPDF } from '../../utils/printPDF'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { usePermissions } from '../../hooks/usePermissions'
import useListPagination from '../../hooks/useListPagination'
import { logAudit } from '../../services/audit'
import { compressImage } from '../../utils/imageCompression'
import { uploadFile, deleteFiles } from '../../services/storage'
import Modal from '../../components/Modal'
import ModuleToolbar from '../../components/ModuleToolbar'
import TableGhostRows from '../../components/TableGhostRows'
import ListPagination from '../../components/ListPagination'
import ExportModal from '../../components/ExportModal'
import PhotoUploadPanel from '../../components/PhotoUploadPanel'

const INITIAL_FORM_STATE = {
  record_id: '',
  date: '',
  time_of_incident: '',
  location: '',
  latitude: '',
  longitude: '',
  victim_name: '',
  victim_age: '',
  victim_gender: '',
  victim_address: '',
  water_body: '',
  cause: '',
  response_time: '',
  team: '',
  responders: '',
  outcome: '',
  remarks: '',
  photos: []
}

const OUTCOME_COLORS = {
  'Rescued': { bg: '#dcfce7', color: '#166534' },
  'Deceased': { bg: '#fee2e2', color: '#991b1b' },
  'Hospitalized': { bg: '#dbeafe', color: '#1e40af' },
  'Self-recovered': { bg: '#fef9c3', color: '#854d0e' },
}

const DROWNING_EXPORT_COLUMNS = [
  'record_id', 'date', 'time_of_incident', 'location', 'latitude', 'longitude',
  'victim_name', 'victim_age', 'victim_gender', 'victim_address',
  'water_body', 'cause', 'response_time', 'team', 'responders', 'outcome', 'remarks', 'photos'
]

const DROWNING_EXPORT_HEADERS = {
  record_id: 'Record ID',
  date: 'Date',
  time_of_incident: 'Time of Incident',
  location: 'Location',
  latitude: 'Latitude',
  longitude: 'Longitude',
  victim_name: 'Victim Name',
  victim_age: 'Age',
  victim_gender: 'Gender',
  victim_address: 'Victim Address',
  water_body: 'Water Body',
  cause: 'Cause',
  response_time: 'Response Time',
  team: 'Team',
  responders: 'Responders',
  outcome: 'Outcome',
  remarks: 'Remarks',
  photos: 'Photo URLs'
}

export default function DrowningIncidents() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isViewing, setIsViewing] = useState(false)
  const [formData, setFormData] = useState(INITIAL_FORM_STATE)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [pendingPhotos, setPendingPhotos] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [isExportOpen, setIsExportOpen] = useState(false)

  const isAdmin = useIsAdmin()
  const { canCreate, canUpdate, canDelete } = usePermissions('drowning_incidents')
  const toast = useToast()
  const confirm = useConfirm()

  const filteredRecords = records.filter(item => {
    let matchesSearch = true
    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      matchesSearch = Object.values(item).some(v => v && typeof v === 'string' && v.toLowerCase().includes(lower))
    }
    let matchesDate = true
    if (dateRange.start && dateRange.end) {
      const d = item.date ? new Date(item.date) : null
      if (d) {
        const start = new Date(dateRange.start)
        const end = new Date(dateRange.end)
        end.setHours(23, 59, 59, 999)
        matchesDate = d >= start && d <= end
      }
    }
    const matchesFilter = !filter || item.outcome === filter
    return matchesSearch && matchesFilter && matchesDate
  })

  const { currentPage, setCurrentPage, pageSize, setPageSize, totalPages, safePage, pagedRecords } = useListPagination(filteredRecords)

  const loadRecords = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('drowning_incidents')
        .select('*')
        .order('date', { ascending: false })
      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Error loading drowning records:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadRecords() }, [])

  const handleViewDetails = (rec) => { handleOpenEdit(rec); setIsViewing(true) }
  const handleEditFromView = (e) => { e.preventDefault(); e.stopPropagation(); setIsViewing(false) }
  const handleDeleteFromView = async () => { const id = selectedId; setIsModalOpen(false); await handleDelete(id) }

  const handleOpenAdd = () => {
    setIsEditing(false); setIsViewing(false); setSelectedId(null); setPendingPhotos([])
    const year = new Date().getFullYear()
    const rand = Math.floor(1000 + Math.random() * 9000)
    setFormData({ ...INITIAL_FORM_STATE, record_id: `DRW-${year}-${rand}`, date: new Date().toISOString().split('T')[0] })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (rec) => {
    setIsEditing(true); setIsViewing(false); setSelectedId(rec.id); setPendingPhotos([])
    setFormData({
      record_id: rec.record_id || '',
      date: rec.date || '',
      time_of_incident: rec.time_of_incident || '',
      location: rec.location || '',
      latitude: rec.latitude ?? '',
      longitude: rec.longitude ?? '',
      victim_name: rec.victim_name || '',
      victim_age: rec.victim_age || '',
      victim_gender: rec.victim_gender || '',
      victim_address: rec.victim_address || '',
      water_body: rec.water_body || '',
      cause: rec.cause || '',
      response_time: rec.response_time || '',
      team: rec.team || '',
      responders: rec.responders || '',
      outcome: rec.outcome || '',
      remarks: rec.remarks || '',
      photos: rec.photos || []
    })
    setIsModalOpen(true)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const removeExistingPhoto = (idx) => setFormData(prev => ({ ...prev, photos: prev.photos.filter((_, i) => i !== idx) }))
  const removePendingPhoto = (idx) => setPendingPhotos(prev => prev.filter((_, i) => i !== idx))
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setPendingPhotos(prev => [...prev, ...files])
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Pre-submit validation
    const errors = validateForm({
      'Name of Person': { rule: 'name', value: formData.name_of_person },
    })
    if (Object.keys(errors).length > 0) {
      Object.values(errors).forEach(msg => toast.error(msg))
      return
    }

    setIsSaving(true)
    try {
      let newPhotoUrls = []
      if (pendingPhotos.length > 0) {
        setIsUploading(true)
        try {
          for (const file of pendingPhotos) {
            const compressed = await compressImage(file, 800, 0.6)
            const path = `drowning-photos/${Date.now()}-${compressed.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            const url = await uploadFile('drowning-incidents', path, compressed)
            newPhotoUrls.push(url)
          }
        } catch (err) {
          toast.error('Failed to upload photos.')
          throw err
        } finally {
          setIsUploading(false)
        }
      }

      const payload = {
        ...formData,
        latitude: formData.latitude !== '' ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude !== '' ? parseFloat(formData.longitude) : null,
        photos: [...(formData.photos || []), ...newPhotoUrls]
      }

      if (isEditing) {
        const { data, error } = await supabase.from('drowning_incidents').update(payload).eq('id', selectedId).select()
        if (error) throw error
        setRecords(records.map(r => r.id === selectedId ? data[0] : r))
        await logAudit('Updated', 'DrowningIncidents', formData.record_id || selectedId, 'Updated drowning incident')
        toast.success('Drowning incident updated!')
      } else {
        const { data, error } = await supabase.from('drowning_incidents').insert([payload]).select()
        if (error) throw error
        setRecords([data[0], ...records])
        await logAudit('Added', 'DrowningIncidents', data[0].record_id || data[0].id, 'Created drowning incident')
        toast.success('Drowning incident recorded!')
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
    const ok = await confirm('This drowning incident record will be permanently deleted. This action cannot be undone.', { title: 'Delete Record' })
    if (!ok) return
    try {
      const rec = records.find(r => r.id === id)
      if (rec?.photos?.length > 0) {
        const paths = rec.photos.map(url => { const i = url.indexOf('drowning-photos/'); return i !== -1 ? url.substring(i) : null }).filter(Boolean)
        if (paths.length > 0) await deleteFiles('drowning-incidents', paths)
      }
      const { error } = await supabase.from('drowning_incidents').delete().eq('id', id)
      if (error) throw error
      setRecords(records.filter(r => r.id !== id))
      await logAudit('Deleted', 'DrowningIncidents', id, 'Deleted drowning incident')
      toast.success('Record deleted successfully!')
    } catch (err) {
      toast.error('Failed to delete: ' + err.message)
    }
  }

  const getOutcomeBadge = (outcome) => {
    const c = OUTCOME_COLORS[outcome] || { bg: '#f3f4f6', color: '#6b7280' }
    return <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', background: c.bg, color: c.color }}>{outcome || '-'}</span>
  }

  const handlePrintPDF = () => {
    printPDF({
      title: 'Drowning Incidents Report',
      subtitle: `${filteredRecords.length} incidents`,
      columns: [
        { header: 'Date', key: 'date', format: v => v ? format(new Date(v), 'MMM dd, yyyy') : '—' },
        { header: 'Location', key: 'location' },
        { header: 'Victim', key: 'victim_name' },
        { header: 'Water Body', key: 'water_body' },
        { 
          header: 'Team', 
          key: 'team', 
          format: (v, record) => {
            if (v === 'Other' && record.responders) {
              return record.responders
            }
            return v || '—'
          }
        },
        { header: 'Outcome', key: 'outcome' },
      ],
      records: filteredRecords,
    })
  }

  if (loading) return <div className="loading-container"><i className="ri-loader-4-line loading-spinner"></i><p>Loading drowning records...</p></div>
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
          <i className="ri-water-flash-line" style={{ marginRight: '12px' }}></i>
          Drowning Incidents
        </h2>
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: (isAdmin || canCreate) ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Add Incident
        </button>
      </div>

      {/* Summary Stats */}
      {records.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'Total Incidents', value: records.length, icon: 'ri-water-flash-line', color: '#3b82f6' },
            { label: 'Rescued', value: records.filter(r => r.outcome === 'Rescued').length, icon: 'ri-lifebuoy-line', color: '#10b981' },
            { label: 'Deceased', value: records.filter(r => r.outcome === 'Deceased').length, icon: 'ri-heart-pulse-line', color: '#ef4444' },
            { label: 'Hospitalized', value: records.filter(r => r.outcome === 'Hospitalized').length, icon: 'ri-hospital-line', color: '#6366f1' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} style={{ 
              background: 'var(--bg-surface)', 
              borderLeft: '1px solid var(--border-light)',
              borderRight: '1px solid var(--border-light)',
              borderBottom: '1px solid var(--border-light)',
              borderTop: `4px solid ${color}`,
              borderRadius: 'var(--radius-md)', 
              padding: '16px', 
              boxShadow: 'var(--shadow-sm)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px' 
            }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={icon} style={{ fontSize: '20px', color }}></i>
              </div>
              <div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text)' }}>{value}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>{label}</div>
              </div>
            </div>
          ))}
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
          onPrintClick={handlePrintPDF}
          onClearFilters={() => { setSearchTerm(''); setFilter(''); setDateRange({ start: '', end: '' }); setCurrentPage(1) }}
          filterLabel="All Outcomes"
          filterOptions={[
            { label: 'Rescued',        value: 'Rescued' },
            { label: 'Hospitalized',   value: 'Hospitalized' },
            { label: 'Self-recovered', value: 'Self-recovered' },
            { label: 'Deceased',       value: 'Deceased' },
          ]}
          filterColorMap={{
            'Rescued':        { bg: '#dcfce7', color: '#166534', icon: 'ri-lifebuoy-line' },
            'Hospitalized':   { bg: '#dbeafe', color: '#1e40af', icon: 'ri-hospital-line' },
            'Self-recovered': { bg: '#fef9c3', color: '#854d0e', icon: 'ri-walk-line' },
            'Deceased':       { bg: '#fee2e2', color: '#991b1b', icon: 'ri-heart-pulse-line' },
          }}
          hasActiveFilters={Boolean(searchTerm || filter || dateRange.start || dateRange.end)}
        />
      )}

      {records.length === 0 ? (
        <div className="empty-state">
          <i className="ri-water-flash-line"></i>
          <h3>No Drowning Incidents Recorded</h3>
          <p>Click "Add Incident" to log a drowning incident.</p>
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
                  <th>Location</th>
                  <th>Victim Name</th>
                  <th>Water Body</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {pagedRecords.map(record => (
                  <tr key={record.id} onClick={() => handleViewDetails(record)} style={{ cursor: 'pointer', height: '49px' }} className="table-row-clickable">
                    <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                      {record.date ? format(new Date(record.date), 'MMM dd, yyyy') : '-'}
                    </td>
                    <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.location || '-'}</td>
                    <td style={{ fontWeight: '700' }}>{record.victim_name || '-'}</td>
                    <td>{record.water_body || '-'}</td>
                    <td>{getOutcomeBadge(record.outcome)}</td>
                  </tr>
                ))}
                <TableGhostRows count={Math.max(0, pageSize - pagedRecords.length)} colSpan={5} />
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
        filename="drowning_incidents_report.xlsx"
        sheetName="DrowningIncidents"
        dateField="date"
        columns={DROWNING_EXPORT_COLUMNS}
        headers={DROWNING_EXPORT_HEADERS}
        transformValue={(col, val) => {
          if (col === 'photos') {
            if (Array.isArray(val) && val.length > 0) {
              return val.join('\n')
            }
            return ''
          }
          return val
        }}
        onSuccess={(count) => toast.success(`Exported ${count} records successfully.`)}
        onError={(msg) => toast.error(msg)}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isViewing ? 'View Drowning Incident' : (isEditing ? 'Edit Drowning Incident' : 'Add Drowning Incident')}
        maxWidth="1000px"
      >
        <style>{`
          .drw-form-layout { display: flex; flex-wrap: wrap; gap: 32px; }
          .drw-details-col { flex: 1 1 420px; min-width: 0; }
          .drw-photos-col { flex: 1 1 300px; min-width: 0; border-left: 2px solid var(--border-light); padding-left: 32px; }
          @media (max-width: 1050px) {
            .drw-form-layout { flex-direction: column; gap: 24px; }
            .drw-photos-col { border-left: none; padding-left: 0; border-top: 2px solid var(--border-light); padding-top: 24px; }
          }
        `}</style>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="drw-form-layout">
            <div className="drw-details-col">
              <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                  <div className="form-row">
                    
                    <div className="form-group">
                      <label>Date *</label>
                      <input max={new Date().toISOString().split('T')[0]} type="date" name="date" value={formData.date} onChange={handleInputChange} required />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Time of Incident</label>
                      <input type="time" name="time_of_incident" value={formData.time_of_incident} onChange={handleInputChange} />
                    </div>
                    <div className="form-group">
                      <label>Response Time</label>
                      <input type="text" name="response_time" value={formData.response_time} onChange={handleInputChange} placeholder="e.g. 12 minutes" />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Location / Address</label>
                    <input type="text" name="location" value={formData.location} onChange={handleInputChange} placeholder="e.g. Brgy. Mataas na Kahoy, Palayan City" />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Latitude</label>
                      <input type="number" name="latitude" value={formData.latitude} onChange={handleInputChange} step="0.000001" placeholder="e.g. 15.5395" />
                    </div>
                    <div className="form-group">
                      <label>Longitude</label>
                      <input type="number" name="longitude" value={formData.longitude} onChange={handleInputChange} step="0.000001" placeholder="e.g. 121.1075" />
                    </div>
                  </div>

                  <div style={{ borderTop: '2px solid var(--border-light)', marginTop: '4px', paddingTop: '14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--primary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <i className="ri-user-line" style={{ marginRight: '6px' }}></i>Victim Information
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Victim Name</label>
                        <input type="text" name="victim_name" value={formData.victim_name} onChange={handleInputChange} placeholder="e.g. Juan Dela Cruz" />
                      </div>
                      <div className="form-group">
                        <label>Age</label>
                        <input type="text" name="victim_age" value={formData.victim_age} onChange={handleInputChange} placeholder="e.g. 22" />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Gender</label>
                        <select name="victim_gender" value={formData.victim_gender} onChange={handleInputChange}>
                          <option value="">-- Select --</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Water Body</label>
                        <input type="text" name="water_body" value={formData.water_body} onChange={handleInputChange} placeholder="e.g. Pantabangan Dam, Irrigation Canal" />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Victim Address</label>
                      <input type="text" name="victim_address" value={formData.victim_address} onChange={handleInputChange} placeholder="e.g. Brgy. Poblacion, Palayan City" />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Cause of Drowning</label>
                      <input type="text" name="cause" value={formData.cause} onChange={handleInputChange} placeholder="e.g. Swimming accident, Flood" />
                    </div>
                    <div className="form-group">
                      <label>Outcome</label>
                      <select name="outcome" value={formData.outcome} onChange={handleInputChange}>
                        <option value="">-- Select --</option>
                        <option value="Rescued">Rescued</option>
                        <option value="Hospitalized">Hospitalized</option>
                        <option value="Self-recovered">Self-recovered</option>
                        <option value="Deceased">Deceased</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Team Name</label>
                      <select name="team" value={formData.team} onChange={handleInputChange}>
                        <option value="">-- Select Team --</option>
                        <option value="Alpha">Alpha</option>
                        <option value="Bravo">Bravo</option>
                        <option value="Charlie">Charlie</option>
                        <option value="Delta">Delta</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="form-group">
                      {formData.team === 'Other' ? (
                        <>
                          <label>Specify Team</label>
                          <input
                            type="text"
                            name="responders"
                            value={formData.responders || ''}
                            onChange={handleInputChange}
                            placeholder="e.g. Echo Team"
                          />
                        </>
                      ) : (
                        <>
                          <label>Responder</label>
                          <input type="text" name="responders" value={formData.responders} onChange={handleInputChange} placeholder="e.g. Juan Dela Cruz" />
                        </>
                      )}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Remarks / Narrative</label>
                    <textarea name="remarks" value={formData.remarks} onChange={handleInputChange} rows={3} placeholder="Provide a narrative of the incident..." />
                  </div>

                </div>
              </fieldset>
            </div>

            <div className="drw-photos-col">
              <PhotoUploadPanel
                title="Incident Photos"
                emptyMessage="No photos uploaded for this incident yet."
                photos={formData.photos}
                pendingPhotos={pendingPhotos}
                isViewing={isViewing}
                isUploading={isUploading}
                isSaving={isSaving}
                onFileUpload={handleFileUpload}
                onRemoveExisting={removeExistingPhoto}
                onRemovePending={removePendingPhoto}
                minHeight="300px"
              />
            </div>
          </div>

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
            <div></div>
            {isViewing ? (
              <div style={{ display: 'flex', gap: '12px' }}>
                {(isAdmin || canDelete) && (
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
                <button type="submit" className="btn-submit" disabled={isSaving || isUploading}>
                  {isSaving || isUploading ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </div>
  )
}
