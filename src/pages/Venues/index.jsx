import { validateForm } from '../../utils/validation'
import ModuleToolbar from '../../components/ModuleToolbar'
import ListPagination from '../../components/ListPagination'
import ExportModal from '../../components/ExportModal'
import TableGhostRows from '../../components/TableGhostRows'
import useListPagination from '../../hooks/useListPagination'
import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { logAudit } from '../../services/audit'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import { printPDF } from '../../utils/printPDF'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'
import CalendarView from '../../components/CalendarView'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'

const PRIMARY = '#dc2626'

const INITIAL_FORM_STATE = {
  record_id: '',
  facility_name: 'Multi-Purpose Facility',
  date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  purpose: '',
  booked_by: '',
  conducted_by: '',
  contact_number: '',
  description: ''
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

export default function Venues() {
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

  // Chart states
  const [trendPeriod, setTrendPeriod] = useState('month')
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [selectedYear, setSelectedYear] = useState(() => format(new Date(), 'yyyy'))
  const [chartData, setChartData] = useState([])
  const [viewMode, setViewMode] = useState('list')
  const [currentMonth, setCurrentMonth] = useState(new Date())

  const isAdmin = useIsAdmin()
  const { canCreate, canUpdate, canDelete } = usePermissions('venues')
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
        data.forEach(m => { if (t >= m.start && t <= m.end) m.count++ })
      })
    }

    setChartData(data.map(m => ({ label: m.label, Bookings: m.count })))
  }, [records, trendPeriod, selectedMonth, selectedYear])

  // Helper function to check if a venue booking is overdue
  const isRecordOverdue = (record) => {
    if (!record.date) return false
    
    const venueDate = new Date(record.date)
    const today = new Date()
    venueDate.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    
    // Check if date has passed
    const isPastDate = venueDate < today
    if (!isPastDate) return false
    
    // Venues don't have explicit status, but if date is in the past
    // we consider it overdue if it's not marked as completed somehow
    // For venues, we'll consider past dates as potentially overdue bookings
    return true
  }

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

  const handlePrintPDF = () => {
    printPDF({
      title: 'Venues Report',
      subtitle: `${filteredRecords.length} records`,
      columns: [
        { header: 'Venue', key: 'facility_name' },
        { 
          header: 'Inclusive Date', 
          key: 'date', 
          format: (v, record) => {
            if (!v) return '—'
            const startDate = format(new Date(v), 'MMM dd')
            if (record.end_date && record.end_date !== v) {
              return `${startDate} – ${format(new Date(record.end_date), 'MMM dd, yyyy')}`
            }
            return `${startDate}, ${format(new Date(v), 'yyyy')}`
          }
        },
        { header: "Event's Name", key: 'purpose' },
        { header: 'Client/Requestor', key: 'booked_by' },
        { header: 'Conducted By', key: 'conducted_by' },
        { header: 'Contact No.', key: 'contact_number' },
      ],
      records: filteredRecords,
    })
  }

  const loadRecords = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .order('date', { ascending: false })
      
      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Error loading venue records:', err)
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
      record_id: `VEN-${year}-${rand}`,
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
      facility_name: rec.facility_name || 'Multi-Purpose Facility',
      date: rec.date || '',
      end_date: rec.end_date || '',
      start_time: rec.start_time || '',
      end_time: rec.end_time || '',
      purpose: rec.purpose || '',
      booked_by: rec.booked_by || '',
      conducted_by: rec.conducted_by || '',
      contact_number: rec.contact_number || '',
      description: rec.description || ''
    })
    setIsModalOpen(true)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate contact number if provided
    const errors = validateForm({
      'Contact Number': { rule: 'mobile', value: formData.contact_number, required: false }
    })
    
    if (Object.keys(errors).length > 0) {
      Object.values(errors).forEach(msg => toast.error(msg))
      return
    }

    setIsSaving(true)

    try {
      if (isEditing) {
        const { data, error } = await supabase
          .from('venues')
          .update(formData)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setRecords(filteredRecords.map(rec => rec.id === selectedId ? data[0] : rec))
        await logAudit('Updated', 'Venues', formData.record_id || formData.id || selectedId, 'Updated record details')
        toast.success('Booking updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('venues')
          .insert([formData])
          .select()

        if (error) throw error
        setRecords([data[0], ...records])
        toast.success('Booking created successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving venue record:', err)
      toast.error('Error saving booking: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This booking will be permanently removed. This action cannot be undone.', { title: 'Delete Record' })
    if (!ok) return

    try {
      const { error } = await supabase
        .from('venues')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setRecords(records.filter(rec => rec.id !== id))
      await logAudit('Deleted', 'Venues', id, 'Deleted record')
      toast.success('Reservation deleted successfully!')
    } catch (err) {
      console.error('Error deleting venue record:', err)
      toast.error('Failed to delete booking: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading venue bookings...</p>
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
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading Bookings</h3>
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
          <i className="ri-building-line" style={{ marginRight: '12px' }}></i>
          Venue Bookings
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
            Book Venue
          </button>
        </div>
      </div>

      <Card 
        title="Booking Trend" 
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
              <linearGradient id="bookingGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={PRIMARY} stopOpacity={0.25} />
                <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize:12, fontWeight:600 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize:11 }} axisLine={false} tickLine={false} />
            <RechartsTooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="Bookings" stroke={PRIMARY} strokeWidth={2.5} fill="url(#bookingGrad)" dot={{ r:4, fill:PRIMARY, strokeWidth:0 }} activeDot={{ r:6 }} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
      
      {records.length > 0 && viewMode === 'list' && (
        <ModuleToolbar
          onSearch={v => { setSearchTerm(v); setCurrentPage(1) }}
          onFilterChange={v => { setFilter(v); setCurrentPage(1) }}
          onDateRangeChange={r => { setDateRange(r); setCurrentPage(1) }}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          onExportClick={() => setIsExportOpen(true)}
          onPrintClick={handlePrintPDF}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />
      )}

      {viewMode === 'calendar' ? (
        <CalendarView 
          events={filteredRecords.map(r => ({
            id: r.id,
            title: r.facility_name,
            date: r.date,
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
            <i className="ri-building-line"></i>
            <h3>No Venues Booked</h3>
            <p>Click "Book Venue" to add your first reservation.</p>
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
                  <th>Venue</th>
                  <th>Inclusive Date</th>
                  <th>Event's Name</th>
                  <th>Client/Requestor</th>
                  <th>Conducted By</th>
                  <th>Contact No.</th>
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
                    <td style={{ fontWeight: '700' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {overdue && (
                          <i 
                            className="ri-error-warning-fill"
                            style={{ 
                              color: '#dc2626', 
                              fontSize: '16px',
                              animation: 'pulse 2s infinite'
                            }}
                            title="OVERDUE: This booking date has passed!"
                          ></i>
                        )}
                        {record.facility_name || '-'}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                      {record.date ? format(new Date(record.date), 'MMM dd') : '-'}
                      {record.end_date && record.end_date !== record.date ? ` – ${format(new Date(record.end_date), 'MMM dd, yyyy')}` : record.date ? `, ${format(new Date(record.date), 'yyyy')}` : ''}
                    </td>
                    <td>
                      <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px' }}>
                        {record.purpose || '-'}
                      </div>
                    </td>
                    <td>{record.booked_by || '-'}</td>
                    <td>{record.conducted_by || '-'}</td>
                    <td>{record.contact_number || '-'}</td>
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
        </>
      )}

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        records={records}
        filename="venues_report.xlsx"
        sheetName="Venues"
        dateField="date"
        onSuccess={(count) => toast.success(`Exported ${count} records successfully.`)}
        onError={(msg) => toast.error(msg)}
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isViewing ? 'View Details' : (isEditing ? 'Edit Venue Booking' : 'New Venue Booking')}
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
          <div className="form-row">
            
            <div className="form-group">
              <label>Facility Name *</label>
              <select name="facility_name" value={formData.facility_name} onChange={handleInputChange} required>
                <option value="Multi-Purpose Facility">Multi-Purpose Facility</option>
                <option value="Training Room 1">Training Room 1</option>
                <option value="Training Room 2">Training Room 2</option>
                <option value="DRRM Academy">DRRM Academy</option>
                <option value="ACCOMMODATION ROOM - ROOM NUMBER 1">ACCOMMODATION ROOM - ROOM NUMBER 1</option>
                <option value="ACCOMMODATION ROOM - ROOM NUMBER 2">ACCOMMODATION ROOM - ROOM NUMBER 2</option>
                <option value="ACCOMMODATION ROOM - ROOM NUMBER 3">ACCOMMODATION ROOM - ROOM NUMBER 3</option>
                <option value="ACCOMMODATION ROOM - ROOM NUMBER 4">ACCOMMODATION ROOM - ROOM NUMBER 4</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Date *</label>
              <input type="date" name="date" value={formData.date} onChange={handleInputChange} required />
            </div>
            <div className="form-group">
              <label>End Date (Inclusive)</label>
              <input type="date" name="end_date" value={formData.end_date} onChange={handleInputChange} min={formData.date} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Client / Requestor *</label>
              <input type="text" name="booked_by" value={formData.booked_by} onChange={handleInputChange} required placeholder="e.g. CDRRMO-Operations" />
            </div>
            <div className="form-group">
              <label>Conducted By</label>
              <input type="text" name="conducted_by" value={formData.conducted_by} onChange={handleInputChange} placeholder="e.g. CDRRMO Training Division" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Time *</label>
              <input 
                type="time" 
                name="start_time" 
                value={formData.start_time} 
                onChange={handleInputChange} 
                required 
              />
            </div>
            <div className="form-group">
              <label>End Time *</label>
              <input 
                type="time" 
                name="end_time" 
                value={formData.end_time} 
                onChange={handleInputChange} 
                required 
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Contact Number</label>
              <input type="text" name="contact_number" value={formData.contact_number} onChange={handleInputChange} placeholder="e.g. 09123456789" />
            </div>
            <div className="form-group">
              <label>Purpose *</label>
              <textarea name="purpose" value={formData.purpose} onChange={handleInputChange} required rows={2} placeholder="State the purpose of this booking..." />
            </div>
          </div>

          <div className="form-group">
            <label>Description / Additional Details</label>
            <textarea name="description" value={formData.description} onChange={handleInputChange} rows={3} placeholder="Additional notes, setup requirements, etc." />
          </div>

          </fieldset>

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
                <button type="submit" className="btn-submit" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save'}
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
