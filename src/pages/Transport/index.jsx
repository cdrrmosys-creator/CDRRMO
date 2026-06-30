import ModuleToolbar from '../../components/ModuleToolbar'
import ListPagination from '../../components/ListPagination'
import ExportModal from '../../components/ExportModal'
import TableGhostRows from '../../components/TableGhostRows'
import useListPagination from '../../hooks/useListPagination'
import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { logAudit } from '../../services/audit'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import Modal from '../../components/Modal'
import PhotoUploadPanel from '../../components/PhotoUploadPanel'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'
import CalendarView from '../../components/CalendarView'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import { uploadFile, deleteFiles } from '../../services/storage'
import { compressImage } from '../../utils/imageCompression'

const PRIMARY = '#dc2626'

const INITIAL_FORM_STATE = {
  record_id: '',
  vehicle: '',
  driver: '',
  team: '',
  responder: '',
  destination: '',
  date_time: '',
  purpose: '',
  contact_person: '',
  remarks: '',
  is_rescheduled: false,
  reschedule_date: '',
  patient_name: '',
  patient_age: '',
  patient_address: '',
  patient_contact: '',
  person_notified: '',
  emergency_contact: '',
  injury_illness: '',
  action_given: '',
  others_specify: '',
  description: '',
  photos: [],
  status: 'Scheduled'
}

// Custom tooltip for chart
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background:'var(--bg-surface)', border:'1px solid var(--border-light)',
      borderRadius:'10px', padding:'10px 14px', boxShadow:'0 4px 20px rgba(0,0,0,0.12)',
      fontSize:'13px'
    }}>
      {label && <div style={{ fontWeight:'700', marginBottom:'6px', color:'var(--text)' }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:'6px', color: p.color }}>
          <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:p.color, display:'inline-block' }} />
          <span style={{ color:'var(--text-muted)' }}>{p.name}:</span>
          <span style={{ fontWeight:'700', color:'var(--text)' }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

function Card({ title, icon, children, style = {}, rightElement }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius-lg)',
      padding: '24px',
      boxShadow: 'var(--shadow-sm)',
      ...style
    }}>
      {(title || rightElement) && (
        <div style={{ display:'flex', alignItems:'center', justifyContent: 'space-between', marginBottom:'20px' }}>
          {title && (
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              {icon && <i className={icon} style={{ fontSize:'18px', color:'var(--primary)' }} />}
              <span style={{ fontSize:'14px', fontWeight:'800', letterSpacing:'-0.2px' }}>{title}</span>
            </div>
          )}
          {rightElement && <div>{rightElement}</div>}
        </div>
      )}
      {children}
    </div>
  )
}


export default function Transport() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Lookups for drivers and vehicles
  const [availableVehicles, setAvailableVehicles] = useState([])
  const [availableDrivers, setAvailableDrivers] = useState([])

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isViewing, setIsViewing] = useState(false)
  const [formData, setFormData] = useState(INITIAL_FORM_STATE)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  
  // Photo states
  const [isUploading, setIsUploading] = useState(false)
  const [pendingPhotos, setPendingPhotos] = useState([])

  // Chart states
  const [trendPeriod, setTrendPeriod] = useState('month')
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [selectedYear, setSelectedYear] = useState('2024')
  const [chartData, setChartData] = useState([])
  const [viewMode, setViewMode] = useState('list')
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const isAdmin = useIsAdmin()
  const { canCreate, canUpdate, canDelete } = usePermissions('transport')
  const toast = useToast()
  const confirm = useConfirm()

  // Toolbar states
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [isExportOpen, setIsExportOpen] = useState(false)

  useEffect(() => {
    loadRecords()
    loadLookups()
  }, [])

  useEffect(() => {
    if (!records) return;

    let start, end;
    if (trendPeriod === 'day') {
      const [y, m] = selectedMonth.split('-');
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 0); 
    } else if (trendPeriod === 'week') {
      const [y, m] = selectedMonth.split('-');
      start = new Date(y, m - 1, 1);
      end = new Date(y, m - 1 + 3, 0); 
    } else if (trendPeriod === 'month') {
      start = new Date(selectedYear, 0, 1);
      end = new Date(selectedYear, 11, 31);
    }

    start.setHours(0,0,0,0);
    end.setHours(23,59,59,999);

    if (start > end) return;

    const data = [];
    
    if (trendPeriod === 'day') {
      let curr = new Date(start);
      while (curr <= end) {
        const e = new Date(curr); e.setHours(23,59,59,999);
        data.push({ label: format(curr, 'MMM dd'), start: curr.getTime(), end: e.getTime(), count: 0 });
        curr.setDate(curr.getDate() + 1);
      }
    } else if (trendPeriod === 'week') {
      let curr = startOfWeek(start, { weekStartsOn: 1 });
      while (curr <= end) {
        const e = endOfWeek(curr, { weekStartsOn: 1 });
        data.push({ label: format(curr, 'MMM dd'), start: curr.getTime(), end: e.getTime(), count: 0 });
        curr.setDate(curr.getDate() + 7);
      }
    } else if (trendPeriod === 'month') {
      let curr = startOfMonth(start);
      while (curr <= end) {
        const e = endOfMonth(curr);
        data.push({ label: format(curr, 'MMM'), start: curr.getTime(), end: e.getTime(), count: 0 });
        curr.setMonth(curr.getMonth() + 1);
      }
    }

    if (records.length > 0) {
      records.forEach(inc => {
        if (!inc.date_time) return;
        const t = new Date(inc.date_time).getTime();
        data.forEach(m => { if (t >= m.start && t <= m.end) m.count++ })
      })
    }

    setChartData(data.map(m => ({ label: m.label, Dispatches: m.count })))
  }, [records, trendPeriod, selectedMonth, selectedYear])


  const filteredRecords = records.filter(item => {
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
      const dateStr = item.date_time || item.created_at || item.date || item.start_date || item.date_received || item.date_conducted || item.date_attended
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

  const loadRecords = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('transport')
        .select('*')
        .order('date_time', { ascending: false })
      
      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Error loading transport records:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const loadLookups = async () => {
    try {
      const { data: vData } = await supabase.from('vehicles').select('plate, model')
      const { data: dData } = await supabase.from('drivers').select('name')
      setAvailableVehicles(vData || [])
      setAvailableDrivers(dData || [])
    } catch (err) {
      console.error('Error loading lookups:', err)
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
    setPendingPhotos([])
    const year = new Date().getFullYear()
    const rand = Math.floor(1000 + Math.random() * 9000)
    
    const now = new Date()
    const tzOffset = now.getTimezoneOffset() * 60000
    const localISOTime = (new Date(now - tzOffset)).toISOString().slice(0, 16)

    setFormData({
      ...INITIAL_FORM_STATE,
      record_id: `TRP-${year}-${rand}`,
      date_time: localISOTime
    })
    setIsModalOpen(true)
  }

  const handleStatusChange = async (id, newStatus) => {
    try {
      const { error } = await supabase.from('transport').update({ status: newStatus }).eq('id', id)
      if (error) throw error
      setRecords(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r))
      toast.success('Status updated successfully')
    } catch (err) {
      console.error(err)
      toast.error('Failed to update status. Please ensure the SQL migration to add the status column has been run.')
    }
  }

  const handleOpenEdit = (rec) => {
    setIsEditing(true)
    setIsViewing(false)
    setSelectedId(rec.id)
    setPendingPhotos([])
    
    let formattedDateTime = ''
    if (rec.date_time) {
      const d = new Date(rec.date_time)
      const tzOffset = d.getTimezoneOffset() * 60000
      formattedDateTime = (new Date(d - tzOffset)).toISOString().slice(0, 16)
    }

    let formattedRescheduleDate = ''
    if (rec.reschedule_date) {
      const d = new Date(rec.reschedule_date)
      const tzOffset = d.getTimezoneOffset() * 60000
      formattedRescheduleDate = (new Date(d - tzOffset)).toISOString().slice(0, 16)
    }

    setFormData({
      record_id: rec.record_id || '',
      vehicle: rec.vehicle || '',
      driver: rec.driver || '',
      team: rec.team || '',
      responder: rec.responder || '',
      destination: rec.destination || '',
      date_time: formattedDateTime,
      purpose: rec.purpose || '',
      contact_person: rec.contact_person || '',
      remarks: rec.remarks || '',
      is_rescheduled: rec.is_rescheduled || false,
      reschedule_date: formattedRescheduleDate,
      patient_name: rec.patient_name || '',
      patient_age: rec.patient_age || '',
      patient_address: rec.patient_address || '',
      patient_contact: rec.patient_contact || '',
      person_notified: rec.person_notified || '',
      emergency_contact: rec.emergency_contact || '',
      injury_illness: rec.injury_illness || '',
      action_given: rec.action_given || '',
      others_specify: rec.others_specify || '',
      description: rec.description || '',
      status: rec.status || 'Scheduled',
      photos: rec.photos || []
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
      
      if (pendingPhotos.length > 0) {
        setIsUploading(true)
        try {
          for (const file of pendingPhotos) {
            const compressedFile = await compressImage(file, 800, 0.6)
            const path = `transport-photos/${Date.now()}-${compressedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            const url = await uploadFile('transport-photos', path, compressedFile)
            newPhotoUrls.push(url)
          }
        } catch (error) {
          console.error('Upload error:', error)
          toast.error('Failed to upload some photos. Did you run the Supabase storage script?')
          throw error 
        } finally {
          setIsUploading(false)
        }
      }

      const payload = {
        ...formData,
        date_time: new Date(formData.date_time).toISOString(),
        reschedule_date: formData.is_rescheduled && formData.reschedule_date ? new Date(formData.reschedule_date).toISOString() : null,
        photos: [...(formData.photos || []), ...newPhotoUrls]
      }

      if (isEditing) {
        const { data, error } = await supabase
          .from('transport')
          .update(payload)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setRecords(filteredRecords.map(rec => rec.id === selectedId ? data[0] : rec))
        await logAudit('Updated', 'Transport', formData.record_id || formData.id || selectedId, 'Updated record details')
        toast.success('Transport dispatch updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('transport')
          .insert([payload])
          .select()

        if (error) throw error
        setRecords([data[0], ...records])
        toast.success('Transport dispatch created successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving transport record:', err)
      toast.error('Error saving transport record: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This record will be permanently removed. This action cannot be undone.', { title: 'Delete Record' })
    if (!ok) return

    try {
      const recordToDelete = records.find(item => item.id === id)
      if (recordToDelete && recordToDelete.photos && recordToDelete.photos.length > 0) {
        const pathsToDelete = recordToDelete.photos
          .map(url => {
            const idx = url.indexOf('transport-photos/')
            return idx !== -1 ? url.substring(idx) : null
          })
          .filter(Boolean)
        
        if (pathsToDelete.length > 0) {
          await deleteFiles('transport-photos', pathsToDelete)
        }
      }

      const { error } = await supabase
        .from('transport')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setRecords(records.filter(rec => rec.id !== id))
      await logAudit('Deleted', 'Transport', id, 'Deleted record')
      toast.success('Transport record deleted successfully!')
    } catch (err) {
      console.error('Error deleting transport record:', err)
      toast.error('Failed to delete record: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading transport records...</p>
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
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading Records</h3>
          <p>{error}</p>
          <button 
            onClick={loadRecords}
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
          <i className="ri-taxi-line" style={{ marginRight: '12px' }}></i>
          Transport Dispatch
        </h2>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '4px' }}>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                background: viewMode === 'list' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'list' ? '#fff' : 'var(--text-muted)'
              }}
            >
              <i className="ri-list-check" style={{ marginRight: '6px' }}></i> List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              style={{
                padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                background: viewMode === 'calendar' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'calendar' ? '#fff' : 'var(--text-muted)'
              }}
            >
              <i className="ri-calendar-line" style={{ marginRight: '6px' }}></i> Calendar
            </button>
          </div>
          <button className="btn-add" onClick={handleOpenAdd} style={{ display: (isAdmin || canCreate) ? '' : 'none' }}>
            <i className="ri-add-line"></i>
            Add Dispatch
          </button>
        </div>
      </div>

      <Card 
        title="Dispatch Trend" 
        icon="ri-line-chart-line" 
        style={{ marginBottom:'20px' }}
        rightElement={
          <div style={{ display:'flex', alignItems:'center', gap:'16px', flexWrap:'wrap', justifyContent:'flex-end' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', fontSize: '12px', fontWeight: '600' }}>
              {trendPeriod === 'day' && (
                <>
                  <span style={{ color:'var(--text-muted)' }}>Month:</span>
                  <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} 
                    style={{ background:'var(--bg-app)', border:'1px solid var(--border-light)', borderRadius:'6px', padding:'2px 6px', color:'var(--text)', fontSize:'12px', fontFamily:'inherit' }} />
                </>
              )}
              {trendPeriod === 'week' && (
                <>
                  <span style={{ color:'var(--text-muted)' }}>Start Month:</span>
                  <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} 
                    style={{ background:'var(--bg-app)', border:'1px solid var(--border-light)', borderRadius:'6px', padding:'2px 6px', color:'var(--text)', fontSize:'12px', fontFamily:'inherit' }} />
                  <span style={{ color:'var(--text-muted)', marginLeft:'4px', fontWeight:'500' }}>(Shows 3 Months)</span>
                </>
              )}
              {trendPeriod === 'month' && (
                <>
                  <span style={{ color:'var(--text-muted)' }}>Year:</span>
                  <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} 
                    style={{ background:'var(--bg-app)', border:'1px solid var(--border-light)', borderRadius:'6px', padding:'2px 6px', color:'var(--text)', fontSize:'12px', fontFamily:'inherit', cursor:'pointer' }}>
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                  </select>
                </>
              )}
            </div>
            <div style={{ width:'1px', height:'24px', background:'var(--border-light)', display: 'block' }} />
            <div style={{ display:'flex', gap:'8px' }}>
              {['day', 'week', 'month'].map(period => (
                <button key={period} onClick={() => setTrendPeriod(period)} style={{
                  padding: '4px 12px', fontSize: '12px', fontWeight: '700', borderRadius: '6px',
                  background: trendPeriod === period ? 'var(--primary)' : 'var(--bg-app)',
                  color: trendPeriod === period ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${trendPeriod === period ? 'var(--primary)' : 'var(--border-light)'}`,
                  cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.2s'
                }}>
                  {period === 'day' ? 'Daily' : period === 'week' ? 'Weekly' : 'Monthly'}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top:8, right:16, left:-20, bottom:0 }}>
            <defs>
              <linearGradient id="dispatchGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={PRIMARY} stopOpacity={0.25} />
                <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize:12, fontWeight:600 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize:11 }} axisLine={false} tickLine={false} />
            <RechartsTooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="Dispatches" stroke={PRIMARY} strokeWidth={2.5} fill="url(#dispatchGrad)" dot={{ r:4, fill:PRIMARY, strokeWidth:0 }} activeDot={{ r:6 }} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      
      {records.length > 0 && (
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

      {viewMode === 'calendar' ? (
        <CalendarView 
          events={filteredRecords.map(r => ({
            id: r.id,
            title: `Transport: ${r.vehicle || r.destination}`,
            date: r.date_time,
            color: '#dc2626',
            onClick: () => handleViewDetails(r)
          }))}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
        />
      ) : (
        <>
        {records.length === 0 ? (
          <div className="empty-state">
            <i className="ri-taxi-line"></i>
            <h3>No Transport Records</h3>
            <p>Click "Add Dispatch" to create your first transport record.</p>
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
                <th>Date & Time</th>
                <th>Vehicle</th>
                <th>Driver</th>
                <th>Destination</th>
                <th>Patient Name</th>
                <th>Contact Person</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pagedRecords.map((record) => (
                <tr 
                  key={record.id}
                  onClick={() => handleViewDetails(record)}
                  style={{ cursor: 'pointer', height: '49px' }}
                  className="table-row-clickable"
                >
                  <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                    {record.date_time 
                      ? format(new Date(record.date_time), 'MMM dd, yyyy hh:mm a')
                      : '-'}
                  </td>
                  <td style={{ fontWeight: '700' }}>{record.vehicle || '-'}</td>
                  <td>{record.driver || '-'}</td>
                  <td>{record.destination || '-'}</td>
                  <td style={{ fontWeight: '600', color: 'var(--primary)' }}>{record.patient_name || '-'}</td>
                  <td>{record.contact_person || '-'}</td>
                  <td>
                    {(() => {
                      // Fallback computation if record.status is not set in DB yet
                      const targetDate = record.is_rescheduled && record.reschedule_date ? new Date(record.reschedule_date) : new Date(record.date_time);
                      const isCompleted = targetDate < new Date();
                      
                      let currentStatus = record.status;
                      if (!currentStatus) {
                        currentStatus = isCompleted ? 'Completed' : (record.is_rescheduled ? 'Rescheduled' : 'Scheduled');
                      }

                      const getBgColor = (s) => {
                        if (s === 'Completed') return '#d1fae5';
                        if (s === 'Rescheduled') return '#fef3c7';
                        if (s === 'Cancelled') return '#fee2e2';
                        if (s === 'In Progress') return '#e0f2fe';
                        return '#e0e7ff';
                      }
                      
                      const getTextColor = (s) => {
                        if (s === 'Completed') return '#065f46';
                        if (s === 'Rescheduled') return '#92400e';
                        if (s === 'Cancelled') return '#991b1b';
                        if (s === 'In Progress') return '#0369a1';
                        return '#3730a3';
                      }

                      if (canUpdate) {
                        return (
                          <select 
                            value={currentStatus}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleStatusChange(record.id, e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{ 
                              padding: '4px 8px', 
                              borderRadius: '4px', 
                              background: getBgColor(currentStatus), 
                              color: getTextColor(currentStatus), 
                              fontSize: '12px', 
                              fontWeight: '600',
                              border: '1px solid transparent',
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            <option value="Scheduled">Scheduled</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                            <option value="Rescheduled">Rescheduled</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        )
                      }
                      
                      return (
                        <span style={{ padding: '4px 8px', borderRadius: '4px', background: getBgColor(currentStatus), color: getTextColor(currentStatus), fontSize: '12px', fontWeight: '600' }}>
                          {currentStatus}
                        </span>
                      )
                    })()}
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
        </>
      )}

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        records={records}
        filename="transport_report.xlsx"
        sheetName="Transport"
        dateField="date_time"
        onSuccess={(count) => toast.success(`Exported ${count} records successfully.`)}
        onError={(msg) => toast.error(msg)}
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isViewing ? 'View Details' : (isEditing ? 'Edit Dispatch Record' : 'Add Transport Dispatch')}
        maxWidth="1000px"
      >
        <style>{`
          .transport-form-layout {
            display: flex;
            flex-wrap: wrap;
            gap: 32px;
          }
          .transport-details-col {
            flex: 1 1 450px;
            min-width: 0;
          }
          .transport-photos-col {
            flex: 1 1 350px;
            min-width: 0;
            border-left: 2px solid var(--border-light);
            padding-left: 32px;
          }
          @media (max-width: 1050px) {
            .transport-form-layout {
              flex-direction: column;
              gap: 24px;
            }
            .transport-photos-col {
              border-left: none;
              padding-left: 0;
              border-top: 2px solid var(--border-light);
              padding-top: 24px;
            }
          }
        `}</style>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="transport-form-layout">
            <div className="transport-details-col">
              <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-row">
                    
                    <div className="form-group">
                      <label>Date & Time *</label>
                      <input 
                        type="datetime-local" 
                        name="date_time" 
                        value={formData.date_time} 
                        onChange={handleInputChange} 
                        required 
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Vehicle *</label>
                      <select name="vehicle" value={formData.vehicle} onChange={handleInputChange} required>
                        <option value="">-- Select Vehicle --</option>
                        {availableVehicles.map((v, i) => (
                          <option key={i} value={`${v.plate} (${v.model})`}>
                            {v.plate} — {v.model}
                          </option>
                        ))}
                        {availableVehicles.length === 0 && <option value="" disabled>No vehicles registered in DB</option>}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Driver *</label>
                      <select name="driver" value={formData.driver} onChange={handleInputChange} required>
                        <option value="">-- Select Driver --</option>
                        {availableDrivers.map((d, i) => (
                          <option key={i} value={d.name}>
                            {d.name}
                          </option>
                        ))}
                        {availableDrivers.length === 0 && <option value="" disabled>No drivers registered in DB</option>}
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Team Name</label>
                      <input type="text" name="team" value={formData.team} onChange={handleInputChange} placeholder="e.g. Alpha Team" />
                    </div>
                    <div className="form-group">
                      <label>Responder</label>
                      <input type="text" name="responder" value={formData.responder} onChange={handleInputChange} placeholder="e.g. Juan Dela Cruz" />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Destination / Exact Place *</label>
                      <input type="text" name="destination" value={formData.destination} onChange={handleInputChange} required placeholder="e.g. Brgy. Atate, Palayan City" />
                    </div>
                    <div className="form-group">
                      <label>Contact Person</label>
                      <input type="text" name="contact_person" value={formData.contact_person} onChange={handleInputChange} placeholder="e.g. Juan Dela Cruz (09123456789)" />
                    </div>
                  </div>

                  {/* Patient Information Section */}
                  <div style={{ borderTop: '2px solid var(--border-light)', marginTop: '4px', paddingTop: '14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px', color: 'var(--primary)', marginBottom: '10px', textTransform: 'uppercase' }}>
                      <i className="ri-user-heart-line" style={{ marginRight: '6px' }}></i>Patient Information
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Patient Name</label>
                        <input type="text" name="patient_name" value={formData.patient_name} onChange={handleInputChange} placeholder="e.g. Juan Dela Cruz" />
                      </div>
                      <div className="form-group">
                        <label>Patient Age</label>
                        <input type="text" name="patient_age" value={formData.patient_age} onChange={handleInputChange} placeholder="e.g. 35" />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Patient Address</label>
                        <input type="text" name="patient_address" value={formData.patient_address} onChange={handleInputChange} placeholder="e.g. Brgy. Poblacion, Palayan City" />
                      </div>
                      <div className="form-group">
                        <label>Patient Contact No.</label>
                        <input type="text" name="patient_contact" value={formData.patient_contact} onChange={handleInputChange} placeholder="e.g. 09123456789" />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Person Notified</label>
                        <input type="text" name="person_notified" value={formData.person_notified} onChange={handleInputChange} placeholder="e.g. Maria Dela Cruz" />
                      </div>
                      <div className="form-group">
                        <label>Emergency Contact</label>
                        <input type="text" name="emergency_contact" value={formData.emergency_contact} onChange={handleInputChange} placeholder="e.g. 09987654321" />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Injury / Illness / Complaint</label>
                      <input type="text" name="injury_illness" value={formData.injury_illness} onChange={handleInputChange} placeholder="e.g. Chest pain, Vehicular accident" />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Action Given</label>
                        <input type="text" name="action_given" value={formData.action_given} onChange={handleInputChange} placeholder="e.g. CPR administered, Wound dressing" />
                      </div>
                      <div className="form-group">
                        <label>Others (Specify)</label>
                        <input type="text" name="others_specify" value={formData.others_specify} onChange={handleInputChange} placeholder="e.g. Referred to hospital" />
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Purpose</label>
                    <textarea name="purpose" value={formData.purpose} onChange={handleInputChange} rows={2} />
                  </div>
                  
                  <div className="form-group">
                    <label>Description / Additional Details</label>
                    <textarea name="description" value={formData.description} onChange={handleInputChange} rows={3} placeholder="Provide any additional details or descriptions..." />
                  </div>

                  <div className="form-group" style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, cursor: 'pointer', fontWeight: '700' }}>
                      <input type="checkbox" name="is_rescheduled" checked={formData.is_rescheduled} onChange={handleInputChange} style={{ width: '18px', height: '18px' }} />
                      Rescheduled
                    </label>
                    {formData.is_rescheduled && (
                      <div style={{ marginTop: '16px' }}>
                        <label>Reschedule Date & Time *</label>
                        <input type="datetime-local" name="reschedule_date" value={formData.reschedule_date} onChange={handleInputChange} required={formData.is_rescheduled} />
                      </div>
                    )}
                  </div>
                </div>
              </fieldset>
            </div>

            <div className="transport-photos-col">
              <PhotoUploadPanel
                title="Transport Photos"
                emptyMessage="No photos uploaded for this transport record yet."
                photos={formData.photos}
                pendingPhotos={pendingPhotos}
                isViewing={isViewing}
                isUploading={isUploading}
                isSaving={isSaving}
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
