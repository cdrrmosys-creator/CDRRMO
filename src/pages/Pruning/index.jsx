import ModuleToolbar from '../../components/ModuleToolbar'
import StatusSelect from '../../components/StatusSelect'
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
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import { uploadFile, deleteFiles } from '../../services/storage'
import { compressImage } from '../../utils/imageCompression'
import { printPDF } from '../../utils/printPDF'

const PRIMARY = '#16a34a' // Green color for pruning

const INITIAL_FORM_STATE = {
  record_id: '',
  location: '',
  date: '',
  date_of_request: '',
  status: 'Pending',
  trees_pruned: '',
  conducted_by: '',
  remarks: '',
  photos: [],
  created_by: '',
  updated_by: '',
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

export default function Pruning() {
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

  // Photo states
  const [isUploading, setIsUploading] = useState(false)
  const [pendingPhotos, setPendingPhotos] = useState([])

  // Chart states
  const [trendPeriod, setTrendPeriod] = useState('month')
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [selectedYear, setSelectedYear] = useState(() => format(new Date(), 'yyyy'))
  const [chartData, setChartData] = useState([])

  const isAdmin = useIsAdmin()
  const { canCreate, canUpdate, canDelete } = usePermissions('pruning')
  const toast = useToast()
  const confirm = useConfirm()

  // Toolbar states
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [isExportOpen, setIsExportOpen] = useState(false)

  useEffect(() => {
    loadRecords()
  }, [])

  // Auto-open modal if view parameter is present (from Calendar Events navigation)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const viewId = params.get('view')
    if (viewId && records.length > 0) {
      const record = records.find(r => r.id === viewId)
      if (record) {
        handleViewDetails(record)
        // Clear the query parameter
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [records])

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
      records.forEach(rec => {
        if (!rec.date) return;
        const t = new Date(rec.date).getTime();
        data.forEach(m => { 
          if (t >= m.start && t <= m.end) {
            m.count += (parseInt(rec.trees_pruned) || 0)
          } 
        })
      })
    }

    setChartData(data.map(m => ({ label: m.label, 'Trees Pruned': m.count })))
  }, [records, trendPeriod, selectedMonth, selectedYear])

  // Helper function to check if a pruning request is overdue
  const isRecordOverdue = (record) => {
    if (!record.date) return false
    
    const pruningDate = new Date(record.date)
    const today = new Date()
    pruningDate.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    
    // Check if date has passed
    const isPastDate = pruningDate < today
    if (!isPastDate) return false
    
    // Get current status (default to "Pending" if not set)
    const currentStatus = (record.status || 'Pending').toLowerCase()
    
    // Check if status is Pending or Scheduled
    return currentStatus === 'pending' || currentStatus === 'scheduled'
  }

  const filteredRecords = records.filter(item => {
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
  }).sort((a, b) => {
    // Sort overdue items to the top
    const aOverdue = isRecordOverdue(a)
    const bOverdue = isRecordOverdue(b)
    
    if (aOverdue && !bOverdue) return -1 // a comes first
    if (!aOverdue && bOverdue) return 1  // b comes first
    
    // If both are overdue or both are not, maintain original order (by date descending)
    if (a.date && b.date) {
      return new Date(b.date) - new Date(a.date)
    }
    return 0
  })

  const { currentPage, setCurrentPage, pageSize, setPageSize, totalPages, safePage, pagedRecords } = useListPagination(filteredRecords)
  const hasActiveFilters = !!(searchTerm || filter || dateRange.start || dateRange.end)

  const handleClearFilters = () => {
    setSearchTerm('')
    setFilter('')
    setDateRange({ start: '', end: '' })
    setCurrentPage(1)
  }

  const handlePrintPDF = (overrideRecords) => {
    printPDF({
      title: 'Pruning & Trimming Report',
      subtitle: `${filteredRecords.length} records`,
      columns: [
        { header: 'Date of Request', key: 'date_of_request', format: v => v ? format(new Date(v), 'MMM dd, yyyy') : '—' },
        { header: 'Location', key: 'location' },
        { header: 'Status', key: 'status' },
        { header: 'Trees Pruned', key: 'trees_pruned', format: v => v || '0' },
        { header: 'Conducted By', key: 'conducted_by' },
        { header: 'Remarks', key: 'remarks' },
      ],
      records: overrideRecords ?? filteredRecords,
    })
  }

  const loadRecords = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('pruning_trimming')
        .select('*')
        .order('date', { ascending: false })
      
      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Error loading pruning records:', err)
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
    setPendingPhotos([])
    const year = new Date().getFullYear()
    const rand = Math.floor(1000 + Math.random() * 9000)
    const todayStr = new Date().toISOString().split('T')[0]

    setFormData({
      ...INITIAL_FORM_STATE,
      record_id: `PRU-${year}-${rand}`,
      date: todayStr
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (rec) => {
    setIsEditing(true)
    setIsViewing(false)
    setSelectedId(rec.id)
    setPendingPhotos([])
    setFormData({
      record_id: rec.record_id || '',
      location: rec.location || '',
      date: rec.date || '',
      date_of_request: rec.date_of_request || '',
      status: rec.status || 'Pending',
      trees_pruned: rec.trees_pruned || '',
      conducted_by: rec.conducted_by || '',
      remarks: rec.remarks || '',
      photos: rec.photos || [],
      created_by: rec.created_by || '',
      updated_by: rec.updated_by || '',
    })
    setIsModalOpen(true)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleStatusChange = async (id, newStatus) => {
    const { data, error } = await supabase
      .from('pruning_trimming')
      .update({ status: newStatus })
      .eq('id', id)
      .select()
    
    if (!error) {
      // Update local state with returned data that includes updated_by and updated_at from trigger
      if (data && data[0]) {
        setRecords(records.map(r => r.id === id ? data[0] : r))
      } else {
        setRecords(records.map(r => r.id === id ? { ...r, status: newStatus } : r))
      }
    } else {
      toast.error('Failed to update status: ' + error.message)
    }
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
            const path = `pruning-photos/${Date.now()}-${compressedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            const url = await uploadFile('pruning-photos', path, compressedFile)
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
        trees_pruned: formData.trees_pruned ? parseInt(formData.trees_pruned) : null,
        photos: [...(formData.photos || []), ...newPhotoUrls]
      }

      if (isEditing) {
        const { data, error } = await supabase
          .from('pruning_trimming')
          .update(payload)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setRecords(filteredRecords.map(rec => rec.id === selectedId ? data[0] : rec))
        await logAudit('Updated', 'Pruning', formData.record_id || formData.id || selectedId, 'Updated record details')
        toast.success('Pruning record updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('pruning_trimming')
          .insert([payload])
          .select()

        if (error) throw error
        setRecords([data[0], ...records])
        await logAudit('Added', 'Pruning', formData.record_id || data[0].record_id || data[0].id, 'Created new record')
        toast.success('Pruning record added successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving pruning record:', err)
      toast.error('Error saving record: ' + err.message)
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
            const idx = url.indexOf('pruning-photos/')
            return idx !== -1 ? url.substring(idx) : null
          })
          .filter(Boolean)
        
        if (pathsToDelete.length > 0) {
          await deleteFiles('pruning-photos', pathsToDelete)
        }
      }

      const { error } = await supabase
        .from('pruning_trimming')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setRecords(records.filter(rec => rec.id !== id))
      await logAudit('Deleted', 'Pruning', id, 'Deleted record')
      toast.success('Pruning record deleted successfully!')
    } catch (err) {
      console.error('Error deleting pruning record:', err)
      toast.error('Failed to delete record: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading pruning records...</p>
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
    <>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    <div>
      <div className="page-header">
        <h2>
          <i className="ri-scissors-line" style={{ marginRight: '12px' }}></i>
          Pruning & Trimming
        </h2>
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: (isAdmin || canCreate) ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Log Pruning/Trimming
        </button>
      </div>

      <Card 
        title="Pruning Trend (Trees Pruned)" 
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
                  background: trendPeriod === period ? PRIMARY : 'var(--bg-app)',
                  color: trendPeriod === period ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${trendPeriod === period ? PRIMARY : 'var(--border-light)'}`,
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
              <linearGradient id="pruningGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={PRIMARY} stopOpacity={0.25} />
                <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize:12, fontWeight:600 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize:11 }} axisLine={false} tickLine={false} />
            <RechartsTooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="Trees Pruned" stroke={PRIMARY} strokeWidth={2.5} fill="url(#pruningGrad)" dot={{ r:4, fill:PRIMARY, strokeWidth:0 }} activeDot={{ r:6 }} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
      
      

      {records.length > 0 && (
        <ModuleToolbar
          onSearch={v => { setSearchTerm(v); setCurrentPage(1) }}
          onFilterChange={v => { setFilter(v); setCurrentPage(1) }}
          filterLabel="All Status"
          filterOptions={[
            { label: 'Pending',     value: 'Pending' },
            { label: 'In Progress', value: 'In Progress' },
            { label: 'Completed',   value: 'Completed' },
          ]}
          filterColorMap={{
            'Pending':     { bg: '#fef3c7', color: '#92400e', icon: 'ri-time-line' },
            'In Progress': { bg: '#dbeafe', color: '#1e40af', icon: 'ri-run-line' },
            'Completed':   { bg: '#d1fae5', color: '#065f46', icon: 'ri-checkbox-circle-line' },
          }}
          onDateRangeChange={r => { setDateRange(r); setCurrentPage(1) }}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          onExportClick={() => setIsExportOpen(true)}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      )}

      {records.length === 0 ? (
        <div className="empty-state">
          <i className="ri-scissors-line"></i>
          <h3>No Pruning Records</h3>
          <p>Click "Log Pruning/Trimming" to create your first tree maintenance log.</p>
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
                <th>Date of Request</th>
                <th>Place</th>
                <th>Status</th>
                <th>Trees Pruned</th>
                <th>Conducted By</th>
                <th>Photos</th>
              </tr>
            </thead>
            <tbody>
              {pagedRecords.map((record) => {
                const overdue = isRecordOverdue(record)
                
                // Determine row styling based on overdue status
                let rowStyle = { cursor: 'pointer', height: '49px' }
                if (overdue) {
                  rowStyle = {
                    ...rowStyle,
                    background: '#fef2f2',
                    borderLeft: '4px solid #dc2626'
                  }
                }
                
                return (
                  <tr 
                    key={record.id}
                    onClick={() => handleViewDetails(record)}
                    style={rowStyle}
                    className="table-row-clickable"
                  >
                    <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {overdue && (
                            <i 
                              className="ri-error-warning-fill"
                              style={{ 
                                color: '#dc2626', 
                                fontSize: '16px',
                                animation: 'pulse 2s infinite'
                              }}
                              title="OVERDUE: This pruning request is past due and still pending!"
                            ></i>
                          )}
                          {record.date_of_request 
                            ? format(new Date(record.date_of_request), 'MMM dd, yyyy')
                            : record.date ? format(new Date(record.date), 'MMM dd, yyyy') : '-'}
                        </div>
                        {record.created_by && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit' }}>
                            <i className="ri-user-line" style={{ fontSize: '12px' }}></i>
                            {record.created_by.split('@')[0]}
                            {record.updated_by && record.updated_at && record.created_at && record.updated_at !== record.created_at && (
                              <span style={{ marginLeft: '6px', color: 'var(--text-muted)' }}>
                                • updated by: {record.updated_by.split('@')[0]}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </td>
                    <td><span style={{ fontWeight: '700' }}>{record.location || '-'}</span></td>
                    <td onClick={e => e.stopPropagation()}>
                      {(() => {
                        const currentStatus = record.status || 'Pending'
                        const statusOptions = [
                          { value: 'Pending',     label: 'Pending',     icon: 'ri-time-line',            bg: '#fef3c7', color: '#92400e' },
                          { value: 'In Progress', label: 'In Progress', icon: 'ri-run-line',             bg: '#dbeafe', color: '#1e40af' },
                          { value: 'Completed',   label: 'Completed',   icon: 'ri-checkbox-circle-line', bg: '#d1fae5', color: '#065f46' },
                        ]
                        
                        // Add overdue styling to the selected option if overdue
                        const optionsWithOverdue = overdue ? statusOptions.map(opt => 
                          opt.value === currentStatus 
                            ? { ...opt, label: `${opt.label} (OVERDUE)`, bg: '#fef2f2', color: '#dc2626' }
                            : opt
                        ) : statusOptions
                        
                        return (
                          <StatusSelect
                            value={currentStatus}
                            disabled={!(isAdmin || canUpdate)}
                            options={optionsWithOverdue}
                            onChange={newStatus => handleStatusChange(record.id, newStatus)}
                          />
                        )
                      })()}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '15px' }}>{record.trees_pruned || 0}</td>
                    <td>{record.conducted_by || '-'}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {record.photos && record.photos.length > 0 ? (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '120px' }}>
                          {record.photos.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                              <i className="ri-image-line" title="View Photo" style={{ fontSize: '16px' }}></i>
                            </a>
                          ))}
                        </div>
                      ) : '-'}
                    </td>
                  </tr>
              )})}
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
        records={records}
        filename="pruning_report.xlsx"
        sheetName="Pruning"
        dateField="date"
        columns={['record_id', 'location', 'date_of_request', 'date', 'status', 'trees_pruned', 'conducted_by', 'remarks', 'photos']}
        headers={{
          record_id: 'Record ID',
          location: 'Location',
          date_of_request: 'Date of Request',
          date: 'Operation Date',
          status: 'Status',
          trees_pruned: 'Trees Pruned',
          conducted_by: 'Conducted By',
          remarks: 'Remarks',
          photos: 'Photo URLs'
        }}
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
        onPrintPdf={handlePrintPDF}
        onError={(msg) => toast.error(msg)}
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isViewing ? 'View Details' : (isEditing ? 'Edit Pruning/Trimming Record' : 'Log Pruning/Trimming')}
        maxWidth="1000px"
      >
        <style>{`
          .pruning-form-layout {
            display: flex;
            flex-wrap: wrap;
            gap: 32px;
          }
          .pruning-details-col {
            flex: 1 1 450px;
            min-width: 0;
          }
          .pruning-photos-col {
            flex: 1 1 350px;
            min-width: 0;
            border-left: 2px solid var(--border-light);
            padding-left: 32px;
          }
          @media (max-width: 1050px) {
            .pruning-form-layout {
              flex-direction: column;
              gap: 24px;
            }
            .pruning-photos-col {
              border-left: none;
              padding-left: 0;
              border-top: 2px solid var(--border-light);
              padding-top: 24px;
            }
          }
        `}</style>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="pruning-form-layout">
            <div className="pruning-details-col">
              <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-row">
                    
                    <div className="form-group">
                      <label>Location *</label>
                      <input 
                        type="text" 
                        name="location" 
                        value={formData.location} 
                        onChange={handleInputChange} 
                        required 
                        placeholder="e.g. Brgy. Marcos highway, Palayan City"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Date of Request *</label>
                      <input 
                        max={new Date().toISOString().split('T')[0]} type="date" 
                        name="date_of_request" 
                        value={formData.date_of_request} 
                        onChange={handleInputChange} 
                        required 
                      />
                    </div>
                    <div className="form-group">
                      <label>Operation Date</label>
                      <input 
                        type="date" 
                        name="date" 
                        value={formData.date} 
                        onChange={handleInputChange}
                        min={formData.date_of_request || undefined}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Status *</label>
                      <select name="status" value={formData.status} onChange={handleInputChange} required>
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Trees Pruned / Trimmed</label>
                      <input 
                        type="number" 
                        name="trees_pruned" 
                        value={formData.trees_pruned} 
                        onChange={handleInputChange} 
                        placeholder="0"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Conducted By</label>
                    <input 
                      type="text" 
                      name="conducted_by" 
                      value={formData.conducted_by} 
                      onChange={handleInputChange} 
                      placeholder="e.g. CDRRMO Rescue Team A & ENRO"
                    />
                  </div>

                  <div className="form-group">
                    <label>Remarks</label>
                    <textarea 
                      name="remarks" 
                      value={formData.remarks} 
                      onChange={handleInputChange} 
                      rows={3} 
                      placeholder="e.g. Cleared branches obstructing power lines..."
                    />
                  </div>
                </div>
              </fieldset>
            </div>

            <div className="pruning-photos-col">
              <PhotoUploadPanel
                title="Pruning Photos"
                emptyMessage="No photos uploaded for this pruning activity yet."
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
                <button type="submit" className="btn-submit" disabled={isSaving || isUploading}>
                  {isSaving || isUploading ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </div>
    </>
  )
}
