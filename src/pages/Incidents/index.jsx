import { validateForm } from '../../utils/validation'
import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { uploadFile, deleteFiles } from '../../services/storage'
import { compressImage } from '../../utils/imageCompression'
import { logAudit } from '../../services/audit'
import { format } from 'date-fns'
import Modal from '../../components/Modal'
import ModuleToolbar from '../../components/ModuleToolbar'
import ListPagination from '../../components/ListPagination'
import ExportModal from '../../components/ExportModal'
import TableGhostRows from '../../components/TableGhostRows'
import PhotoUploadPanel from '../../components/PhotoUploadPanel'
import useListPagination from '../../hooks/useListPagination'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'

// Convert any time value (HH:MM, full datetime string, etc.) to h:mm AM/PM
const formatTime = (t) => {
  if (!t) return '-'
  const str = String(t).trim()

  // Try to extract HH:MM from any format
  // Matches: "08:30", "08:30:00", "Sat Dec 30 1899 12:13:00", ISO strings, etc.
  const match = str.match(/(\d{1,2}):(\d{2})/)
  if (!match) return str

  const h = parseInt(match[1], 10)
  const m = match[2]
  if (isNaN(h)) return str
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m} ${period}`
}

const INITIAL_FORM_STATE = {
  record_id: '',
  team: '',
  date: '',
  time_of_call: '',
  severity: 'Low',
  remarks: '',
  time_of_arrival_at_scene: '',
  time_of_departure_at_scene: '',
  time_of_arrival_at_hosp: '',
  time_of_departure_at_hosp: '',
  back_to_base: '',
  place_of_incident: '',
  nature_of_incident: '',
  name: '',
  age: '',
  address: '',
  injury_illness_complaint: '',
  vehicle: '',
  vehicle_other: '',
  helmet: '',
  liquor: '',
  action_given: '',
  transfer_from: '',
  transfer_to: '',
  transfer_to_other: '',
  ambulance: '',
  refused_transfer: false,
  exact_place: '',
  specific_location: '',
  caller_name: '',
  caller_contact: '',
  casualties: '',
  fatalities: '',
  photos: []
}

const INCIDENT_EXPORT_COLUMNS = [
  'record_id', 'date', 'time_of_call', 'team',
  'place_of_incident', 'exact_place',
  'nature_of_incident', 'severity',
  'name', 'age', 'address', 'injury_illness_complaint',
  'vehicle', 'vehicle_other', 'helmet', 'liquor',
  'time_of_arrival_at_scene', 'time_of_departure_at_scene',
  'time_of_arrival_at_hosp', 'time_of_departure_at_hosp', 'back_to_base',
  'action_given', 'refused_transfer',
  'transfer_from', 'transfer_to', 'transfer_to_other', 'ambulance',
  'remarks',
]

const INCIDENT_EXPORT_HEADERS = {
  record_id: 'Record ID', date: 'Date', time_of_call: 'Time of Call', team: 'Team',
  place_of_incident: 'Place of Incident', exact_place: 'Exact Place',
  nature_of_incident: 'Nature of Incident', severity: 'Severity',
  name: 'Victim Name', age: 'Age', address: 'Address', injury_illness_complaint: 'Injury / Illness',
  vehicle: 'Vehicle', vehicle_other: 'Vehicle (Other)', helmet: 'Helmet', liquor: 'Liquor',
  time_of_arrival_at_scene: 'Arrival at Scene', time_of_departure_at_scene: 'Departure at Scene',
  time_of_arrival_at_hosp: 'Arrival at Hospital', time_of_departure_at_hosp: 'Departure at Hospital',
  back_to_base: 'Back to Base',
  action_given: 'Action Given', refused_transfer: 'Refused Transfer',
  transfer_from: 'Transfer From', transfer_to: 'Transfer To',
  transfer_to_other: 'Transfer To (Other)', ambulance: 'Ambulance',
  remarks: 'Remarks',
}

export default function Incidents() {
  const [incidents, setIncidents] = useState([])
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
  const [activeTab, setActiveTab] = useState('general')
  const isAdmin = useIsAdmin()
  const { canCreate, canUpdate, canDelete } = usePermissions('incidents')
  const toast = useToast()
  const confirm = useConfirm()


  // Toolbar / filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTeam, setFilterTeam] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  const [isExportOpen, setIsExportOpen] = useState(false)

  useEffect(() => {
    loadIncidents()
  }, [])

  const filteredRecords = incidents.filter(item => {
    let matchesSearch = true
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase()
      matchesSearch = Object.values(item).some(val =>
        val && typeof val === 'string' && val.toLowerCase().includes(lowerSearch)
      )
    }

    const KNOWN_TEAMS = ['alpha', 'bravo', 'charlie', 'delta']
    const itemTeam = (item.team || '').trim().toLowerCase()
    const matchesTeam = !filterTeam
      || (filterTeam === 'Other'
          ? !KNOWN_TEAMS.includes(itemTeam)
          : itemTeam === filterTeam.toLowerCase())

    let matchesDate = true
    if (dateRange.start && dateRange.end) {
      const dateStr = item.date || item.created_at
      if (dateStr) {
        const created = new Date(dateStr)
        const start = new Date(dateRange.start)
        const end = new Date(dateRange.end)
        end.setHours(23, 59, 59, 999)
        matchesDate = created >= start && created <= end
      }
    }

    return matchesSearch && matchesTeam && matchesDate
  }).sort((a, b) => {
    const da = new Date(a.date || a.created_at || 0)
    const db = new Date(b.date || b.created_at || 0)
    return db - da
  })

  const { currentPage, setCurrentPage, pageSize, setPageSize, totalPages, safePage, pagedRecords } = useListPagination(filteredRecords)

  const loadIncidents = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .order('date', { ascending: false })

      if (error) throw error
      setIncidents(data || [])
    } catch (err) {
      console.error('Error loading incidents:', err)
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
    setActiveTab('general')
    setPendingPhotos([])
    // Generate incident ID
    const year = new Date().getFullYear()
    const rand = Math.floor(1000 + Math.random() * 9000)

    setFormData({
      ...INITIAL_FORM_STATE,
      record_id: `INC-${year}-${rand}`
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (inc) => {
    setIsEditing(true)
    setIsViewing(false)
    setSelectedId(inc.id)
    setActiveTab('general')
    setPendingPhotos([])

    // Handle vehicle value — if it's not one of the known options, put it in vehicle_other
    const knownVehicles = ['', 'N/A', 'Single Motor', 'Tricycle', 'Kolong kolong', 'Other']
    let vehicleVal = inc.vehicle || ''
    let vehicleOtherVal = inc.vehicle_other || ''
    if (vehicleVal && !knownVehicles.includes(vehicleVal)) {
      vehicleOtherVal = vehicleVal
      vehicleVal = 'Other'
    }

    setFormData({
      ...INITIAL_FORM_STATE,
      ...inc,
      vehicle: vehicleVal,
      vehicle_other: vehicleOtherVal,
      photos: inc.photos || []
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

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files)
    if (!files || files.length === 0) return

    setPendingPhotos(prev => [...prev, ...files])
  }

  const removeExistingPhoto = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, idx) => idx !== indexToRemove)
    }))
  }

  const removePendingPhoto = (indexToRemove) => {
    setPendingPhotos(prev => prev.filter((_, idx) => idx !== indexToRemove))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Pre-submit validation
    const errors = validateForm({
      'Patient Name': { rule: 'name', value: formData.name, required: true },
    })
    if (Object.keys(errors).length > 0) {
      Object.values(errors).forEach(msg => toast.error(msg))
      return
    }

    setIsSaving(true)

    try {
      let newPhotoUrls = []
      
      // Upload pending photos first
      if (pendingPhotos.length > 0) {
        setIsUploading(true)
        try {
          for (const file of pendingPhotos) {
            const compressedFile = await compressImage(file, 800, 0.6)
            const path = `incident-photos/${Date.now()}-${compressedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            const url = await uploadFile('incidents', path, compressedFile)
            newPhotoUrls.push(url)
          }
        } catch (error) {
          console.error('Upload error:', error)
          toast.error('Failed to upload some photos. Did you create the public "incidents" bucket in Supabase?')
          throw error // Abort save if uploads fail
        } finally {
          setIsUploading(false)
        }
      }

      const dataToSave = {
        ...formData,
        photos: [...(formData.photos || []), ...newPhotoUrls],
        age: formData.age === '' ? null : parseInt(formData.age, 10)
      }

      if (isEditing) {
        const { data, error } = await supabase
          .from('incidents')
          .update(dataToSave)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setIncidents(filteredRecords.map(inc => inc.id === selectedId ? data[0] : inc))
        await logAudit('Updated', 'Incidents', formData.record_id || formData.id || selectedId, 'Updated record details')
        toast.success('Incident updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('incidents')
          .insert([dataToSave])
          .select()

        if (error) throw error
        setIncidents([data[0], ...incidents])
        toast.success('Incident reported successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving incident:', err)
      toast.error('Error saving incident: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This incident record will be permanently removed. This action cannot be undone.', { title: 'Delete Record' })
    if (!ok) return

    try {
      // Find the record to get its photos
      const recordToDelete = incidents.find(inc => inc.id === id)
      if (recordToDelete && recordToDelete.photos && recordToDelete.photos.length > 0) {
        // Extract the file paths from the full URLs
        const pathsToDelete = recordToDelete.photos
          .map(url => {
            const idx = url.indexOf('incident-photos/')
            return idx !== -1 ? url.substring(idx) : null
          })
          .filter(Boolean)
        
        if (pathsToDelete.length > 0) {
          await deleteFiles('incidents', pathsToDelete)
        }
      }

      const { error } = await supabase
        .from('incidents')
        .delete()
        .eq('id', id)

      if (error) throw error

      setIncidents(incidents.filter(inc => inc.id !== id))
      await logAudit('Deleted', 'Incidents', id, 'Deleted record')
      toast.success('Incident report deleted successfully!')
    } catch (err) {
      console.error('Error deleting incident:', err)
      toast.error('Failed to delete incident: ' + err.message)
    }
  }

  const getSeverityBadge = (severity) => {
    const colors = {
      'Low': { bg: '#d1fae5', color: '#065f46' },
      'Medium': { bg: '#fef3c7', color: '#92400e' },
      'High': { bg: '#fed7aa', color: '#9a3412' },
      'Critical': { bg: '#fee2e2', color: '#991b1b' }
    }
    const style = colors[severity] || colors['Low']

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
        {severity || 'Low'}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading incidents...</p>
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
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading Incidents</h3>
          <p>{error}</p>
          <button
            onClick={loadIncidents}
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
          <i className="ri-alarm-warning-line" style={{ marginRight: '12px' }}></i>
          Incident Reports
        </h2>
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: (isAdmin || canCreate) ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Report Incident
        </button>
      </div>


      {incidents.length > 0 && (
        <ModuleToolbar
          onSearch={(v) => { setSearchTerm(v); setCurrentPage(1) }}
          onDateRangeChange={(r) => { setDateRange(r); setCurrentPage(1) }}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          onExportClick={() => setIsExportOpen(true)}
          onClearFilters={() => { setSearchTerm(''); setFilterTeam(''); setDateRange({ start: '', end: '' }); setCurrentPage(1) }}
          hasActiveFilters={Boolean(searchTerm || filterTeam || dateRange.start || dateRange.end)}
        >
          <select
            value={filterTeam}
            onChange={e => { setFilterTeam(e.target.value); setCurrentPage(1) }}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontSize: '13px', color: filterTeam ? 'var(--text)' : 'var(--text-muted)', cursor: 'pointer', minWidth: '130px' }}
          >
            <option value="">All Teams</option>
            <option value="Alpha">Alpha</option>
            <option value="Bravo">Bravo</option>
            <option value="Charlie">Charlie</option>
            <option value="Delta">Delta</option>
            <option value="Other">Other</option>
          </select>
        </ModuleToolbar>
      )}

      {incidents.length === 0 ? (
        <div className="empty-state">
          <i className="ri-alarm-warning-line"></i>
          <h3>No Incidents Reported</h3>
          <p>Click "Report Incident" to log your first incident.</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="empty-state">
          <i className="ri-filter-off-line"></i>
          <h3>No Matching Records</h3>
          <p>Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="data-table">
          <table style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '13%'  }} />{/* Date */}
              <col style={{ width: '9%'   }} />{/* Time of Call */}
              <col style={{ width: '8%'   }} />{/* Team */}
              <col style={{ width: '25%'  }} />{/* Nature */}
              <col style={{ width: '17%'  }} />{/* Victim */}
              <col />{/* Place — remaining */}
            </colgroup>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time of Call</th>
                <th>Team</th>
                <th>Nature of Incident</th>
                <th>Victim</th>
                <th>Place of Incident</th>
              </tr>
            </thead>
            <tbody>
              {pagedRecords.map((incident) => (
                <tr
                  key={incident.id}
                  onClick={() => handleViewDetails(incident)}
                  style={{ cursor: 'pointer', height: '49px' }}
                  className="table-row-clickable"
                >
                  <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px' }}>
                    {incident.date ? format(new Date(incident.date), 'MMM dd, yyyy') : '-'}
                  </td>
                  <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '13px' }}>
                    {formatTime(incident.time_of_call)}
                  </td>
                  <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {incident.team ? (
                      <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '700', background: '#eff6ff', color: '#1d4ed8' }}>
                        {incident.team}
                      </span>
                    ) : '-'}
                  </td>
                  <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '600' }}>
                    {incident.nature_of_incident || '-'}
                  </td>
                  <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {incident.name || '-'}
                  </td>
                  <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {incident.place_of_incident || '-'}
                  </td>
                </tr>
              ))}
              <TableGhostRows count={Math.max(0, pageSize - pagedRecords.length)} colSpan={6} />
            </tbody>
          </table>
        </div>
      )}

      {filteredRecords.length > 0 && (
        <ListPagination
          currentPage={safePage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalRecords={filteredRecords.length}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isViewing ? 'View Details' : (isEditing ? 'Edit Incident Report' : 'New Incident Report')}
        maxWidth="1000px"
      >
        <form onSubmit={handleSubmit} className="modal-form">
          {/* Tabs Navigation */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px', borderBottom: '2px solid var(--border-light)' }}>
              {[
                { id: 'general', label: 'General & Location' },
                { id: 'victim', label: 'Victim & Vehicle' },
                { id: 'time', label: 'Time Logs' },
                { id: 'action', label: 'Action' },
                { id: 'photos', label: 'Photos' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontWeight: '700',
                    fontSize: '13px',
                    whiteSpace: 'nowrap',
                    background: activeTab === tab.id ? 'var(--primary)' : 'var(--bg-app)',
                    color: activeTab === tab.id ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '350px' }}>
                {activeTab === 'general' && (
                <>
                  <h4 style={{ margin: '0 0 8px 0', color: 'var(--primary)' }}>General Info</h4>
                  <div className="form-row" style={{ gap: '12px' }}>
                    
                    <div className="form-group">
                    <label style={{ marginBottom: '4px', fontWeight: '600' }}>TEAM *</label>
                    {isViewing ? (
                      <div style={{ padding: '8px 12px', background: '#f3f4f6', borderRadius: '8px', fontWeight: '600', fontSize: '14px', border: '1px solid var(--border-light)', minHeight: '38px', display: 'flex', alignItems: 'center' }}>
                        {formData.team || <span style={{ color: 'var(--text-muted)', fontWeight: '400' }}>—</span>}
                      </div>
                    ) : (
                      <select name="team" value={formData.team} onChange={handleInputChange} style={{ padding: '8px' }} required>
                        <option value="">Select Team...</option>
                        <option value="Alpha">Alpha</option>
                        <option value="Bravo">Bravo</option>
                        <option value="Charlie">Charlie</option>
                        <option value="Delta">Delta</option>
                      </select>
                    )}
                    </div>
                  </div>
                  <div className="form-row" style={{ gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label style={{ marginBottom: '4px', fontWeight: '600' }}>Date *</label>
                      <input max={new Date().toISOString().split('T')[0]} type="date" name="date" value={formData.date} onChange={handleInputChange} required style={{ padding: '6px' }} />
                    </div>
                    <div className="form-group">
                    <label style={{ marginBottom: '4px', fontWeight: '600' }}>TIME OF CALL *</label>
                    <input type="time" name="time_of_call" value={formData.time_of_call} onChange={handleInputChange} style={{ padding: '8px' }} required />
                    </div>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '12px 0' }} />

                  <h4 style={{ margin: '0 0 8px 0', color: 'var(--primary)' }}>Location</h4>
                  <div className="form-row" style={{ gap: '12px' }}>
                    <div className="form-group">
                    <label style={{ marginBottom: '4px', fontWeight: '600' }}>PLACE OF INCIDENT (BARANGAY) *</label>
                    <input type="text" name="place_of_incident" value={formData.place_of_incident} onChange={handleInputChange} placeholder="Barangay name" style={{ padding: '8px' }} required />
                    </div>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label style={{ marginBottom: '4px', fontWeight: '600' }}>Exact Place</label>
                      <input type="text" name="exact_place" value={formData.exact_place} onChange={handleInputChange} placeholder="Street, landmark, etc." style={{ padding: '6px' }} />
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'victim' && (
                <>
                  <h4 style={{ margin: '0 0 8px 0', color: 'var(--primary)' }}>Victim & Incident details</h4>
                  <div className="form-row" style={{ gap: '12px' }}>
                    <div className="form-group" style={{ flex: '2' }}>
                      <label style={{ marginBottom: '4px', fontWeight: '600' }}>NAME *</label>
                      <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="Patient's name" style={{ padding: '8px' }} required />
                    </div>
                    <div className="form-group" style={{ flex: '1' }}>
                      <label style={{ marginBottom: '4px', fontWeight: '600' }}>AGE *</label>
                      <input type="number" name="age" value={formData.age} onChange={handleInputChange} placeholder="Age" min="0" style={{ padding: '8px' }} required />
                    </div>
                  </div>
                  <div className="form-group">
                    <label style={{ marginBottom: '4px', fontWeight: '600' }}>ADDRESS *</label>
                    <input type="text" name="address" value={formData.address} onChange={handleInputChange} placeholder="Patient's address" style={{ padding: '8px' }} required />
                  </div>
                  <div className="form-row" style={{ gap: '12px' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label style={{ marginBottom: '4px', fontWeight: '600' }}>NATURE OF INCIDENT *</label>
                      <input type="text" name="nature_of_incident" value={formData.nature_of_incident} onChange={handleInputChange} placeholder="e.g. Vehicular Accident, Medical Emergency" style={{ padding: '8px' }} required />
                    </div>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label style={{ marginBottom: '4px', fontWeight: '600' }}>Severity *</label>
                      <select name="severity" value={formData.severity} onChange={handleInputChange} required style={{ padding: '6px' }}>
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: '8px' }}>
                    <label style={{ marginBottom: '4px', fontWeight: '600' }}>Injury / Illness Complaint</label>
                    <textarea name="injury_illness_complaint" value={formData.injury_illness_complaint} onChange={handleInputChange} rows={3} placeholder="Describe injuries or complaints..." style={{ padding: '6px' }} />
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '12px 0' }} />

                  <h4 style={{ margin: '0 0 8px 0', color: 'var(--primary)' }}>Vehicular Incident (if applicable)</h4>
                  <div className="form-row" style={{ gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label style={{ marginBottom: '4px', fontWeight: '600' }}>Vehicle</label>
                      {isViewing ? (
                        <div style={{ padding: '8px 12px', background: '#f3f4f6', borderRadius: '8px', fontWeight: '600', fontSize: '14px', border: '1px solid var(--border-light)' }}>
                          {formData.vehicle === 'Other'
                            ? (formData.vehicle_other ? `Other — ${formData.vehicle_other}` : 'Other')
                            : (formData.vehicle || 'N/A')}
                        </div>
                      ) : (
                        <select name="vehicle" value={formData.vehicle} onChange={handleInputChange} style={{ padding: '6px' }}>
                          <option value="N/A">N/A</option>
                          <option value="Single Motor">Single Motor</option>
                          <option value="Tricycle">Tricycle</option>
                          <option value="Kolong kolong">Kolong kolong</option>
                          <option value="Other">Other</option>
                        </select>
                      )}
                    </div>
                    {!isViewing && formData.vehicle === 'Other' && (
                      <div className="form-group" style={{ marginBottom: '8px' }}>
                        <label style={{ marginBottom: '4px', fontWeight: '600' }}>Specify Vehicle</label>
                        <input type="text" name="vehicle_other" value={formData.vehicle_other} onChange={handleInputChange} placeholder="Specify other vehicle" style={{ padding: '6px' }} />
                      </div>
                    )}
                  </div>

                  {/* Helmet & Liquor — badge UI */}
                  <div className="form-row" style={{ marginTop: '8px', gap: '16px' }}>
                    {/* Helmet */}
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label style={{ marginBottom: '6px', fontWeight: '600' }}>Helmet</label>
                      {isViewing ? (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '6px 14px', borderRadius: '20px', fontWeight: '700', fontSize: '13px',
                          background: formData.helmet === 'Positive' ? '#dcfce7' : formData.helmet === 'Negative' ? '#fee2e2' : '#f3f4f6',
                          color: formData.helmet === 'Positive' ? '#15803d' : formData.helmet === 'Negative' ? '#b91c1c' : '#6b7280',
                          border: `1px solid ${formData.helmet === 'Positive' ? '#bbf7d0' : formData.helmet === 'Negative' ? '#fecaca' : '#e5e7eb'}`
                        }}>
                          <i className={formData.helmet === 'Positive' ? 'ri-checkbox-circle-fill' : formData.helmet === 'Negative' ? 'ri-close-circle-fill' : 'ri-question-mark'} />
                          {formData.helmet || 'Not set'}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {['Positive', 'Negative'].map(val => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => handleInputChange({ target: { name: 'helmet', value: val } })}
                              style={{
                                padding: '6px 16px', borderRadius: '20px', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                                border: `2px solid ${formData.helmet === val ? (val === 'Positive' ? '#16a34a' : '#dc2626') : '#e5e7eb'}`,
                                background: formData.helmet === val ? (val === 'Positive' ? '#dcfce7' : '#fee2e2') : '#f9fafb',
                                color: formData.helmet === val ? (val === 'Positive' ? '#15803d' : '#b91c1c') : '#6b7280',
                                transition: 'all 0.15s'
                              }}
                            >
                              {val === 'Positive' ? '✓ Positive' : '✗ Negative'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Liquor */}
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label style={{ marginBottom: '6px', fontWeight: '600' }}>Liquor Involvement</label>
                      {isViewing ? (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '6px 14px', borderRadius: '20px', fontWeight: '700', fontSize: '13px',
                          background: formData.liquor === 'Positive' ? '#dcfce7' : formData.liquor === 'Negative' ? '#fee2e2' : '#f3f4f6',
                          color: formData.liquor === 'Positive' ? '#15803d' : formData.liquor === 'Negative' ? '#b91c1c' : '#6b7280',
                          border: `1px solid ${formData.liquor === 'Positive' ? '#bbf7d0' : formData.liquor === 'Negative' ? '#fecaca' : '#e5e7eb'}`
                        }}>
                          <i className={formData.liquor === 'Positive' ? 'ri-checkbox-circle-fill' : formData.liquor === 'Negative' ? 'ri-close-circle-fill' : 'ri-question-mark'} />
                          {formData.liquor || 'Not set'}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {['Positive', 'Negative'].map(val => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => handleInputChange({ target: { name: 'liquor', value: val } })}
                              style={{
                                padding: '6px 16px', borderRadius: '20px', fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                                border: `2px solid ${formData.liquor === val ? (val === 'Positive' ? '#16a34a' : '#dc2626') : '#e5e7eb'}`,
                                background: formData.liquor === val ? (val === 'Positive' ? '#dcfce7' : '#fee2e2') : '#f9fafb',
                                color: formData.liquor === val ? (val === 'Positive' ? '#15803d' : '#b91c1c') : '#6b7280',
                                transition: 'all 0.15s'
                              }}
                            >
                              {val === 'Positive' ? '✓ Positive' : '✗ Negative'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'time' && (
                <>
                  <h4 style={{ margin: '0 0 16px 0', color: 'var(--primary)' }}>Time Logs</h4>
                  {isViewing ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      {[
                        { label: 'Time of Call',          value: formData.time_of_call },
                        { label: 'Arrival at Scene',       value: formData.time_of_arrival_at_scene },
                        { label: 'Departure at Scene',     value: formData.time_of_departure_at_scene },
                        { label: 'Arrival at Hospital',    value: formData.time_of_arrival_at_hosp },
                        { label: 'Departure at Hospital',  value: formData.time_of_departure_at_hosp },
                        { label: 'Back to Base',           value: formData.back_to_base },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ background: 'var(--bg-app)', borderRadius: '8px', padding: '12px 16px', border: '1px solid var(--border-light)' }}>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{label}</div>
                          <div style={{ fontSize: '16px', fontWeight: '700', color: value ? 'var(--text)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                            {value ? formatTime(value) : <span style={{ fontSize: '13px', fontWeight: '400' }}>— not recorded —</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="form-row" style={{ gap: '12px' }}>
                        <div className="form-group">
                          <label style={{ marginBottom: '4px', fontWeight: '600' }}>ARRIVAL AT SCENE *</label>
                          <input type="time" name="time_of_arrival_at_scene" value={formData.time_of_arrival_at_scene} onChange={handleInputChange} style={{ padding: '8px' }} required />
                        </div>
                        <div className="form-group">
                          <label style={{ marginBottom: '4px', fontWeight: '600' }}>DEPARTURE AT SCENE *</label>
                          <input type="time" name="time_of_departure_at_scene" value={formData.time_of_departure_at_scene} onChange={handleInputChange} style={{ padding: '8px' }} required />
                        </div>
                      </div>
                      <div className="form-row" style={{ gap: '12px' }}>
                        <div className="form-group" style={{ marginBottom: '8px' }}>
                          <label style={{ marginBottom: '4px', fontWeight: '600' }}>Arrival at Hosp.</label>
                          <input type="time" name="time_of_arrival_at_hosp" value={formData.time_of_arrival_at_hosp} onChange={handleInputChange} style={{ padding: '6px' }} />
                        </div>
                        <div className="form-group" style={{ marginBottom: '8px' }}>
                          <label style={{ marginBottom: '4px', fontWeight: '600' }}>Departure at Hosp.</label>
                          <input type="time" name="time_of_departure_at_hosp" value={formData.time_of_departure_at_hosp} onChange={handleInputChange} style={{ padding: '6px' }} />
                        </div>
                      </div>
                      <div className="form-row" style={{ gap: '12px' }}>
                        <div className="form-group" style={{ marginBottom: '8px' }}>
                          <label style={{ marginBottom: '4px', fontWeight: '600' }}>Back to Base</label>
                          <input type="time" name="back_to_base" value={formData.back_to_base} onChange={handleInputChange} style={{ padding: '6px' }} />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {activeTab === 'action' && (
                <>
                  <h4 style={{ margin: '0 0 8px 0', color: 'var(--primary)' }}>Action</h4>
                  <div className="form-group" style={{ marginBottom: '8px' }}>
                    <label style={{ marginBottom: '4px', fontWeight: '600' }}>Action Given *</label>
                    <textarea name="action_given" value={formData.action_given} onChange={handleInputChange} rows={3} placeholder="Action taken..." style={{ padding: '6px' }} required />
                  </div>

                  <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px', marginBottom: '16px', marginTop: '8px' }}>
                    <input type="checkbox" id="refused_transfer" name="refused_transfer" checked={formData.refused_transfer} onChange={handleInputChange} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                    <label htmlFor="refused_transfer" style={{ marginBottom: 0, color: 'var(--primary)', fontWeight: '700', cursor: 'pointer' }}>Patient Refused Transfer</label>
                  </div>

                  {!formData.refused_transfer && (
                    <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                      <div className="form-row" style={{ gap: '12px' }}>
                        <div className="form-group" style={{ marginBottom: '8px' }}>
                          <label style={{ marginBottom: '4px', fontWeight: '600' }}>Transfer From *</label>
                          <input type="text" name="transfer_from" value={formData.transfer_from} onChange={handleInputChange} placeholder="Origin" style={{ padding: '6px' }} required />
                        </div>
                        <div className="form-group" style={{ marginBottom: '8px' }}>
                          <label style={{ marginBottom: '4px', fontWeight: '600' }}>Transfer To *</label>
                          <select name="transfer_to" value={formData.transfer_to} onChange={handleInputChange} style={{ padding: '6px' }} required>
                            <option value="">Select Hospital / Destination...</option>
                            <option value="PJG">PJG (Dr. Paulino J. Garcia Memorial Research and Medical Center)</option>
                            <option value="Good Sam">Good Samaritan Hospital</option>
                            <option value="Eduardo">Eduardo L. Joson Memorial Hospital</option>
                            <option value="Nueva Ecija Doctors">Nueva Ecija Doctors Hospital</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                      </div>
                      {formData.transfer_to === 'Other' && (
                        <div className="form-group" style={{ marginBottom: '8px' }}>
                          <label style={{ marginBottom: '4px', fontWeight: '600' }}>Specify Destination</label>
                          <input type="text" name="transfer_to_other" value={formData.transfer_to_other} onChange={handleInputChange} placeholder="Specify other destination" style={{ padding: '6px' }} />
                        </div>
                      )}
                      <div className="form-row" style={{ alignItems: 'center', gap: '12px' }}>
                        <div className="form-group" style={{ flex: 1, marginBottom: '8px' }}>
                          <label style={{ marginBottom: '4px', fontWeight: '600' }}>Ambulance (Plate No. / Designation) *</label>
                          <input type="text" name="ambulance" value={formData.ambulance} onChange={handleInputChange} placeholder="Ambulance assigned" style={{ padding: '6px' }} required />
                        </div>
                      </div>
                    </div>
                  )}

                  <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '12px 0' }} />

                  <h4 style={{ margin: '0 0 8px 0', color: 'var(--primary)' }}>Remarks</h4>
                  <div className="form-group" style={{ marginBottom: '8px' }}>
                    <textarea name="remarks" value={formData.remarks} onChange={handleInputChange} rows={3} placeholder="Additional notes..." style={{ padding: '6px' }} />
                  </div>
                </>
              )}

              {activeTab === 'photos' && (
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
                />
              )}
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
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        records={incidents}
        filename="incidents_report.xlsx"
        sheetName="Incidents"
        dateField="date"
        columns={INCIDENT_EXPORT_COLUMNS}
        headers={INCIDENT_EXPORT_HEADERS}
        transformValue={(col, val) => (col === 'refused_transfer' ? (val ? 'Yes' : 'No') : val)}
        onSuccess={(count) => toast.success(`Exported ${count} records successfully.`)}
        onError={(msg) => toast.error(msg)}
      />
    </div>
  )
}
