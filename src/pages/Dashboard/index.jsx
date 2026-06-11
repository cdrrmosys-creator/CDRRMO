import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, Tooltip as PieTooltip,
  AreaChart, Area,
} from 'recharts'

// ── Design tokens ────────────────────────────────────────────────────────────
const PRIMARY   = '#dc2626'
const COLORS    = {
  employees : '#dc2626',
  incidents : '#ea580c',
  vehicles  : '#0891b2',
  volunteers: '#16a34a',
  inventory : '#7c3aed',
  drivers   : '#b45309',
}

const SEVERITY_PALETTE = ['#16a34a','#d97706','#ea580c','#dc2626']
const DUTY_PALETTE     = ['#16a34a','#dc2626','#2563eb','#d97706']
const VEH_PALETTE      = ['#16a34a','#d97706','#dc2626','#6b7280']
const VOL_PALETTE      = ['#16a34a','#dc2626','#6b7280']
const INV_PALETTE      = ['#16a34a','#d97706','#dc2626','#6b7280']

// ── Helpers ───────────────────────────────────────────────────────────────────
function groupBy(arr, key) {
  return (arr || []).reduce((acc, item) => {
    const k = item[key] ?? 'Unknown'
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})
}

// ── Shared card ───────────────────────────────────────────────────────────────
function Card({ title, icon, children, style = {} }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius-lg)',
      padding: '24px',
      boxShadow: 'var(--shadow-sm)',
      ...style
    }}>
      {title && (
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'20px' }}>
          {icon && <i className={icon} style={{ fontSize:'18px', color:'var(--primary)' }} />}
          <span style={{ fontSize:'14px', fontWeight:'800', letterSpacing:'-0.2px' }}>{title}</span>
        </div>
      )}
      {children}
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
          <span style={{ fontWeight:'700', color:'var(--text)' }}>{p.value}</span>
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
  const [loading, setLoading]         = useState(true)
  const [counts, setCounts]           = useState({})
  const [empStatusData, setEmpStatus] = useState([])
  const [incSevData, setIncSev]       = useState([])
  const [vehStatusData, setVehStatus] = useState([])
  const [volStatusData, setVolStatus] = useState([])
  const [invCondData, setInvCond]     = useState([])
  const [monthlyInc, setMonthlyInc]   = useState([])
  const [recentInc, setRecentInc]     = useState([])

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      // ── Counts ──────────────────────────────────────────────────────────────
      const [empC, incC, vehC, volC, invC, drvC] = await Promise.all([
        supabase.from('employees').select('id', { count:'exact', head:true }),
        supabase.from('incidents').select('id', { count:'exact', head:true }),
        supabase.from('vehicles').select('id', { count:'exact', head:true }),
        supabase.from('volunteers').select('id', { count:'exact', head:true }),
        supabase.from('inventory').select('id', { count:'exact', head:true }),
        supabase.from('drivers').select('id', { count:'exact', head:true }),
      ])
      setCounts({
        employees: empC.count ?? 0, incidents: incC.count ?? 0,
        vehicles: vehC.count ?? 0,  volunteers: volC.count ?? 0,
        inventory: invC.count ?? 0, drivers: drvC.count ?? 0,
      })

      // ── Breakdown data ───────────────────────────────────────────────────────
      const [empD, incD, vehD, volD, invD] = await Promise.all([
        supabase.from('employees').select('duty_status'),
        supabase.from('incidents').select('severity, incident_type, date_time, location, record_id').order('date_time', { ascending:false }),
        supabase.from('vehicles').select('status'),
        supabase.from('volunteers').select('status'),
        supabase.from('inventory').select('condition'),
      ])

      // Employee duty status
      const eg = groupBy(empD.data, 'duty_status')
      setEmpStatus([
        { name:'On Duty',  value: eg['On Duty']  || 0 },
        { name:'Off Duty', value: eg['Off Duty'] || 0 },
        { name:'Standby',  value: eg['Standby']  || 0 },
        { name:'On Leave', value: eg['On Leave'] || 0 },
      ])

      // Incident severity
      const ig = groupBy(incD.data, 'severity')
      setIncSev([
        { name:'Low',      value: ig['Low']      || 0 },
        { name:'Medium',   value: ig['Medium']   || 0 },
        { name:'High',     value: ig['High']     || 0 },
        { name:'Critical', value: ig['Critical'] || 0 },
      ])

      // Recent incidents
      setRecentInc((incD.data || []).slice(0, 5))

      // Monthly incidents (last 6 months)
      const now = new Date()
      const months = Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(now, 5 - i)
        return {
          month: format(d, 'MMM'),
          start: startOfMonth(d).toISOString(),
          end:   endOfMonth(d).toISOString(),
          count: 0
        }
      });
      (incD.data || []).forEach(inc => {
        if (!inc.date_time) return
        const dt = new Date(inc.date_time)
        months.forEach(m => {
          if (dt >= new Date(m.start) && dt <= new Date(m.end)) m.count++
        })
      })
      setMonthlyInc(months.map(m => ({ month: m.month, Incidents: m.count })))

      // Vehicle status
      const vg = groupBy(vehD.data, 'status')
      setVehStatus([
        { name:'Available',   value: vg['Available']   || 0 },
        { name:'In Use',      value: vg['In Use']      || 0 },
        { name:'Maintenance', value: vg['Maintenance'] || 0 },
        { name:'Unavailable', value: vg['Unavailable'] || 0 },
      ])

      // Volunteer status
      const og = groupBy(volD.data, 'status')
      setVolStatus([
        { name:'Active',   value: og['Active']   || 0 },
        { name:'Inactive', value: og['Inactive'] || 0 },
        { name:'Expired',  value: og['Expired']  || 0 },
      ])

      // Inventory condition
      const nc = groupBy(invD.data, 'condition')
      setInvCond([
        { name:'Good',      value: nc['Good']      || 0 },
        { name:'Fair',      value: nc['Fair']      || 0 },
        { name:'Poor',      value: nc['Poor']      || 0 },
        { name:'Condemned', value: nc['Condemned'] || 0 },
      ])
    } catch (err) {
      console.error('Dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  // ── Severity badge ──────────────────────────────────────────────────────────
  const SEV = {
    Low:      { bg:'#d1fae5', color:'#065f46' },
    Medium:   { bg:'#fef3c7', color:'92400e' },
    High:     { bg:'#fed7aa', color:'#9a3412' },
    Critical: { bg:'#fee2e2', color:'#991b1b' },
  }

  // Stats grid data
  const statCards = [
    { label:'Total Employees', value: counts.employees, color: COLORS.employees, icon:'ri-team-line',            sub:'Personnel on record', path:'/employees' },
    { label:'Total Incidents',  value: counts.incidents,  color: COLORS.incidents,  icon:'ri-alarm-warning-line', sub:'Reported incidents', path:'/incidents' },
    { label:'Vehicles',         value: counts.vehicles,   color: COLORS.vehicles,   icon:'ri-truck-line',         sub:'Fleet size', path:'/vehicles' },
    { label:'Volunteers',       value: counts.volunteers, color: COLORS.volunteers, icon:'ri-user-star-line',     sub:'Registered volunteers', path:'/volunteers' },
    { label:'Inventory Items',  value: counts.inventory,  color: COLORS.inventory,  icon:'ri-archive-drawer-line',sub:'Items tracked', path:'/inventory' },
    { label:'Drivers',          value: counts.drivers,    color: COLORS.drivers,    icon:'ri-steering-2-line',    sub:'Registered drivers', path:'/drivers' },
  ]

  return (
    <div>
      <style>{`
        @keyframes sk-pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
        .dash-stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.10) !important; }
        .dash-stat-card { transition: transform .2s, box-shadow .2s; cursor: pointer; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom:'28px' }}>
        <h2 style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <i className="ri-dashboard-3-line" style={{ color:'var(--primary)' }} />
          Dashboard
        </h2>
        <button onClick={fetchAll} style={{
          display:'flex', alignItems:'center', gap:'6px',
          padding:'8px 16px', borderRadius:'8px',
          background:'var(--bg-app)', border:'1px solid var(--border-light)',
          fontSize:'13px', fontWeight:'700', cursor:'pointer', color:'var(--text-muted)'
        }}>
          <i className="ri-refresh-line" /> Refresh
        </button>
      </div>



      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(155px,1fr))', gap:'16px', marginBottom:'24px' }}>
        {statCards.map(({ label, value, color, icon, sub, path }) => (
          <div key={label} className="dash-stat-card" onClick={() => navigate(path)} style={{
            background:'var(--bg-surface)', border:'1px solid var(--border-light)',
            borderRadius:'var(--radius-lg)', padding:'20px', boxShadow:'var(--shadow-sm)',
            borderTop: `3px solid ${color}`
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

      {/* ── Row: Monthly Incidents area chart (wide) ──────────────────────── */}
      <Card title="Incident Trend — Last 6 Months" icon="ri-line-chart-line" style={{ marginBottom:'20px' }}>
        {loading ? <Skeleton h="220px" /> : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyInc} margin={{ top:8, right:16, left:-20, bottom:0 }}>
              <defs>
                <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={PRIMARY} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize:12, fontWeight:600 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize:11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Incidents" stroke={PRIMARY} strokeWidth={2.5} fill="url(#incGrad)" dot={{ r:4, fill:PRIMARY, strokeWidth:0 }} activeDot={{ r:6 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* ── Row: Employee status bar + Incident severity pie ─────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'20px' }}>

        {/* Employee Duty Status — vertical bar */}
        <Card title="Employee Duty Status" icon="ri-team-line">
          {loading ? <Skeleton /> : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={empStatusData} margin={{ top:4, right:8, left:-24, bottom:0 }} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize:11, fontWeight:600 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize:11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Employees" radius={[6,6,0,0]}>
                    {empStatusData.map((_, i) => <Cell key={i} fill={DUTY_PALETTE[i % DUTY_PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <LegendPills items={empStatusData.map((d, i) => ({ name:d.name, value:d.value, color:DUTY_PALETTE[i] }))} />
            </>
          )}
        </Card>

        {/* Incident Severity — donut pie */}
        <Card title="Incidents by Severity" icon="ri-alarm-warning-line">
          {loading ? <Skeleton /> : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={incSevData.some(d => d.value > 0) ? incSevData : [{ name:'No data', value:1 }]}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    labelLine={false}
                    label={renderPieLabel}
                  >
                    {incSevData.some(d => d.value > 0)
                      ? incSevData.map((_, i) => <Cell key={i} fill={SEVERITY_PALETTE[i % SEVERITY_PALETTE.length]} />)
                      : <Cell fill="var(--border-light)" />
                    }
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <LegendPills items={incSevData.map((d, i) => ({ name:d.name, value:d.value, color:SEVERITY_PALETTE[i] }))} />
            </>
          )}
        </Card>
      </div>

      {/* ── Row: Vehicle status + Volunteer status + Inventory condition ───── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'20px', marginBottom:'20px' }}>

        {/* Vehicle Fleet — pie */}
        <Card title="Fleet Status" icon="ri-truck-line">
          {loading ? <Skeleton /> : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={vehStatusData.some(d => d.value > 0) ? vehStatusData : [{ name:'No data', value:1 }]}
                    cx="50%" cy="50%"
                    innerRadius={42} outerRadius={70}
                    paddingAngle={3} dataKey="value"
                    labelLine={false} label={renderPieLabel}
                  >
                    {vehStatusData.some(d => d.value > 0)
                      ? vehStatusData.map((_, i) => <Cell key={i} fill={VEH_PALETTE[i % VEH_PALETTE.length]} />)
                      : <Cell fill="var(--border-light)" />
                    }
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <LegendPills items={vehStatusData.map((d, i) => ({ name:d.name, value:d.value, color:VEH_PALETTE[i] }))} />
            </>
          )}
        </Card>

        {/* Volunteer Status — pie */}
        <Card title="Volunteer Status" icon="ri-user-star-line">
          {loading ? <Skeleton /> : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={volStatusData.some(d => d.value > 0) ? volStatusData : [{ name:'No data', value:1 }]}
                    cx="50%" cy="50%"
                    innerRadius={42} outerRadius={70}
                    paddingAngle={3} dataKey="value"
                    labelLine={false} label={renderPieLabel}
                  >
                    {volStatusData.some(d => d.value > 0)
                      ? volStatusData.map((_, i) => <Cell key={i} fill={VOL_PALETTE[i % VOL_PALETTE.length]} />)
                      : <Cell fill="var(--border-light)" />
                    }
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <LegendPills items={volStatusData.map((d, i) => ({ name:d.name, value:d.value, color:VOL_PALETTE[i] }))} />
            </>
          )}
        </Card>

        {/* Inventory Condition — bar */}
        <Card title="Inventory Condition" icon="ri-archive-drawer-line">
          {loading ? <Skeleton /> : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={invCondData} margin={{ top:4, right:4, left:-28, bottom:0 }} barSize={26}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize:10, fontWeight:600 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize:10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" name="Items" radius={[5,5,0,0]}>
                    {invCondData.map((_, i) => <Cell key={i} fill={INV_PALETTE[i % INV_PALETTE.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <LegendPills items={invCondData.map((d, i) => ({ name:d.name, value:d.value, color:INV_PALETTE[i] }))} />
            </>
          )}
        </Card>
      </div>

      {/* ── Recent Incidents feed ────────────────────────────────────────────── */}
      <Card title="Recent Incidents" icon="ri-history-line">
        {loading ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {[1,2,3].map(i => <Skeleton key={i} h="52px" />)}
          </div>
        ) : recentInc.length === 0 ? (
          <div style={{ textAlign:'center', padding:'32px 0', color:'var(--text-muted)' }}>
            <i className="ri-alarm-warning-line" style={{ fontSize:'40px', display:'block', marginBottom:'8px' }} />
            No incidents on record yet.
          </div>
        ) : (
          recentInc.map((inc, i) => {
            const sev = SEV[inc.severity] || SEV['Medium']
            return (
              <div key={inc.record_id || i} style={{
                display:'flex', alignItems:'center', gap:'16px',
                padding:'12px 0',
                borderBottom: i < recentInc.length - 1 ? '1px solid var(--border-light)' : 'none'
              }}>
                <div style={{
                  width:'38px', height:'38px', borderRadius:'10px', flexShrink:0,
                  background: sev.bg, color: sev.color,
                  display:'flex', alignItems:'center', justifyContent:'center'
                }}>
                  <i className="ri-alarm-warning-fill" style={{ fontSize:'18px' }} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:'700', fontSize:'14px', marginBottom:'2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {inc.incident_type || 'Unknown Incident'}
                  </div>
                  <div style={{ fontSize:'12px', color:'var(--text-muted)', display:'flex', gap:'12px', flexWrap:'wrap' }}>
                    {inc.location && <span><i className="ri-map-pin-line" /> {inc.location}</span>}
                    {inc.date_time && <span><i className="ri-time-line" /> {format(new Date(inc.date_time), 'MMM dd, yyyy · hh:mm a')}</span>}
                  </div>
                </div>
                <span style={{
                  padding:'3px 10px', borderRadius:'10px', fontSize:'11px', fontWeight:'700', flexShrink:0,
                  background: sev.bg, color: sev.color
                }}>{inc.severity || 'N/A'}</span>
              </div>
            )
          })
        )}
      </Card>
    </div>
  )
}
