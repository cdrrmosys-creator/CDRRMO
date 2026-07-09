import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, supabaseAdmin } from '../../services/supabase'
import { useAuthStore } from '../../stores/useAuthStore'
import { format, subMonths, startOfMonth, endOfMonth, subDays, startOfDay, endOfDay, subWeeks, startOfWeek, endOfWeek, addDays, isSameDay, isToday } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts'

// ── Design tokens ────────────────────────────────────────────────────────────
const PRIMARY   = '#dc2626'
const COLORS    = {
  personnel : '#dc2626',
  incidents : '#ea580c',
  transport : '#0891b2',
  pruning   : '#16a34a',
  events    : '#7c3aed',
  vouchers  : '#b45309',
}

const DUTY_PALETTE     = ['#16a34a','#dc2626','#2563eb','#d97706']
const TEAM_PALETTE     = { Alpha:'#2563eb', Bravo:'#16a34a', Charlie:'#d97706', Delta:'#dc2626', Unknown:'#6b7280' }
const ASSIST_PALETTE   = ['#0891b2', '#16a34a', '#7c3aed']
const VOUCHER_COLOR    = '#b45309'

const EVENT_SOURCES = {
  all: { label: 'All Events', color: '#6b7280', icon: 'ri-apps-line' },
  calendar_events: { label: 'Calendar Events', color: '#3b82f6', icon: 'ri-calendar-line' },
  transport: { label: 'Transport', color: '#10b981', icon: 'ri-truck-line' },
  venues: { label: 'Venues', color: '#f59e0b', icon: 'ri-building-line' },
  activities: { label: 'Activities', color: '#8b5cf6', icon: 'ri-flag-line' },
  events_assistance: { label: 'Events Assistance', color: '#ec4899', icon: 'ri-service-line' },
  pruning: { label: 'Pruning & Trimming', color: '#14b8a6', icon: 'ri-scissors-cut-line' }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function groupBy(arr, key) {
  return (arr || []).reduce((acc, item) => {
    const k = item[key] ?? 'Unknown'
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})
}

// Helper function to get status/type based on event source
function getEventStatusOrType(event) {
  switch (event.source) {
    case 'calendar_events':
      if (event.data.event_type === 'Other' && event.data.event_type_other) {
        return event.data.event_type_other
      }
      return event.data.event_type || '—'
    
    case 'transport':
      return event.data.status || '—'
    
    case 'venues':
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
      return event.data.status || 'Complete'
    
    case 'events_assistance':
      return event.data.type_of_assistance || '—'
    
    case 'pruning':
      return event.data.status || '—'
    
    default:
      return '—'
  }
}

// Helper function to get styling for status/type badge
function getStatusTypeStyle(statusOrType, source) {
  const defaultStyle = { bg: '#f3f4f6', color: '#6b7280', icon: 'ri-information-line' }

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

  if (statusStyles[statusOrType]) return statusStyles[statusOrType]
  if (source === 'calendar_events' && eventTypeStyles[statusOrType]) return eventTypeStyles[statusOrType]
  if (source === 'events_assistance') return { bg: '#fce7f3', color: '#831843', icon: 'ri-service-line' }

  return defaultStyle
}

// ── Shared card ───────────────────────────────────────────────────────────────
function Card({ title, icon, children, style = {}, rightElement }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius-lg)',
      padding: '24px',
      boxShadow: 'var(--shadow-sm)',
      display: 'flex',
      flexDirection: 'column',
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
      <div style={{ flex: 1, minHeight: 0 }}>
        {children}
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ h = '200px' }) {
  return (
    <div style={{
      width:'100%', height:h, borderRadius:'8px',
      background:'var(--border-light)',
      animation:'sk-pulse 1.4s ease-in-out infinite'
    }} />
  )
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
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
          <span style={{ fontWeight:'700', color:'var(--text)' }}>{typeof p.value === 'number' && p.name === 'Amount (PHP)' ? `₱${p.value.toLocaleString()}` : p.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Custom pie label ──────────────────────────────────────────────────────────
const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name, value }) => {
  if (percent < 0.06) return null
  const RADIAN = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize:'11px', fontWeight:'800' }}>
      {value}
    </text>
  )
}

// ── Legend pill row ───────────────────────────────────────────────────────────
function LegendPills({ items }) {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', marginTop:'16px', justifyContent:'center' }}>
      {items.map(({ name, color, value }) => (
        <div key={name} style={{
          display:'flex', alignItems:'center', gap:'5px',
          background: `${color}18`, borderRadius:'20px',
          padding:'3px 10px', fontSize:'12px', fontWeight:'700', color
        }}>
          <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:color, display:'inline-block' }} />
          {name}: {value}
        </div>
      ))}
    </div>
  )
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading]         = useState(true)
  const [counts, setCounts]           = useState({})
  
  const [empStatusData, setEmpStatus] = useState([])
  const [incTeamData, setIncTeam]     = useState([])
  
  const [assistData, setAssistData]   = useState([])
  const [voucherData, setVoucherData] = useState([])
  
  const [chartData, setChartData]     = useState([])
  const [trendPeriod, setTrendPeriod] = useState('month')
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [selectedYear, setSelectedYear] = useState('2025')
  
  const [allIncidents, setAllIncidents] = useState([])
  
  const [recentInc, setRecentInc]     = useState([])
  const [recentReq, setRecentReq]     = useState([])
  const [calendarEvents, setCalendarEvents] = useState({ all: [], recent: [] })
  const [aggregatedEvents, setAggregatedEvents] = useState([])
  const [recentAggregatedEvents, setRecentAggregatedEvents] = useState([])
  const [hoveredDay, setHoveredDay] = useState(null)

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    if (!allIncidents) return;

    let start, end;
    if (trendPeriod === 'day') {
      const [y, m] = selectedMonth.split('-');
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 0); // last day of month
    } else if (trendPeriod === 'week') {
      const [y, m] = selectedMonth.split('-');
      start = new Date(y, m - 1, 1);
      end = new Date(y, m - 1 + 3, 0); // last day of 3rd month
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

    if (allIncidents.length > 0) {
      allIncidents.forEach(inc => {
        if (!inc.date) return;
        const t = new Date(inc.date).getTime();
        data.forEach(m => { if (t >= m.start && t <= m.end) m.count++ })
      })
    }

    setChartData(data.map(m => ({ label: m.label, Incidents: m.count })))
  }, [allIncidents, trendPeriod, selectedMonth, selectedYear])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const client = supabaseAdmin || supabase
      const [
        { count: empC, data: empD },
        { count: volC },
        { count: incC, data: incD },
        { count: drownC, data: drownD },
        { count: transC, data: transD },
        { count: pruneC, data: pruneD },
        { count: evtsC, data: evtsD },
        { count: vouchC, data: vouchD },
        { data: calEventsD },
        { data: calEventsRecent }
      ] = await Promise.all([
        client.from('employees').select('duty_status', { count: 'exact' }),
        client.from('volunteers').select('id, status', { count: 'exact' }),
        client.from('incidents').select('severity, nature_of_incident, date, time_of_call, place_of_incident, record_id, team').order('date', { ascending: false }),
        client.from('drowning_incidents').select('date, location, victim_name'),
        client.from('transport').select('date_time, patient_name, destination'),
        client.from('pruning_trimming').select('date_of_request, location, status'),
        client.from('events_assistance').select('date, event_name, location'),
        client.from('vouchers').select('date, amount'),
        client.from('calendar_events').select('event_title, event_type, start_date, end_date, location, organizer'),
        client.from('calendar_events').select('event_title, event_type, start_date, end_date, location, organizer').order('start_date', { ascending: false }).limit(5)
      ])

      const totalPersonnel = (empC || 0) + (volC || 0)
      const totalIncidents = (incD?.length || 0) + (drownD?.length || 0)
      const pendingPruning = (pruneD || []).filter(p => p.status === 'Pending').length

      setCounts({
        personnel: totalPersonnel,
        incidents: totalIncidents,
        transport: transD?.length || 0,
        pruning: pendingPruning,
        events: evtsD?.length || 0,
        vouchers: vouchD?.length || 0,
      })

      // Employee duty status
      const eg = groupBy(empD, 'duty_status')
      setEmpStatus([
        { name:'On Duty',  value: eg['On Duty']  || 0 },
        { name:'Off Duty', value: eg['Off Duty'] || 0 },
        { name:'Standby',  value: eg['Standby']  || 0 },
        { name:'On Leave', value: eg['On Leave'] || 0 },
      ])

      // Incidents by team
      const normalizeTeam = (val) => {
        if (!val) return 'Others'
        const v = String(val).trim()
        const map = { alpha: 'Alpha', bravo: 'Bravo', charlie: 'Charlie', delta: 'Delta' }
        return map[v.toLowerCase()] || v
      }
      const normalizedInc = (incD || []).map(r => ({ ...r, _team: normalizeTeam(r.team) }))
      const tg = groupBy(normalizedInc, '_team')
      const knownTeams = ['Alpha', 'Bravo', 'Charlie', 'Delta']
      const othersCount = Object.entries(tg).filter(([k]) => !knownTeams.includes(k)).reduce((s, [, v]) => s + v, 0)
      setIncTeam([
        { name: 'Alpha',   value: tg['Alpha']   || 0, fill: TEAM_PALETTE.Alpha },
        { name: 'Bravo',   value: tg['Bravo']   || 0, fill: TEAM_PALETTE.Bravo },
        { name: 'Charlie', value: tg['Charlie'] || 0, fill: TEAM_PALETTE.Charlie },
        { name: 'Delta',   value: tg['Delta']   || 0, fill: TEAM_PALETTE.Delta },
        { name: 'Others',  value: othersCount,         fill: TEAM_PALETTE.Unknown },
      ])

      // Combine Incidents + Drowning for trend chart
      const combinedInc = [
        ...(incD || []).map(i => ({ date: i.date || i.created_at, type: 'General' })),
        ...(drownD || []).map(i => ({ date: i.date, type: 'Drowning' }))
      ]
      setAllIncidents(combinedInc)
      setRecentInc((incD || []).slice(0, 5))

      // Assistance Pie Data
      setAssistData([
        { name: 'Transport', value: transD?.length || 0 },
        { name: 'Pruning', value: pruneD?.length || 0 },
        { name: 'Events', value: evtsD?.length || 0 }
      ])

      // Voucher Bar Data (Last 6 Months)
      const vMap = {}
      ;(vouchD || []).forEach(v => {
        if(!v.date) return
        const m = format(new Date(v.date), 'MMM yyyy')
        const val = typeof v.amount === 'string' ? parseFloat(v.amount.replace(/[^0-9.-]+/g,"")) : (v.amount || 0)
        vMap[m] = (vMap[m] || 0) + val
      })
      const vArr = Object.keys(vMap).map(k => ({ name: k, amount: vMap[k] }))
      vArr.sort((a,b) => new Date(a.name) - new Date(b.name))
      setVoucherData(vArr.slice(-6))

      // Recent Service Requests Feed
      const reqList = [
        ...(transD || []).map(r => ({ date: r.date_time, title: 'Transport: ' + (r.patient_name || 'Patient'), location: r.destination, type: 'Transport', icon: 'ri-taxi-line' })),
        ...(pruneD || []).map(r => ({ date: r.date_of_request, title: 'Pruning & Trimming', location: r.location, type: 'Pruning', icon: 'ri-scissors-line' })),
        ...(evtsD || []).map(r => ({ date: r.date, title: 'Event: ' + (r.event_name || 'Event'), location: r.location, type: 'Event', icon: 'ri-calendar-event-line' }))
      ]
      reqList.sort((a,b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      setRecentReq(reqList.slice(0, 5))

      // Aggregated Events from all modules (EXACT COPY from CalendarEvents module)
      const events = []
      
      // Load Calendar Events
      if (calEventsD) {
        calEventsD.forEach(e => {
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
      const { data: transportData } = await client.from('transport').select('*')
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
      const { data: venuesData } = await client.from('venues').select('*')
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
      const { data: activitiesData } = await client.from('activities').select('*')
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
      const { data: eventsData } = await client.from('events_assistance').select('*')
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
      const { data: pruningData } = await client.from('pruning_trimming').select('*')
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

      // Sort all events by date (most recent first)
      events.sort((a, b) => {
        if (!a.date) return 1
        if (!b.date) return -1
        return new Date(b.date).getTime() - new Date(a.date).getTime()
      })
      
      setAggregatedEvents(events) // All events for calendar view
      setRecentAggregatedEvents(events.slice(0, 5)) // Top 5 for list view

      // Calendar Events - all for calendar view and first 5 for list
      const allEvents = (calEventsD || []).map(e => ({
        event_title: e.event_title,
        start_date: e.start_date,
        end_date: e.end_date,
        location: e.location,
        event_type: e.event_type,
        organizer: e.organizer
      }))
      
      const recentEvents = (calEventsRecent || []).map(e => ({
        event_title: e.event_title,
        start_date: e.start_date,
        end_date: e.end_date,
        location: e.location,
        event_type: e.event_type,
        organizer: e.organizer
      }))
      
      console.log('Calendar events loaded:', allEvents.length, 'total events')
      console.log('Recent events:', recentEvents.length, 'events')
      console.log('Recent events data:', recentEvents)
      
      setCalendarEvents({ all: allEvents, recent: recentEvents })

    } catch (err) {
      console.error('Dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Stats grid data
  const statCards = [
    { label:'Personnel on Duty', value: counts.personnel, color: COLORS.personnel, icon:'ri-team-line',            sub:'Employees & Volunteers', path:'/employees' },
    { label:'Total Incidents',  value: counts.incidents,  color: COLORS.incidents,  icon:'ri-alarm-warning-line', sub:'Incidents & Drowning', path:'/incidents' },
    { label:'Transport Assist', value: counts.transport,  color: COLORS.transport,  icon:'ri-taxi-line',          sub:'Patient Transfers', path:'/transport' },
    { label:'Pending Pruning',  value: counts.pruning,    color: COLORS.pruning,    icon:'ri-scissors-line',      sub:'Actionable Requests', path:'/pruning' },
    { label:'Events Assisted',  value: counts.events,     color: COLORS.events,     icon:'ri-calendar-event-line',sub:'Security & Medic', path:'/events-assistance' },
    { label:'Vouchers Processed',value: counts.vouchers,  color: COLORS.vouchers,   icon:'ri-file-text-line',     sub:'Financial records', path:'/vouchers' },
  ]

  // Calendar Events Stats Cards (from aggregated events) - Only unique ones, no duplicates
  const calendarStatCards = [
    { label: 'Calendar Events', value: aggregatedEvents.filter(e => e.source === 'calendar_events').length, color: EVENT_SOURCES.calendar_events.color, icon: EVENT_SOURCES.calendar_events.icon, sub: 'Scheduled Events', path: '/calendar-events' },
    { label: 'Venues', value: aggregatedEvents.filter(e => e.source === 'venues').length, color: EVENT_SOURCES.venues.color, icon: EVENT_SOURCES.venues.icon, sub: 'Facility Bookings', path: '/venues' },
    { label: 'Activities', value: aggregatedEvents.filter(e => e.source === 'activities').length, color: EVENT_SOURCES.activities.color, icon: EVENT_SOURCES.activities.icon, sub: 'Activities', path: '/activities' },
  ]

  return (
    <div>
      <style>{`
        @keyframes sk-pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
        @keyframes fadeIn { 
          from { opacity:0; transform:translateX(-50%) translateY(-8px); } 
          to { opacity:1; transform:translateX(-50%) translateY(0); } 
        }
        .dash-stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.10) !important; }
        .dash-stat-card { transition: transform .2s, box-shadow .2s; cursor: pointer; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom:'28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom: '16px' }}>
            <i className="ri-dashboard-3-line" style={{ color:'var(--primary)' }} />
            System Overview
          </h2>
          {/* Only show the tab switch when NOT logged in — logged-in users use the sidebar KloudTrack link */}
          {!user && (
            <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-app)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-light)', width: 'max-content' }}>
              <button 
                onClick={() => setActiveTab('overview')}
                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: activeTab === 'overview' ? 'var(--bg-surface)' : 'transparent', color: activeTab === 'overview' ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: '600', cursor: 'pointer', boxShadow: activeTab === 'overview' ? 'var(--shadow-sm)' : 'none', transition: 'all 0.2s' }}
              >
                <i className="ri-bar-chart-box-line" style={{ marginRight: '6px' }}></i>
                Dashboard
              </button>
              <button 
                onClick={() => setActiveTab('kloudtrack')}
                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: activeTab === 'kloudtrack' ? 'var(--bg-surface)' : 'transparent', color: activeTab === 'kloudtrack' ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: '600', cursor: 'pointer', boxShadow: activeTab === 'kloudtrack' ? 'var(--shadow-sm)' : 'none', transition: 'all 0.2s' }}
              >
                <i className="ri-cloud-windy-line" style={{ marginRight: '6px' }}></i>
                KloudTrack
              </button>
            </div>
          )}
        </div>
        {activeTab === 'overview' && (
          <button onClick={fetchAll} style={{
            display:'flex', alignItems:'center', gap:'6px',
            padding:'8px 16px', borderRadius:'8px',
            background:'var(--bg-app)', border:'1px solid var(--border-light)',
            fontSize:'13px', fontWeight:'700', cursor:'pointer', color:'var(--text-muted)'
          }}>
            <i className="ri-refresh-line" /> Refresh
          </button>
        )}
      </div>

      {activeTab === 'kloudtrack' ? (
        <div style={{ flex: 1, borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-light)', background: 'var(--bg-surface)' }}>
          <iframe 
            src="https://kloudtrack-dashboard.vercel.app/" 
            width="100%" 
            height="100%" 
            style={{ border: 'none', display: 'block', minHeight: 'calc(100vh - 140px)' }}
            title="Kloudtrack Dashboard"
          />
        </div>
      ) : (
        <>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(155px,1fr))', gap:'16px', marginBottom:'24px' }}>
        {statCards.map(({ label, value, color, icon, sub, path }) => (
          <div key={label} className={user ? "dash-stat-card" : ""} onClick={() => user && navigate(path)} style={{
            background:'var(--bg-surface)', border:'1px solid var(--border-light)',
            borderRadius:'var(--radius-lg)', padding:'20px', boxShadow:'var(--shadow-sm)',
            borderTop: `3px solid ${color}`,
            cursor: user ? 'pointer' : 'default'
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'11px', fontWeight:'700', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'6px' }}>
                  {label}
                </div>
                {loading
                  ? <div style={{ height:'32px', width:'60px', borderRadius:'6px', background:'var(--border-light)', animation:'sk-pulse 1.4s infinite' }} />
                  : <div style={{ fontSize:'30px', fontWeight:'900', color, lineHeight:1 }}>{value ?? 0}</div>
                }
                <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px' }}>{sub}</div>
              </div>
              <div style={{ width:'38px', height:'38px', borderRadius:'10px', background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className={icon} style={{ fontSize:'20px', color }} />
              </div>
            </div>
          </div>
        ))}
        
        {/* Calendar Events Stats Cards */}
        {calendarStatCards.map(({ label, value, color, icon, sub, path }) => (
          <div key={label} className={user ? "dash-stat-card" : ""} onClick={() => user && navigate(path)} style={{
            background:'var(--bg-surface)', border:'1px solid var(--border-light)',
            borderRadius:'var(--radius-lg)', padding:'20px', boxShadow:'var(--shadow-sm)',
            borderTop: `3px solid ${color}`,
            cursor: user ? 'pointer' : 'default'
          }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'11px', fontWeight:'700', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'6px' }}>
                  {label}
                </div>
                {loading
                  ? <div style={{ height:'32px', width:'60px', borderRadius:'6px', background:'var(--border-light)', animation:'sk-pulse 1.4s infinite' }} />
                  : <div style={{ fontSize:'30px', fontWeight:'900', color, lineHeight:1 }}>{value ?? 0}</div>
                }
                <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px' }}>{sub}</div>
              </div>
              <div style={{ width:'38px', height:'38px', borderRadius:'10px', background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className={icon} style={{ fontSize:'20px', color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Row: Incident Trend area chart (wide) ──────────────────────── */}
      <Card 
        title="Incident & Response Trend" 
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
        {loading ? <Skeleton h="220px" /> : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top:8, right:16, left:-20, bottom:0 }}>
              <defs>
                <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={PRIMARY} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize:12, fontWeight:600 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize:11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Incidents" stroke={PRIMARY} strokeWidth={2.5} fill="url(#incGrad)" dot={{ r:4, fill:PRIMARY, strokeWidth:0 }} activeDot={{ r:6 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* ── Full Width: Calendar Events with Week View ──────────────────────────────────── */}
      <Card title="Calendar & Events" icon="ri-calendar-event-line" style={{ marginBottom:'20px' }}>
        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
            <Skeleton h="180px" />
            <Skeleton h="200px" />
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'24px' }}>
            {/* Top: Week Calendar View - Full Width */}
            <div>
              <div style={{ marginBottom:'16px', fontSize:'13px', fontWeight:'700', color:'var(--text)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span>This Week</span>
                <span style={{ fontSize:'12px', fontWeight:'600', color:'var(--text-muted)' }}>
                  {format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'MMM dd')} - {format(endOfWeek(new Date(), { weekStartsOn: 0 }), 'MMM dd, yyyy')}
                </span>
              </div>
              
              {(() => {
                const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 })
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                
                // Check if there are any events this week from ALL sources (aggregated)
                const weekEvents = (aggregatedEvents || []).filter(e => {
                  if (!e.date) return false
                  const eventDate = new Date(e.date)
                  return eventDate >= weekStart && eventDate <= endOfWeek(new Date(), { weekStartsOn: 0 })
                })
                
                const hasWeekEvents = weekEvents.length > 0
                
                return (
                  <>
                    <div style={{ position:'relative' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:'12px' }}>
                        {days.map((dayName, idx) => {
                          const currentDate = addDays(weekStart, idx)
                          const dateStr = format(currentDate, 'yyyy-MM-dd')
                          const dayEvents = (aggregatedEvents || []).filter(e => e.date === dateStr)
                          const isCurrentDay = isToday(currentDate)
                          const isHovered = hoveredDay === dateStr
                          
                          return (
                            <div key={idx} style={{
                              background: isCurrentDay ? 'var(--primary)' : 'var(--bg-app)',
                              border: `1px solid ${isCurrentDay ? 'var(--primary)' : 'var(--border-light)'}`,
                              borderRadius:'12px', padding:'12px 8px', textAlign:'center',
                              transition:'all 0.2s', cursor: dayEvents.length > 0 ? 'pointer' : 'default',
                              position:'relative', height:'160px', width:'100%', display:'flex', flexDirection:'column', overflow:'hidden',
                              zIndex: isHovered ? 100 : 1
                            }}
                            onMouseEnter={() => { if (dayEvents.length > 0) setHoveredDay(dateStr) }}
                            onMouseLeave={() => setHoveredDay(null)}
                            >
                              <div style={{ fontSize:'11px', fontWeight:'600', color: isCurrentDay ? '#fff' : 'var(--text-muted)', marginBottom:'4px' }}>
                                {dayName}
                              </div>
                              <div style={{ fontSize:'24px', fontWeight:'800', color: isCurrentDay ? '#fff' : 'var(--text)', marginBottom:'8px' }}>
                                {format(currentDate, 'd')}
                              </div>
                              {dayEvents.length > 0 && (
                                <div style={{ display:'flex', flexDirection:'column', gap:'4px', marginTop:'auto', textAlign:'left', overflow:'hidden' }}>
                                  {dayEvents.slice(0, 3).map((evt, i) => {
                                    const sourceInfo = EVENT_SOURCES[evt.source] || EVENT_SOURCES.all
                                    return (
                                      <div key={i} style={{
                                        background: isCurrentDay ? 'rgba(255,255,255,0.2)' : '#fff',
                                        border: `1px solid ${sourceInfo.color}`,
                                        borderRadius:'4px',
                                        padding:'4px 6px',
                                        fontSize:'9px',
                                        fontWeight:'700',
                                        color: isCurrentDay ? '#fff' : 'var(--text)',
                                        overflow:'hidden',
                                        textOverflow:'ellipsis',
                                        whiteSpace:'nowrap',
                                        display:'flex',
                                        alignItems:'center',
                                        gap:'4px'
                                      }}>
                                        <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:sourceInfo.color, flexShrink:0 }} />
                                        <i className={sourceInfo.icon} style={{ fontSize:'9px', color:sourceInfo.color, flexShrink:0 }} />
                                        <span style={{ overflow:'hidden', textOverflow:'ellipsis', flex:1, minWidth:0 }}>{evt.title}</span>
                                      </div>
                                    )
                                  })}
                                  {dayEvents.length > 3 && (
                                    <div style={{ fontSize:'8px', fontWeight:'700', color: isCurrentDay ? '#fff' : 'var(--text-muted)', marginTop:'2px', textAlign:'center' }}>
                                      +{dayEvents.length - 3} more
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      
                      {/* Hover Tooltip - Positioned outside grid */}
                      {hoveredDay && (() => {
                        const dayEvents = (aggregatedEvents || []).filter(e => e.date === hoveredDay)
                        if (dayEvents.length === 0) return null
                        
                        const hoveredDate = new Date(hoveredDay)
                        const useColumns = dayEvents.length >= 4
                        
                        return (
                          <div style={{
                            position:'absolute',
                            top:'170px',
                            left:'50%',
                            transform:'translateX(-50%)',
                            background:'var(--bg-surface)',
                            border:'1px solid var(--border-light)',
                            borderRadius:'12px',
                            padding:'12px',
                            boxShadow:'0 8px 24px rgba(0,0,0,0.15)',
                            minWidth: useColumns ? '560px' : '280px',
                            maxWidth: useColumns ? '600px' : '320px',
                            zIndex:1000,
                            animation:'fadeIn 0.2s ease-in-out'
                          }}>
                            <div style={{ fontSize:'12px', fontWeight:'800', marginBottom:'10px', color:'var(--text)', borderBottom:'1px solid var(--border-light)', paddingBottom:'8px' }}>
                              {format(hoveredDate, 'EEEE, MMM dd, yyyy')}
                            </div>
                            <div style={{ 
                              display: useColumns ? 'grid' : 'flex',
                              gridTemplateColumns: useColumns ? 'repeat(2, 1fr)' : undefined,
                              flexDirection: useColumns ? undefined : 'column',
                              gap:'8px', 
                              maxHeight:'300px', 
                              overflowY:'auto' 
                            }}>
                              {dayEvents.map((evt, i) => {
                                const sourceInfo = EVENT_SOURCES[evt.source] || EVENT_SOURCES.all
                                const statusOrType = getEventStatusOrType(evt)
                                const statusStyle = getStatusTypeStyle(statusOrType, evt.source)
                                
                                return (
                                  <div key={i} style={{
                                    padding:'8px',
                                    background:'var(--bg-app)',
                                    borderLeft:`3px solid ${sourceInfo.color}`,
                                    borderRadius:'6px',
                                    fontSize:'11px'
                                  }}>
                                    <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' }}>
                                      <i className={sourceInfo.icon} style={{ fontSize:'14px', color:sourceInfo.color }} />
                                      <span style={{ fontSize:'9px', fontWeight:'700', color:sourceInfo.color, textTransform:'uppercase', letterSpacing:'0.5px' }}>
                                        {sourceInfo.label}
                                      </span>
                                    </div>
                                    <div style={{ fontWeight:'700', marginBottom:'4px', color:'var(--text)', fontSize:'12px' }}>
                                      {evt.title}
                                    </div>
                                    {statusOrType !== '—' && (
                                      <div style={{ display:'flex', alignItems:'center', gap:'4px', marginTop:'6px' }}>
                                        <span style={{
                                          display:'inline-flex',
                                          alignItems:'center',
                                          gap:'4px',
                                          padding:'3px 8px',
                                          borderRadius:'8px',
                                          fontSize:'9px',
                                          fontWeight:'700',
                                          background:statusStyle.bg,
                                          color:statusStyle.color,
                                          border:`1px solid ${statusStyle.color}30`
                                        }}>
                                          <i className={statusStyle.icon} style={{ fontSize:'9px' }} />
                                          {statusOrType}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                    
                    {!hasWeekEvents && (
                      <div style={{ textAlign:'center', padding:'24px 0', marginTop:'12px' }}>
                        <div style={{ fontSize:'13px', fontWeight:'600', color:'var(--text-muted)' }}>
                          <i className="ri-calendar-line" style={{ marginRight:'6px' }} />
                          No events or activities scheduled for this week
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

            {/* Bottom: Recent 5 Events List - Full Width */}
            <div>
              <div style={{ marginBottom:'16px', fontSize:'13px', fontWeight:'700', color:'var(--text)' }}>
                Recent Events & Activities
              </div>
              {(recentAggregatedEvents || []).length === 0 ? (
                <div style={{ textAlign:'center', padding:'32px 0', background:'var(--bg-app)', borderRadius:'12px', border:'1px solid var(--border-light)' }}>
                  <i className="ri-calendar-event-line" style={{ fontSize:'32px', display:'block', marginBottom:'8px', opacity:0.3, color:'var(--text-muted)' }} />
                  <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>No recent events</div>
                </div>
              ) : (
                <div className="data-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Event / Activity</th>
                        <th>Source</th>
                        <th>Date</th>
                        <th>Status / Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(recentAggregatedEvents || []).map((event, i) => {
                        const sourceInfo = EVENT_SOURCES[event.source] || EVENT_SOURCES.all
                        const dateDisplay = event.date ? format(new Date(event.date), 'MMM dd, yyyy') : '—'
                        const statusOrType = getEventStatusOrType(event)
                        const statusStyle = getStatusTypeStyle(statusOrType, event.source)
                        
                        return (
                          <tr key={i} style={{ height: '49px' }}>
                            <td style={{ fontWeight: '700' }}>
                              {event.title || '—'}
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
                                  background: statusStyle.bg,
                                  color: statusStyle.color,
                                  border: `1px solid ${statusStyle.color}30`,
                                  whiteSpace: 'nowrap'
                                }}>
                                  <i className={statusStyle.icon}></i>
                                  {statusOrType}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* ── Row: Personnel & Incidents ────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'20px' }}>
        <Card title="Personnel Duty Status" icon="ri-team-line">
          {loading ? <Skeleton /> : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={empStatusData} margin={{ top:4, right:8, left:-24, bottom:0 }} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize:11, fontWeight:600 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize:11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Personnel" radius={[6,6,0,0]}>
                    {empStatusData.map((_, i) => <Cell key={i} fill={DUTY_PALETTE[i % DUTY_PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <LegendPills items={empStatusData.map((d, i) => ({ name:d.name, value:d.value, color:DUTY_PALETTE[i] }))} />
            </>
          )}
        </Card>

        <Card title="Incidents by Team" icon="ri-alarm-warning-line">
          {loading ? <Skeleton /> : counts.incidents === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>
              <i className="ri-alarm-warning-line" style={{ fontSize:'36px', display:'block', marginBottom:'8px', opacity:0.4 }} />
              No incident data yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:'14px', marginTop:'4px' }}>
                {(() => {
                  const max = Math.max(...incTeamData.map(d => d.value), 1)
                  return incTeamData.map(({ name, value, fill }) => (
                    <div key={name}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                        <span style={{ fontSize:'13px', fontWeight:'700', color:'var(--text)', display:'flex', alignItems:'center', gap:'7px' }}>
                          <span style={{ width:'10px', height:'10px', borderRadius:'50%', background:fill, display:'inline-block', flexShrink:0 }} />
                          {name === 'Others' ? 'Others' : `Team ${name}`}
                        </span>
                        <span style={{ fontSize:'13px', fontWeight:'800', color:fill }}>{value}</span>
                      </div>
                      <div style={{ height:'10px', borderRadius:'999px', background:'var(--border-light)', overflow:'hidden' }}>
                        <div style={{
                          height:'100%', borderRadius:'999px',
                          width:`${(value / max) * 100}%`,
                          background:fill,
                          transition:'width 0.6s ease'
                        }} />
                      </div>
                    </div>
                  ))
                })()}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Row: Finances & Non-Emergency Services ────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:'20px', marginBottom:'20px' }}>
        
        {/* Voucher BarChart */}
        <Card title="Financial Disbursements (Vouchers)" icon="ri-bank-card-line">
          {loading ? <Skeleton /> : voucherData.length === 0 ? (
             <div style={{ textAlign:'center', padding:'40px 0', color:'var(--text-muted)' }}>
               No voucher data yet.
             </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={voucherData} margin={{ top:4, right:8, left:-10, bottom:0 }} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize:11, fontWeight:600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:11 }} tickFormatter={(val) => val >= 1000 ? (val/1000).toFixed(0)+'k' : val} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Bar dataKey="amount" name="Amount (PHP)" fill={VOUCHER_COLOR} radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        
        {/* Assistance Distribution PieChart */}
        <Card title="Service Request Types" icon="ri-pie-chart-2-line">
          {loading ? <Skeleton /> : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={assistData.some(d => d.value > 0) ? assistData : [{ name:'No data', value:1 }]}
                    cx="50%" cy="50%"
                    innerRadius={42} outerRadius={75}
                    paddingAngle={3} dataKey="value"
                    labelLine={false} label={renderPieLabel}
                  >
                    {assistData.some(d => d.value > 0)
                      ? assistData.map((_, i) => <Cell key={i} fill={ASSIST_PALETTE[i % ASSIST_PALETTE.length]} />)
                      : <Cell fill="var(--border-light)" />
                    }
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <LegendPills items={assistData.map((d, i) => ({ name:d.name, value:d.value, color:ASSIST_PALETTE[i] }))} />
            </>
          )}
        </Card>
      </div>

      {/* ── Row: Feeds ────────────────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>
        
        {/* Recent Emergencies */}
        <Card title="Recent Emergencies" icon="ri-alarm-warning-line">
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {[1,2,3].map(i => <Skeleton key={i} h="64px" />)}
            </div>
          ) : recentInc.length === 0 ? (
            <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text-muted)' }}>
              No emergencies on record.
            </div>
          ) : (
            recentInc.map((inc, i) => {
              const teamColor = TEAM_PALETTE[inc.team] || TEAM_PALETTE.Unknown
              return (
                <div key={inc.record_id || i} style={{
                  display:'flex', alignItems:'flex-start', gap:'14px',
                  padding:'14px 0', borderBottom: i < recentInc.length - 1 ? '1px solid var(--border-light)' : 'none'
                }}>
                  <div style={{
                    width:'40px', height:'40px', borderRadius:'10px', flexShrink:0,
                    background:'#fee2e2', color:'#dc2626', display:'flex', alignItems:'center', justifyContent:'center', marginTop:'1px'
                  }}>
                    <i className="ri-alarm-warning-fill" style={{ fontSize:'18px' }} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'5px', flexWrap:'wrap' }}>
                      <span style={{ fontWeight:'700', fontSize:'14px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {inc.nature_of_incident || 'Emergency'}
                      </span>
                    </div>
                    <div style={{ display:'flex', gap:'14px', flexWrap:'wrap', alignItems:'center', fontSize:'12px', color:'var(--text-muted)' }}>
                      {inc.place_of_incident && (
                        <span style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                          <i className="ri-map-pin-2-fill" style={{ color:'#dc2626', fontSize:'13px' }} />
                          {inc.place_of_incident}
                        </span>
                      )}
                      {inc.date && (
                        <span style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                          <i className="ri-calendar-line" style={{ fontSize:'13px' }} />
                          {format(new Date(inc.date), 'MMM dd')}
                        </span>
                      )}
                    </div>
                  </div>
                  {inc.team && (
                    <span style={{
                      padding:'3px 11px', borderRadius:'10px', fontSize:'11px', fontWeight:'800',
                      background:`${teamColor}18`, color:teamColor, border:`1px solid ${teamColor}40`, flexShrink:0
                    }}>
                      {inc.team}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </Card>

        {/* Recent Services */}
        <Card title="Recent Service Requests" icon="ri-customer-service-2-line">
          {loading ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {[1,2,3].map(i => <Skeleton key={i} h="64px" />)}
            </div>
          ) : recentReq.length === 0 ? (
            <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text-muted)' }}>
              No service requests on record.
            </div>
          ) : (
            recentReq.map((req, i) => {
              return (
                <div key={i} style={{
                  display:'flex', alignItems:'flex-start', gap:'14px',
                  padding:'14px 0', borderBottom: i < recentReq.length - 1 ? '1px solid var(--border-light)' : 'none'
                }}>
                  <div style={{
                    width:'40px', height:'40px', borderRadius:'10px', flexShrink:0,
                    background:'var(--bg-app)', color:'var(--primary)', display:'flex', alignItems:'center', justifyContent:'center', marginTop:'1px', border: '1px solid var(--border-light)'
                  }}>
                    <i className={req.icon} style={{ fontSize:'18px' }} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'5px', flexWrap:'wrap' }}>
                      <span style={{ fontWeight:'700', fontSize:'14px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {req.title}
                      </span>
                    </div>
                    <div style={{ display:'flex', gap:'14px', flexWrap:'wrap', alignItems:'center', fontSize:'12px', color:'var(--text-muted)' }}>
                      {req.location && (
                        <span style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                          <i className="ri-map-pin-2-fill" style={{ color:'var(--primary)', fontSize:'13px' }} />
                          {req.location}
                        </span>
                      )}
                      {req.date && (
                        <span style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                          <i className="ri-calendar-line" style={{ fontSize:'13px' }} />
                          {format(new Date(req.date), 'MMM dd')}
                        </span>
                      )}
                    </div>
                  </div>
                  <span style={{
                    padding:'3px 11px', borderRadius:'10px', fontSize:'11px', fontWeight:'800',
                    background:'var(--bg-app)', color:'var(--text-main)', border:'1px solid var(--border-light)', flexShrink:0
                  }}>
                    {req.type}
                  </span>
                </div>
              )
            })
          )}
        </Card>

      </div>
      </>
      )}
    </div>
  )
}
