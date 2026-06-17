import ModuleToolbar from '../../components/ModuleToolbar'
import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { uploadFile, deleteFiles } from '../../services/storage'
import { compressImage } from '../../utils/imageCompression'
import { logAudit } from '../../services/audit'
import { format } from 'date-fns'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'

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
  photos: []
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
  const toast = useToast()
  const confirm = useConfirm()


  // Toolbar states
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

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

    let matchesFilter = true

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

    return matchesSearch && matchesFilter && matchesDate
  })

  const loadIncidents = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .order('created_at', { ascending: false })

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

    setFormData({
      ...INITIAL_FORM_STATE,
      ...inc,
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
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: isAdmin ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Report Incident
        </button>
      </div>


      {incidents.length > 0 && (
        <ModuleToolbar
          onSearch={setSearchTerm}
          onFilterChange={setFilter}
          onDateRangeChange={setDateRange}
          exportData={filteredRecords}
          exportFilename="incidents_report.xlsx"
        />
      )}

      {incidents.length === 0 ? (
        <div className="empty-state">
          <i className="ri-alarm-warning-line"></i>
          <h3>No Incidents Reported</h3>
          <p>Click "Report Incident" to log your first incident.</p>
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Date</th>
                <th>Team</th>
                <th>Nature of Incident</th>
                <th>Victim</th>
                <th>Place of Incident</th>
                <th>Severity</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((incident) => (
                <tr
                  key={incident.id}
                  onClick={() => handleViewDetails(incident)}
                  style={{ cursor: 'pointer' }}
                  className="table-row-clickable"
                >
                  <td><code style={{ fontWeight: '700' }}>{incident.record_id || '-'}</code></td>
                  <td>{incident.date ? format(new Date(incident.date), 'MMM dd, yyyy') : '-'}</td>
                  <td>{incident.team || '-'}</td>
                  <td style={{ fontWeight: '700' }}>{incident.nature_of_incident || '-'}</td>
                  <td>{incident.name || '-'}</td>
                  <td>
                    <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {incident.place_of_incident || '-'}
                    </div>
                  </td>
                  <td>{getSeverityBadge(incident.severity)}</td>
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
        Showing <strong>{filteredRecords.length}</strong> of <strong>{incidents.length}</strong>
      </div>

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
                    background: activeTab === tab.id ? 'var(--primary)' : '#f3f4f6',
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
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label style={{ marginBottom: '4px', fontWeight: '600' }}>Record ID *</label>
                      <input type="text" name="record_id" value={formData.record_id} onChange={handleInputChange} required disabled style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280', padding: '6px' }} />
                    </div>
                    <div className="form-group">
                    <label style={{ marginBottom: '4px', fontWeight: '600' }}>TEAM *</label>
                    <select name="team" value={formData.team} onChange={handleInputChange} style={{ padding: '8px' }} required>
                        <option value="">Select Team...</option>
                        <option value="Alpha">Alpha</option>
                        <option value="Bravo">Bravo</option>
                        <option value="Charlie">Charlie</option>
                        <option value="Delta">Delta</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row" style={{ gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label style={{ marginBottom: '4px', fontWeight: '600' }}>Date *</label>
                      <input type="date" name="date" value={formData.date} onChange={handleInputChange} required style={{ padding: '6px' }} />
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
                      <select name="vehicle" value={formData.vehicle} onChange={handleInputChange} style={{ padding: '6px' }}>
                        <option value="N/A">N/A</option>
                        <option value="Single Motor">Single Motor</option>
                        <option value="Tricycle">Tricycle</option>
                        <option value="Kolong kolong">Kolong kolong</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    {formData.vehicle === 'Other' && (
                      <div className="form-group" style={{ marginBottom: '8px' }}>
                        <label style={{ marginBottom: '4px', fontWeight: '600' }}>Specify Vehicle</label>
                        <input type="text" name="vehicle_other" value={formData.vehicle_other} onChange={handleInputChange} placeholder="Specify other vehicle" style={{ padding: '6px' }} />
                      </div>
                    )}
                  </div>
                  <div className="form-row" style={{ marginTop: '4px', gap: '16px' }}>
                    <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                      <input type="checkbox" id="helmet" name="helmet" checked={formData.helmet === 'Positive'} onChange={(e) => handleInputChange({ target: { name: 'helmet', value: e.target.checked ? 'Positive' : 'Negative' } })} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                      <label htmlFor="helmet" style={{ marginBottom: 0, fontWeight: '600', cursor: 'pointer' }}>Helmet (Positive)</label>
                    </div>
                    <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                      <input type="checkbox" id="liquor" name="liquor" checked={formData.liquor === 'Positive'} onChange={(e) => handleInputChange({ target: { name: 'liquor', value: e.target.checked ? 'Positive' : 'Negative' } })} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                      <label htmlFor="liquor" style={{ marginBottom: 0, fontWeight: '600', cursor: 'pointer' }}>Liquor Involvement (Positive)</label>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'time' && (
                <>
                  <h4 style={{ margin: '0 0 8px 0', color: 'var(--primary)' }}>Time Logs</h4>
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
                    <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
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
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h4 style={{ margin: 0, color: 'var(--primary)' }}>Incident Photos</h4>
                    {!isViewing && (
                      <div style={{ position: 'relative' }}>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleFileUpload}
                          disabled={isUploading}
                          style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            opacity: 0, cursor: isUploading ? 'not-allowed' : 'pointer',
                            width: '100%'
                          }}
                        />
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={isUploading || isSaving}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          {(isUploading || isSaving) ? <i className="ri-loader-4-line ri-spin" style={{ fontSize: '16px' }}></i> : <i className="ri-camera-line" style={{ fontSize: '16px' }}></i>}
                          {(isUploading || isSaving) ? 'Uploading...' : 'Add Photos'}
                        </button>
                      </div>
                    )}
                  </div>

                  {(!formData.photos || formData.photos.length === 0) && pendingPhotos.length === 0 ? (
                    <div style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '2px dashed var(--border-light)',
                      color: 'var(--text-muted)'
                    }}>
                      <i className="ri-camera-line" style={{ fontSize: '48px', margin: '0 auto 16px', opacity: 0.5, display: 'block' }}></i>
                      <p style={{ margin: 0 }}>No photos uploaded for this incident yet.</p>
                      {!isViewing && <p style={{ fontSize: '13px', marginTop: '8px' }}>Click the upload button above to add some.</p>}
                    </div>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                      gap: '16px'
                    }}>
                      {/* Existing Photos */}
                      {formData.photos && formData.photos.map((url, idx) => (
                        <div key={`existing-${idx}`} style={{ 
                          position: 'relative', 
                          aspectRatio: '1', 
                          borderRadius: '8px', 
                          overflow: 'hidden',
                          border: '1px solid var(--border-light)'
                        }}>
                          <a href={url} target="_blank" rel="noopener noreferrer">
                            <img 
                              src={url} 
                              alt={`Incident photo ${idx + 1}`} 
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            />
                          </a>
                          {!isViewing && (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); removeExistingPhoto(idx); }}
                              style={{
                                position: 'absolute',
                                top: '6px',
                                right: '6px',
                                background: 'rgba(239, 68, 68, 0.9)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '50%',
                                width: '24px',
                                height: '24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                              }}
                              title="Remove photo"
                            >
                              <i className="ri-close-line" style={{ fontSize: '14px' }}></i>
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Pending Photos */}
                      {pendingPhotos.map((file, idx) => {
                        const objectUrl = URL.createObjectURL(file);
                        return (
                          <div key={`pending-${idx}`} style={{ 
                            position: 'relative', 
                            aspectRatio: '1', 
                            borderRadius: '8px', 
                            overflow: 'hidden',
                            border: '1px solid var(--primary)',
                            opacity: isUploading ? 0.6 : 1
                          }}>
                            <img 
                              src={objectUrl} 
                              alt={`Pending photo ${idx + 1}`} 
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                              onLoad={() => URL.revokeObjectURL(objectUrl)}
                            />
                            {!isViewing && !isUploading && (
                              <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); removePendingPhoto(idx); }}
                                style={{
                                  position: 'absolute',
                                  top: '6px',
                                  right: '6px',
                                  background: 'rgba(239, 68, 68, 0.9)',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '50%',
                                  width: '24px',
                                  height: '24px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }}
                                title="Remove photo"
                              >
                                <i className="ri-close-line" style={{ fontSize: '14px' }}></i>
                              </button>
                            )}
                            {isUploading && (
                              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', color: 'white' }}>
                                <i className="ri-loader-4-line ri-spin" style={{ fontSize: '24px' }}></i>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
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
