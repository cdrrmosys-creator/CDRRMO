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


  // Toolbar / filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [filterTeam, setFilterTeam] = useState('')
  const [filterNature, setFilterNature] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

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

    const matchesTeam = !filterTeam || item.team === filterTeam
    const matchesNature = !filterNature || (item.nature_of_incident || '').toLowerCase().includes(filterNature.toLowerCase())

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

    return matchesSearch && matchesTeam && matchesNature && matchesDate
  }).sort((a, b) => {
    const da = new Date(a.date || a.created_at || 0)
    const db = new Date(b.date || b.created_at || 0)
    return da - db
  })

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const pagedRecords = filteredRecords.slice((safePage - 1) * pageSize, safePage * pageSize)

  // ── Export modal state ────────────────────────────────────────────────────
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')

  const exportPreviewRows = incidents.filter(item => {
    if (!exportFrom && !exportTo) return true
    const dateStr = item.date || item.created_at
    if (!dateStr) return false
    const d = new Date(dateStr)
    if (exportFrom && d < new Date(exportFrom)) return false
    if (exportTo) {
      const end = new Date(exportTo)
      end.setHours(23, 59, 59, 999)
      if (d > end) return false
    }
    return true
  }).sort((a, b) => new Date(a.date || a.created_at || 0) - new Date(b.date || b.created_at || 0))

  const handleExport = () => {
    if (!window.XLSX) {
      toast.error('Export library not loaded. Check your internet connection.')
      return
    }
    if (exportPreviewRows.length === 0) {
      toast.error('No records match the selected date range.')
      return
    }

    const COLUMNS = [
      'record_id', 'date', 'time_of_call', 'team',
      'place_of_incident', 'exact_place',
      'nature_of_incident', 'severity',
      'name', 'age', 'address', 'injury_illness_complaint',
      'vehicle', 'vehicle_other', 'helmet', 'liquor',
      'time_of_arrival_at_scene', 'time_of_departure_at_scene',
      'time_of_arrival_at_hosp', 'time_of_departure_at_hosp', 'back_to_base',
      'action_given', 'refused_transfer',
      'transfer_from', 'transfer_to', 'transfer_to_other', 'ambulance',
      'remarks'
    ]

    const HEADERS = {
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
      remarks: 'Remarks'
    }

    const rows = exportPreviewRows.map(inc => {
      const row = {}
      COLUMNS.forEach(col => {
        let val = inc[col]
        if (col === 'refused_transfer') val = val ? 'Yes' : 'No'
        if (val === null || val === undefined) val = ''
        row[HEADERS[col]] = val
      })
      return row
    })

    const ws = window.XLSX.utils.json_to_sheet(rows)

    // Auto column widths
    const colWidths = Object.keys(HEADERS).map(k => ({ wch: Math.max(HEADERS[k].length + 2, 14) }))
    ws['!cols'] = colWidths

    const wb = window.XLSX.utils.book_new()
    window.XLSX.utils.book_append_sheet(wb, ws, 'Incidents')

    const fromLabel = exportFrom || 'all'
    const toLabel = exportTo || 'all'
    window.XLSX.writeFile(wb, `incidents_${fromLabel}_to_${toLabel}.xlsx`)

    setIsExportOpen(false)
    toast.success(`Exported ${exportPreviewRows.length} records successfully.`)
  }

  const loadIncidents = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .order('date', { ascending: true })

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


      {/* ── Inline filters bar ── */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '160px' }}>
          <i className="ri-search-line" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '15px', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search records…"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1) }}
            style={{ width: '100%', padding: '8px 10px 8px 32px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontSize: '13px', color: 'var(--text)', boxSizing: 'border-box' }}
          />
        </div>

        {/* Team filter */}
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
        </select>

        {/* Nature filter */}
        <div style={{ position: 'relative', flex: '1 1 160px', minWidth: '140px' }}>
          <input
            type="text"
            placeholder="Filter by nature…"
            value={filterNature}
            onChange={e => { setFilterNature(e.target.value); setCurrentPage(1) }}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontSize: '13px', color: 'var(--text)', boxSizing: 'border-box' }}
          />
        </div>

        {/* Date range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="date"
            value={dateRange.start}
            onChange={e => { setDateRange(p => ({ ...p, start: e.target.value })); setCurrentPage(1) }}
            style={{ padding: '7px 8px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontSize: '13px', color: 'var(--text)' }}
          />
          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>–</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={e => { setDateRange(p => ({ ...p, end: e.target.value })); setCurrentPage(1) }}
            style={{ padding: '7px 8px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontSize: '13px', color: 'var(--text)' }}
          />
        </div>

        {/* Clear all filters */}
        {(searchTerm || filterTeam || filterNature || dateRange.start || dateRange.end) && (
          <button
            onClick={() => { setSearchTerm(''); setFilterTeam(''); setFilterNature(''); setDateRange({ start: '', end: '' }); setCurrentPage(1) }}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <i className="ri-close-line" /> Clear
          </button>
        )}

        {/* Page size selector + Export — right side */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Show</span>
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', fontSize: '13px', color: 'var(--text)', cursor: 'pointer' }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>per page</span>

          <div style={{ width: '1px', height: '20px', background: 'var(--border-light)' }} />

          <button
            onClick={() => { setExportFrom(''); setExportTo(''); setIsExportOpen(true) }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: '8px',
              background: '#16a34a', color: '#fff',
              border: 'none', fontSize: '13px', fontWeight: '700',
              cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            <i className="ri-file-excel-2-line" style={{ fontSize: '15px' }} /> Export XLSX
          </button>
        </div>
      </div>

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
          <table>
            <thead>
              <tr>
                <th>Record ID</th>
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
                  style={{ cursor: 'pointer' }}
                  className="table-row-clickable"
                >
                  <td><code style={{ fontWeight: '700' }}>{incident.record_id || '-'}</code></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{incident.date ? format(new Date(incident.date), 'MMM dd, yyyy') : '-'}</td>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '13px' }}>{incident.time_of_call || '-'}</td>
                  <td>
                    {incident.team ? (
                      <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '700', background: '#eff6ff', color: '#1d4ed8' }}>
                        {incident.team}
                      </span>
                    ) : '-'}
                  </td>
                  <td style={{ fontWeight: '600' }}>{incident.nature_of_incident || '-'}</td>
                  <td>{incident.name || '-'}</td>
                  <td>
                    <div style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {incident.place_of_incident || '-'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination bar ── */}
      {filteredRecords.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Showing <strong>{(safePage - 1) * pageSize + 1}</strong>–<strong>{Math.min(safePage * pageSize, filteredRecords.length)}</strong> of <strong>{filteredRecords.length}</strong> records
          </span>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safePage === 1}
              style={{ padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', cursor: safePage === 1 ? 'not-allowed' : 'pointer', opacity: safePage === 1 ? 0.4 : 1, fontSize: '14px', lineHeight: 1 }}
              title="First page"
            ><i className="ri-skip-back-line" /></button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              style={{ padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', cursor: safePage === 1 ? 'not-allowed' : 'pointer', opacity: safePage === 1 ? 0.4 : 1, fontSize: '14px', lineHeight: 1 }}
            ><i className="ri-arrow-left-s-line" /></button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...')
                acc.push(p)
                return acc
              }, [])
              .map((item, idx) =>
                item === '...' ? (
                  <span key={`ellipsis-${idx}`} style={{ padding: '0 4px', color: 'var(--text-muted)', fontSize: '13px' }}>…</span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setCurrentPage(item)}
                    style={{
                      padding: '6px 11px', borderRadius: '7px', fontSize: '13px', fontWeight: '700',
                      border: `1px solid ${safePage === item ? 'var(--primary)' : 'var(--border-light)'}`,
                      background: safePage === item ? 'var(--primary)' : 'var(--bg-surface)',
                      color: safePage === item ? '#fff' : 'var(--text)',
                      cursor: 'pointer', transition: 'all 0.15s'
                    }}
                  >{item}</button>
                )
              )
            }

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              style={{ padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', cursor: safePage === totalPages ? 'not-allowed' : 'pointer', opacity: safePage === totalPages ? 0.4 : 1, fontSize: '14px', lineHeight: 1 }}
            ><i className="ri-arrow-right-s-line" /></button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safePage === totalPages}
              style={{ padding: '6px 10px', borderRadius: '7px', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', cursor: safePage === totalPages ? 'not-allowed' : 'pointer', opacity: safePage === totalPages ? 0.4 : 1, fontSize: '14px', lineHeight: 1 }}
              title="Last page"
            ><i className="ri-skip-forward-line" /></button>
          </div>
        </div>
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
                        { label: 'Time of Call', value: formData.time_of_call },
                        { label: 'Arrival at Scene', value: formData.time_of_arrival_at_scene },
                        { label: 'Departure at Scene', value: formData.time_of_departure_at_scene },
                        { label: 'Arrival at Hospital', value: formData.time_of_arrival_at_hosp },
                        { label: 'Departure at Hospital', value: formData.time_of_departure_at_hosp },
                        { label: 'Back to Base', value: formData.back_to_base },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px 16px', border: '1px solid var(--border-light)' }}>
                          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{label}</div>
                          <div style={{ fontSize: '16px', fontWeight: '700', color: value ? 'var(--text)' : 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                            {value || <span style={{ fontSize: '13px', fontWeight: '400' }}>— not recorded —</span>}
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
      {/* ── Export Modal ── */}
      {isExportOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setIsExportOpen(false) }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            width: '100%', maxWidth: '460px',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 24px', borderBottom: '1px solid var(--border-light)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ri-file-excel-2-line" style={{ fontSize: '20px', color: '#16a34a' }} />
                </div>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '16px' }}>Export to Excel</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>incidents_report.xlsx</div>
                </div>
              </div>
              <button
                onClick={() => setIsExportOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '20px', lineHeight: 1, padding: '4px' }}
              ><i className="ri-close-line" /></button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px' }}>
              <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                Select a date range to filter which records to export. Leave both fields empty to export all records.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>From</label>
                  <input
                    type="date"
                    value={exportFrom}
                    onChange={e => setExportFrom(e.target.value)}
                    style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-app)', fontSize: '13px', color: 'var(--text)', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>To</label>
                  <input
                    type="date"
                    value={exportTo}
                    min={exportFrom || undefined}
                    onChange={e => setExportTo(e.target.value)}
                    style={{ width: '100%', padding: '9px 10px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-app)', fontSize: '13px', color: 'var(--text)', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Row preview */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px 16px', borderRadius: '10px',
                background: exportPreviewRows.length > 0 ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${exportPreviewRows.length > 0 ? '#bbf7d0' : '#fecaca'}`,
                marginBottom: '24px'
              }}>
                <i
                  className={exportPreviewRows.length > 0 ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'}
                  style={{ fontSize: '22px', color: exportPreviewRows.length > 0 ? '#16a34a' : '#dc2626', flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontWeight: '800', fontSize: '15px', color: exportPreviewRows.length > 0 ? '#15803d' : '#b91c1c' }}>
                    {exportPreviewRows.length} {exportPreviewRows.length === 1 ? 'record' : 'records'} will be exported
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {exportFrom && exportTo
                      ? `${format(new Date(exportFrom), 'MMM dd, yyyy')} – ${format(new Date(exportTo), 'MMM dd, yyyy')}`
                      : exportFrom
                        ? `From ${format(new Date(exportFrom), 'MMM dd, yyyy')} onwards`
                        : exportTo
                          ? `Up to ${format(new Date(exportTo), 'MMM dd, yyyy')}`
                          : 'All dates — no filter applied'}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setIsExportOpen(false)}
                  style={{ padding: '9px 20px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-app)', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  disabled={exportPreviewRows.length === 0}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '7px',
                    padding: '9px 22px', borderRadius: '8px',
                    background: exportPreviewRows.length > 0 ? '#16a34a' : '#9ca3af',
                    color: '#fff', border: 'none',
                    fontSize: '13px', fontWeight: '700',
                    cursor: exportPreviewRows.length > 0 ? 'pointer' : 'not-allowed',
                    transition: 'background 0.15s'
                  }}
                >
                  <i className="ri-download-2-line" /> Download XLSX
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
