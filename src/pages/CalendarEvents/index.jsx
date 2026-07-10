import ModuleToolbar from '../../components/ModuleToolbar'
import ListPagination from '../../components/ListPagination'
import ExportModal from '../../components/ExportModal'
import TableGhostRows from '../../components/TableGhostRows'
import useListPagination from '../../hooks/useListPagination'
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
import CalendarView from '../../components/CalendarView'

const INITIAL_FORM_STATE = {
  record_id: '',
  event_title: '',
  event_type: '',
  event_type_other: '',
  start_date: '',
  end_date: '',
  location: '',
  organizer: '',
  description: '',
  created_by: '',
  updated_by: '',
  created_at: '',
  updated_at: ''
}

const EVENT_TYPES = [
  'Drill / Exercise',
  'Training',
  'Meeting',
  'Community Outreach',
  'Disaster Response',
  'Holiday',
  'Maintenance',
  'Other'
]

const EVENT_SOURCES = {
  all: { label: 'All Events', color: '#6b7280', icon: 'ri-apps-line' },
  calendar_events: { label: 'Calendar Events', color: '#3b82f6', icon: 'ri-calendar-line' },
  transport: { label: 'Transport', color: '#10b981', icon: 'ri-truck-line' },
  venues: { label: 'Venues', color: '#f59e0b', icon: 'ri-building-line' },
  activities: { label: 'Activities', color: '#8b5cf6', icon: 'ri-flag-line' },
  events_assistance: { label: 'Events Assistance', color: '#ec4899', icon: 'ri-service-line' },
  pruning: { label: 'Pruning & Trimming', color: '#14b8a6', icon: 'ri-scissors-cut-line' },
  logistic: { label: 'Logistic (Borrowed)', color: '#84cc16', icon: 'ri-shopping-bag-line' }
}

export default function CalendarEvents() {
  const [viewMode, setViewMode] = useState('list')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [sourceFilter, setSourceFilter] = useState('all') // New: filter by event source
  const [timeFilter, setTimeFilter] = useState('all') // New: filter by time (all, upcoming, past)
  const [records, setRecords] = useState([])
  const [aggregatedEvents, setAggregatedEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isViewing, setIsViewing] = useState(false)
  const [formData, setFormData] = useState(INITIAL_FORM_STATE)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const isAdmin = useIsAdmin()
  const { canCreate, canUpdate, canDelete } = usePermissions('calendar')
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

  // Helper function to determine event urgency status
  const getEventUrgencyStatus = (eventDate) => {
    if (!eventDate) return null
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const event = new Date(eventDate)
    event.setHours(0, 0, 0, 0)
    
    const diffTime = event.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'today' // Event is today (ongoing)
    if (diffDays > 0 && diffDays <= 7) return 'upcoming' // Event within next 7 days
    return null
  }

  // Helper function to get status/type based on event source
  const getEventStatusOrType = (event) => {
    switch (event.source) {
      case 'calendar_events':
        // Show event type
        if (event.data.event_type === 'Other' && event.data.event_type_other) {
          return event.data.event_type_other
        }
        return event.data.event_type || '—'
      
      case 'transport':
        // Show status
        return event.data.status || '—'
      
      case 'venues':
        // Calculate status based on date (start_time and end_time)
        if (event.data.date) {
          const venueDate = new Date(event.data.date)
          const today = new Date()
          venueDate.setHours(0, 0, 0, 0)
          today.setHours(0, 0, 0, 0)
          
          if (venueDate < today) return 'Completed'
          if (venueDate.getTime() === today.getTime()) return 'Ongoing'
          return 'Scheduled'
        }
        return '—'
      
      case 'activities':
        // Show status (should be "Complete" or similar)
        return event.data.status || 'Complete'
      
      case 'events_assistance':
        // Show type
        return event.data.type_of_assistance || '—'
      
      case 'pruning':
        // Show status
        return event.data.status || '—'
      
      case 'logistic':
        // Show status
        return event.data.status || '—'
      
      default:
        return '—'
    }
  }

  // Helper function to check if an event is overdue
  const isEventOverdue = (event) => {
    if (!event.date) return false
    
    const eventDate = new Date(event.date)
    const today = new Date()
    eventDate.setHours(0, 0, 0, 0)
    today.setHours(0, 0, 0, 0)
    
    // Check if date has passed
    const isPastDate = eventDate < today
    if (!isPastDate) return false
    
    // Get the status/type for this event
    const statusOrType = getEventStatusOrType(event)
    
    // Check if status is Pending or Scheduled (case-insensitive)
    const status = statusOrType.toLowerCase()
    return status === 'pending' || status === 'scheduled'
  }

  // Filter aggregated events for list view
  const filteredRecords = aggregatedEvents.filter(item => {
    let matchesSearch = true
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase()
      matchesSearch = item.title?.toLowerCase().includes(lowerSearch) ||
                      item.type?.toLowerCase().includes(lowerSearch) ||
                      item.source?.toLowerCase().includes(lowerSearch)
    }
    
    let matchesDate = true
    if (dateRange.start && dateRange.end) {
      const dateStr = item.date || item.endDate
      if (dateStr) {
        const created = new Date(dateStr)
        const start = new Date(dateRange.start)
        const end = new Date(dateRange.end)
        end.setHours(23, 59, 59, 999)
        matchesDate = created >= start && created <= end
      }
    }

    // Time-based filter (All, Upcoming, Past)
    let matchesTimeFilter = true
    if (timeFilter !== 'all' && item.date) {
      const eventDate = new Date(item.date)
      const today = new Date()
      today.setHours(0, 0, 0, 0) // Reset to start of day for accurate comparison
      
      if (timeFilter === 'upcoming') {
        matchesTimeFilter = eventDate >= today
      } else if (timeFilter === 'past') {
        matchesTimeFilter = eventDate < today
      }
    }

    const matchesFilter = !filter || item.source === filter
    return matchesSearch && matchesFilter && matchesDate && matchesTimeFilter
  }).sort((a, b) => {
    // Sort overdue items to the top
    const aOverdue = isEventOverdue(a)
    const bOverdue = isEventOverdue(b)
    
    if (aOverdue && !bOverdue) return -1 // a comes first
    if (!aOverdue && bOverdue) return 1  // b comes first
    
    // If both are overdue or both are not, maintain original order (by date descending)
    if (a.date && b.date) {
      return new Date(b.date) - new Date(a.date)
    }
    return 0
  })

  const { currentPage, setCurrentPage, pageSize, setPageSize, totalPages, safePage, pagedRecords } = useListPagination(filteredRecords)
  const hasActiveFilters = !!(searchTerm || filter || dateRange.start || dateRange.end || timeFilter !== 'all')

  const handleClearFilters = () => {
    setSearchTerm('')
    setFilter('')
    setDateRange({ start: '', end: '' })
    setTimeFilter('all')
    setCurrentPage(1)
  }

  const handlePrintPDF = () => {
    // Convert aggregated events to PDF-friendly format
    const pdfRecords = filteredRecords.map(event => ({
      event_title: event.title || '—',
      source: EVENT_SOURCES[event.source]?.label || event.type || '—',
      date: event.date || '',
      location: event.data?.location || event.data?.destination || event.data?.facility_name || '—',
      status_type: getEventStatusOrType(event)
    }))
    
    printPDF({
      title: 'Calendar Events Report',
      subtitle: `${filteredRecords.length} events`,
      columns: [
        { header: 'Event Title', key: 'event_title' },
        { header: 'Source', key: 'source' },
        { header: 'Date', key: 'date', format: v => v ? format(new Date(v), 'MMM dd, yyyy') : '—' },
        { header: 'Location', key: 'location' },
        { header: 'Status/Type', key: 'status_type' },
      ],
      records: pdfRecords,
    })
  }

  const loadRecords = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .order('start_date', { ascending: false })

      if (error) throw error
      setRecords(data || [])
      await loadAggregatedEvents()
    } catch (err) {
      console.error('Error loading calendar events:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Helper function to get styling for status/type badge
  const getStatusTypeStyle = (statusOrType, source) => {
    // Default style
    const defaultStyle = {
      bg: '#f3f4f6',
      color: '#6b7280',
      icon: 'ri-information-line'
    }

    // Status-based styling (common across modules)
    const statusStyles = {
      'Completed': { bg: '#d1fae5', color: '#065f46', icon: 'ri-checkbox-circle-line' },
      'Complete': { bg: '#d1fae5', color: '#065f46', icon: 'ri-checkbox-circle-line' },
      'Ongoing': { bg: '#fef3c7', color: '#92400e', icon: 'ri-time-line' },
      'Scheduled': { bg: '#dbeafe', color: '#1e40af', icon: 'ri-calendar-check-line' },
      'Pending': { bg: '#fef3c7', color: '#92400e', icon: 'ri-time-line' },
      'Cancelled': { bg: '#fee2e2', color: '#991b1b', icon: 'ri-close-circle-line' },
      'Approved': { bg: '#d1fae5', color: '#065f46', icon: 'ri-check-line' },
      'In Progress': { bg: '#dbeafe', color: '#1e40af', icon: 'ri-loader-line' },
    }

    // Calendar event type styling
    const eventTypeStyles = {
      'Drill / Exercise': { bg: '#fee2e2', color: '#991b1b', icon: 'ri-alarm-warning-line' },
      'Training': { bg: '#dbeafe', color: '#1e40af', icon: 'ri-book-open-line' },
      'Meeting': { bg: '#fef3c7', color: '#92400e', icon: 'ri-team-line' },
      'Community Outreach': { bg: '#d1fae5', color: '#065f46', icon: 'ri-community-line' },
      'Disaster Response': { bg: '#fce7f3', color: '#831843', icon: 'ri-alert-line' },
      'Holiday': { bg: '#ede9fe', color: '#5b21b6', icon: 'ri-gift-line' },
      'Maintenance': { bg: '#e0f2fe', color: '#0c4a6e', icon: 'ri-tools-line' },
      'Other': { bg: '#f3f4f6', color: '#6b7280', icon: 'ri-more-line' },
    }

    // Check for exact match in status styles
    if (statusStyles[statusOrType]) {
      return statusStyles[statusOrType]
    }

    // Check for event types (calendar events)
    if (source === 'calendar_events' && eventTypeStyles[statusOrType]) {
      return eventTypeStyles[statusOrType]
    }

    // For custom types (event assistance, etc.)
    if (source === 'events_assistance') {
      return { bg: '#fce7f3', color: '#831843', icon: 'ri-service-line' }
    }

    return defaultStyle
  }

  const handleNavigateToModule = (source, recordId) => {
    const routes = {
      transport: '/transport',
      venues: '/venues',
      activities: '/activities',
      events_assistance: '/events-assistance',
      pruning: '/pruning',
      logistic: '/logistic'
    }
    if (routes[source]) {
      // Navigate with record ID as query parameter to auto-open the modal
      window.location.href = `${routes[source]}?view=${recordId}`
    }
  }

  const loadAggregatedEvents = async () => {
    try {
      const events = []
      
      // Load Calendar Events
      const { data: calendarData } = await supabase.from('calendar_events').select('*')
      if (calendarData) {
        calendarData.forEach(e => {
          events.push({
            id: `cal-${e.id}`,
            title: e.event_title || 'Untitled Event',
            date: e.start_date,
            endDate: e.end_date,
            color: '#3b82f6',
            type: 'Calendar Event',
            source: 'calendar_events',
            data: e
          })
        })
      }

      // Load Transport Bookings (uses date_time field)
      const { data: transportData } = await supabase.from('transport').select('*')
      if (transportData) {
        transportData.forEach(t => {
          events.push({
            id: `trans-${t.id}`,
            title: `Transport: ${t.purpose || 'Booking'}`,
            date: t.date_time ? t.date_time.split('T')[0] : null, // Extract date from timestamp
            color: '#10b981',
            type: 'Transport',
            source: 'transport',
            data: t
          })
        })
      }

      // Load Venue Bookings (uses date field, not booking_date)
      const { data: venuesData } = await supabase.from('venues').select('*')
      if (venuesData) {
        venuesData.forEach(v => {
          events.push({
            id: `venue-${v.id}`,
            title: `Venue: ${v.facility_name || 'Booking'}`,
            date: v.date,
            color: '#f59e0b',
            type: 'Venue',
            source: 'venues',
            data: v
          })
        })
      }

      // Load Activities (uses date field and activity_title)
      const { data: activitiesData } = await supabase.from('activities').select('*')
      if (activitiesData) {
        activitiesData.forEach(a => {
          events.push({
            id: `act-${a.id}`,
            title: a.activity_title || 'Activity',
            date: a.date,
            color: '#8b5cf6',
            type: 'Activity',
            source: 'activities',
            data: a
          })
        })
      }

      // Load Events Assistance (uses date field, not event_date)
      const { data: eventsData } = await supabase.from('events_assistance').select('*')
      if (eventsData) {
        eventsData.forEach(e => {
          events.push({
            id: `evt-${e.id}`,
            title: e.event_name || 'Event',
            date: e.date,
            color: '#ec4899',
            type: 'Event Assistance',
            source: 'events_assistance',
            data: e
          })
        })
      }

      // Load Pruning & Trimming (correct table name: pruning_trimming)
      const { data: pruningData } = await supabase.from('pruning_trimming').select('*')
      if (pruningData) {
        pruningData.forEach(p => {
          events.push({
            id: `prune-${p.id}`,
            title: `Pruning: ${p.location || 'Request'}`,
            date: p.date,
            color: '#14b8a6',
            type: 'Pruning',
            source: 'pruning',
            data: p
          })
        })
      }

      // Load Logistic (Borrowed Items)
      try {
        const { data: logisticData } = await supabase.from('logistic').select('*')
        if (logisticData) {
          logisticData.forEach(l => {
            events.push({
              id: `log-${l.id}`,
              title: `Borrowed: ${l.item_type || 'Item'} (${l.borrower_name})`,
              date: l.date_released,
              endDate: l.date_returned,
              color: '#84cc16',
              type: 'Logistic',
              source: 'logistic',
              data: l
            })
          })
        }
      } catch (logErr) {
        console.warn('Failed to load logistic aggregated events:', logErr)
      }


      setAggregatedEvents(events)
    } catch (err) {
      console.error('Error loading aggregated events:', err)
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
      record_id: `CAL-${year}-${rand}`,
      start_date: todayStr,
      end_date: todayStr
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (rec) => {
    setIsEditing(true)
    setIsViewing(false)
    setSelectedId(rec.id)
    setFormData({
      record_id: rec.record_id || '',
      event_title: rec.event_title || '',
      event_type: rec.event_type || '',
      event_type_other: rec.event_type_other || '',
      start_date: rec.start_date || '',
      end_date: rec.end_date || '',
      location: rec.location || '',
      organizer: rec.organizer || '',
      description: rec.description || '',
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      if (isEditing) {
        const { data, error } = await supabase
          .from('calendar_events')
          .update(formData)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setRecords(records.map(rec => rec.id === selectedId ? data[0] : rec))
        await loadAggregatedEvents() // Refresh aggregated events after update
        await logAudit('Updated', 'CalendarEvents', formData.record_id || formData.id || selectedId, 'Updated record details')
        toast.success('Calendar event updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('calendar_events')
          .insert([formData])
          .select()

        if (error) throw error
        setRecords([data[0], ...records])
        await loadAggregatedEvents() // Refresh aggregated events after insert
        await logAudit('Added', 'CalendarEvents', formData.record_id || data[0].record_id || data[0].id, 'Created new record')
        toast.success('Calendar event added successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving calendar event:', err)
      toast.error('Error saving event: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This calendar event will be permanently removed. This action cannot be undone.', { title: 'Delete Record' })
    if (!ok) return

    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', id)

      if (error) throw error
      setRecords(records.filter(rec => rec.id !== id))
      await loadAggregatedEvents() // Refresh aggregated events after delete
      await logAudit('Deleted', 'CalendarEvents', id, 'Deleted record')
      toast.success('Event deleted successfully!')
    } catch (err) {
      console.error('Error deleting calendar event:', err)
      toast.error('Failed to delete event: ' + err.message)
    }
  }

  const getEventTypeBadge = (type) => {
    const colors = {
      'Drill / Exercise': { bg: '#fee2e2', color: '#991b1b' },
      'Training': { bg: '#dbeafe', color: '#1e40af' },
      'Meeting': { bg: '#fef3c7', color: '#92400e' },
      'Community Outreach': { bg: '#d1fae5', color: '#065f46' },
      'Disaster Response': { bg: '#fce7f3', color: '#831843' },
      'Holiday': { bg: '#ede9fe', color: '#5b21b6' },
      'Maintenance': { bg: '#e0f2fe', color: '#0c4a6e' },
    }
    const style = colors[type] || { bg: '#e5e7eb', color: '#374151' }

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
        {type || 'Other'}
      </span>
    )
  }

  const getDateRangeDisplay = (start, end) => {
    if (!start) return '-'
    try {
      const startFmt = format(new Date(start), 'MMM dd, yyyy')
      if (!end || end === start) return startFmt
      const endFmt = format(new Date(end), 'MMM dd, yyyy')
      return `${startFmt} – ${endFmt}`
    } catch {
      return start
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading calendar events...</p>
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
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading Calendar Events</h3>
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
        <div>
          <h2>
            <i className="ri-calendar-line" style={{ marginRight: '12px' }}></i>
            Calendar Events
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: 'var(--text-muted)', fontWeight: '600' }}>
            {aggregatedEvents.length} total events from all modules
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-app)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                background: viewMode === 'list' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'list' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.2s'
              }}
            >
              <i className="ri-list-check" style={{ marginRight: '6px' }}></i> List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              style={{
                padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                background: viewMode === 'calendar' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'calendar' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.2s'
              }}
            >
              <i className="ri-calendar-line" style={{ marginRight: '6px' }}></i> Calendar
            </button>
          </div>
          <button className="btn-add" onClick={handleOpenAdd} style={{ display: (isAdmin || canCreate) ? '' : 'none' }}>
            <i className="ri-add-line"></i>
            Add Event
          </button>
        </div>
      </div>

      {/* Stats Cards - Visible in both List and Calendar views */}
      {aggregatedEvents.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          {Object.entries(EVENT_SOURCES).filter(([key]) => key !== 'all').map(([key, source]) => {
            // Apply time filter to counts
            const count = aggregatedEvents.filter(e => {
              if (e.source !== key) return false
              
              // Apply time filter
              if (timeFilter === 'all') return true
              if (!e.date) return false
              
              const eventDate = new Date(e.date)
              const today = new Date()
              today.setHours(0, 0, 0, 0)
              
              if (timeFilter === 'upcoming') return eventDate >= today
              if (timeFilter === 'past') return eventDate < today
              return true
            }).length
            
            return (
              <div 
                key={key}
                style={{
                  padding: '16px',
                  background: sourceFilter === key ? `${source.color}15` : 'var(--bg-surface)',
                  borderLeft: `2px solid ${sourceFilter === key ? source.color : 'var(--border-light)'}`,
                  borderRight: `2px solid ${sourceFilter === key ? source.color : 'var(--border-light)'}`,
                  borderBottom: `2px solid ${sourceFilter === key ? source.color : 'var(--border-light)'}`,
                  borderTop: `4px solid ${source.color}`,
                  borderRadius: '12px',
                  transition: 'all 0.2s',
                  boxShadow: sourceFilter === key ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <i className={source.icon} style={{ fontSize: '24px', color: source.color }}></i>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>{source.label}</div>
                    <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text)' }}>{count}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      

      {aggregatedEvents.length > 0 && (
        <ModuleToolbar
          onSearch={v => { setSearchTerm(v); setCurrentPage(1) }}
          onFilterChange={v => { setFilter(v); setCurrentPage(1) }}
          onDateRangeChange={r => { setDateRange(r); setCurrentPage(1) }}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          onExportClick={() => setIsExportOpen(true)}
          onPrintClick={handlePrintPDF}
          onClearFilters={handleClearFilters}
          filterLabel="All Sources"
          filterOptions={[
            { label: 'Calendar Events', value: 'calendar_events' },
            { label: 'Transport', value: 'transport' },
            { label: 'Venues', value: 'venues' },
            { label: 'Activities', value: 'activities' },
            { label: 'Events Assistance', value: 'events_assistance' },
            { label: 'Pruning & Trimming', value: 'pruning' },
            { label: 'Logistic (Borrowed)', value: 'logistic' },
          ]}
          filterColorMap={{
            'calendar_events': { bg: '#dbeafe', color: '#1e40af', icon: 'ri-calendar-line' },
            'transport': { bg: '#d1fae5', color: '#065f46', icon: 'ri-truck-line' },
            'venues': { bg: '#fef3c7', color: '#92400e', icon: 'ri-building-line' },
            'activities': { bg: '#ede9fe', color: '#5b21b6', icon: 'ri-flag-line' },
            'events_assistance': { bg: '#fce7f3', color: '#831843', icon: 'ri-service-line' },
            'pruning': { bg: '#e0f2fe', color: '#0c4a6e', icon: 'ri-scissors-cut-line' },
            'logistic': { bg: '#f1fbf0', color: '#84cc16', icon: 'ri-shopping-bag-line' },
          }}
          hasActiveFilters={hasActiveFilters}
        >
          {/* Time Filter Buttons */}
          <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-app)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
            <button
              onClick={() => { setTimeFilter('all'); setCurrentPage(1) }}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                background: timeFilter === 'all' ? 'var(--primary)' : 'transparent',
                color: timeFilter === 'all' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap'
              }}
            >
              <i className="ri-list-check-2"></i>
              All
            </button>
            <button
              onClick={() => { setTimeFilter('upcoming'); setCurrentPage(1) }}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                background: timeFilter === 'upcoming' ? '#10b981' : 'transparent',
                color: timeFilter === 'upcoming' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap'
              }}
            >
              <i className="ri-arrow-right-up-line"></i>
              Upcoming
            </button>
            <button
              onClick={() => { setTimeFilter('past'); setCurrentPage(1) }}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                background: timeFilter === 'past' ? '#6b7280' : 'transparent',
                color: timeFilter === 'past' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap'
              }}
            >
              <i className="ri-history-line"></i>
              Past
            </button>
          </div>
        </ModuleToolbar>
      )}

      {viewMode === 'calendar' ? (
        <div>
          {/* Calendar View */}
          <CalendarView
            events={aggregatedEvents
              .filter(e => sourceFilter === 'all' || e.source === sourceFilter)
              .map(e => {
                const urgencyStatus = getEventUrgencyStatus(e.date)
                let accentColor = e.color // Default to source color
                
                // Override color for urgent events
                if (urgencyStatus === 'today') {
                  accentColor = '#dc2626' // Red for today
                } else if (urgencyStatus === 'upcoming') {
                  accentColor = '#f59e0b' // Yellow for upcoming
                }
                
                return {
                  ...e,
                  color: accentColor, // Use accent color if urgent, otherwise source color
                  onClick: () => {
                    if (e.source === 'calendar_events') {
                      handleViewDetails(e.data)
                    } else {
                      // Navigate to source module with record ID to auto-open modal
                      handleNavigateToModule(e.source, e.data.id)
                    }
                  }
                }
              })}
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
          />

          {/* Legend */}
          <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '12px', color: 'var(--text)' }}>
              <i className="ri-information-line" style={{ marginRight: '6px' }}></i>
              Event Sources Legend
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {Object.entries(EVENT_SOURCES).filter(([key]) => key !== 'all').map(([key, source]) => (
                <div 
                  key={key}
                  onClick={() => setSourceFilter(sourceFilter === key ? 'all' : key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    background: sourceFilter === key ? `${source.color}20` : 'transparent',
                    border: `1.5px solid ${source.color}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    opacity: sourceFilter === 'all' || sourceFilter === key ? 1 : 0.5
                  }}
                >
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: source.color }}></div>
                  <i className={source.icon} style={{ fontSize: '14px', color: source.color }}></i>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: source.color }}>{source.label}</span>
                </div>
              ))}
            </div>
            {sourceFilter !== 'all' && (
              <button
                onClick={() => setSourceFilter('all')}
                style={{
                  marginTop: '12px',
                  padding: '6px 12px',
                  background: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                <i className="ri-close-line" style={{ marginRight: '4px' }}></i>
                Clear Filter
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {aggregatedEvents.length === 0 ? (
            <div className="empty-state">
              <i className="ri-calendar-line"></i>
              <h3>No Events</h3>
              <p>No events found from any module.</p>
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
                    <th>Event / Activity</th>
                    <th>Source</th>
                    <th>Date</th>
                    <th>Status / Type</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRecords.map((event) => {
                    const sourceInfo = EVENT_SOURCES[event.source] || EVENT_SOURCES.all
                    const dateDisplay = event.date ? format(new Date(event.date), 'MMM dd, yyyy') : '—'
                    const urgencyStatus = getEventUrgencyStatus(event.date)
                    const statusOrType = getEventStatusOrType(event)
                    const statusStyle = getStatusTypeStyle(statusOrType, event.source)
                    const overdue = isEventOverdue(event)
                    
                    // Determine row accent color based on urgency or overdue status
                    let rowAccentColor = null
                    let rowBackground = 'transparent'
                    
                    // OVERDUE items get priority (red with stronger accent)
                    if (overdue) {
                      rowAccentColor = '#dc2626' // Dark red for overdue
                      rowBackground = '#fef2f2' // Light red background
                    } else if (urgencyStatus === 'today') {
                      rowAccentColor = '#dc2626' // Red for ongoing (today)
                      rowBackground = '#fef2f2' // Light red background
                    } else if (urgencyStatus === 'upcoming') {
                      rowAccentColor = '#f59e0b' // Yellow/Orange for upcoming (within 7 days)
                      rowBackground = '#fffbeb' // Light yellow background
                    }

                    return (
                      <tr 
                        key={event.id}
                        style={{ 
                          height: '49px',
                          background: rowBackground,
                          borderLeft: rowAccentColor ? `4px solid ${rowAccentColor}` : 'none',
                          transition: 'all 0.2s'
                        }}
                      >
                        <td style={{ fontWeight: '700' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {overdue ? (
                                <i 
                                  className="ri-error-warning-fill"
                                  style={{ 
                                    color: '#dc2626', 
                                    fontSize: '18px',
                                    animation: 'pulse 2s infinite'
                                  }}
                                  title="OVERDUE: This event is past due and still pending/scheduled!"
                                ></i>
                              ) : urgencyStatus && (
                                <i 
                                  className={urgencyStatus === 'today' ? 'ri-alarm-warning-fill' : 'ri-time-line'}
                                  style={{ 
                                    color: rowAccentColor, 
                                    fontSize: '16px',
                                    animation: urgencyStatus === 'today' ? 'pulse 2s infinite' : 'none'
                                  }}
                                  title={urgencyStatus === 'today' ? 'Event is today!' : 'Upcoming within 7 days'}
                                ></i>
                              )}
                              {event.title}
                            </div>
                            {event.data?.created_by && (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'normal' }}>
                                <i className="ri-user-line" style={{ fontSize: '12px' }}></i>
                                {event.data.created_by.split('@')[0]}
                                {event.data.updated_by && event.data.updated_by !== event.data.created_by && (
                                  <span style={{ marginLeft: '6px', color: 'var(--text-muted)' }}>
                                    • updated by: {event.data.updated_by.split('@')[0]}
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '700',
                            background: `${sourceInfo.color}15`,
                            color: sourceInfo.color,
                            border: `1px solid ${sourceInfo.color}40`
                          }}>
                            <i className={sourceInfo.icon}></i>
                            {sourceInfo.label}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                          {dateDisplay}
                        </td>
                        <td>
                          {statusOrType !== '—' ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: '700',
                              background: overdue ? '#fef2f2' : statusStyle.bg,
                              color: overdue ? '#dc2626' : statusStyle.color,
                              border: overdue ? '2px solid #dc2626' : `1px solid ${statusStyle.color}30`,
                              whiteSpace: 'nowrap'
                            }}>
                              <i className={overdue ? 'ri-error-warning-line' : statusStyle.icon}></i>
                              {overdue ? `⚠ ${statusOrType} (OVERDUE)` : statusOrType}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {event.source === 'calendar_events' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleViewDetails(event.data)
                              }}
                              style={{
                                padding: '6px 12px',
                                background: 'var(--primary)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <i className="ri-eye-line"></i>
                              View
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleNavigateToModule(event.source, event.data.id)
                              }}
                              style={{
                                padding: '6px 12px',
                                background: sourceInfo.color,
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <i className="ri-external-link-line"></i>
                              View More
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  <TableGhostRows count={pageSize - pagedRecords.length} colSpan={5} />
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
        records={aggregatedEvents.map(event => ({
          event_title: event.title || '—',
          source: EVENT_SOURCES[event.source]?.label || event.type || '—',
          date: event.date || '',
          end_date: event.endDate || '',
          location: event.data?.location || event.data?.destination || event.data?.facility_name || event.data?.event_name || event.data?.office || '—',
          status_type: getEventStatusOrType(event),
          organizer: event.data?.organizer || event.data?.booked_by || event.data?.conducted_by || event.data?.person_in_charge || '—',
          description: event.data?.description || event.data?.purpose || event.data?.remarks || event.data?.address || '—'
        }))}
        filename="calendar_events_aggregated_report.xlsx"
        sheetName="All Events"
        dateField="date"
        onSuccess={(count) => toast.success(`Exported ${count} aggregated events successfully.`)}
        onError={(msg) => toast.error(msg)}
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isViewing ? 'View Details' : (isEditing ? 'Edit Calendar Event' : 'Add Calendar Event')}
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
          <div className="form-row">
            <div className="form-group">
              <label>Event Type *</label>
              <select name="event_type" value={formData.event_type} onChange={handleInputChange} required>
                <option value="">-- Select Type --</option>
                {EVENT_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            {formData.event_type === 'Other' && (
              <div className="form-group">
                <label>Specify Type *</label>
                <input
                  type="text"
                  name="event_type_other"
                  value={formData.event_type_other}
                  onChange={handleInputChange}
                  required={formData.event_type === 'Other'}
                  placeholder="e.g. Workshop, Seminar, Ceremony"
                />
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Event Title *</label>
            <input
              type="text"
              name="event_title"
              value={formData.event_title}
              onChange={handleInputChange}
              required
              placeholder="e.g. Annual Earthquake Drill 2024"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Date *</label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                onChange={handleInputChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                placeholder="e.g. Municipal Gymnasium"
              />
            </div>
            <div className="form-group">
              <label>Organizer</label>
              <input
                type="text"
                name="organizer"
                value={formData.organizer}
                onChange={handleInputChange}
                placeholder="e.g. CDRRMO Office"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              placeholder="Brief description of the event, agenda, or objectives..."
            />
          </div>

          </fieldset>

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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