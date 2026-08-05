import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../services/supabase'
import { logAudit } from '../../services/audit'
import { format, getDaysInMonth } from 'date-fns'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'
import { SHIFT_TYPES } from '../Attendance'

// ─── Color palette for duty groups ───────────────────────────────────────────
const GROUP_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
  '#84cc16', '#6366f1'
]

const SCHEDULE_TYPES = [
  { value: 'WEEKDAY_ONLY', label: 'Weekday Only (Mon–Fri)', icon: 'ri-sun-line' },
  { value: 'ALL_WEEK',     label: 'All Week (Mon–Sun)',     icon: 'ri-calendar-2-line' },
]

// Derive SHIFT_OPTIONS from the canonical SHIFT_TYPES so times are always consistent.
// Only include shift types that can be assigned to a whole duty group (exclude LEAVE/ABSENT).
const SHIFT_OPTIONS = SHIFT_TYPES
  .filter(s => !['LEAVE', 'ABSENT'].includes(s.code))
  .map(s => ({ code: s.code, label: s.label, short: s.short, color: s.color, bg: s.bg }))

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getShiftOption = (code) => SHIFT_OPTIONS.find(s => s.code === code) || SHIFT_OPTIONS[0]

// Custom Shift Selector Pill Dropdown (Viewport Fixed to avoid container clipping)
function ShiftSelectPill({ value, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, minWidth: 290 })
  const buttonRef = useRef(null)
  const current = SHIFT_OPTIONS.find(s => s.code === value) || null

  const handleToggle = () => {
    if (disabled) return
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const openUpwards = spaceBelow < 230
      setCoords({
        top: openUpwards ? Math.max(10, rect.top - 225) : rect.bottom + 6,
        left: rect.left,
        minWidth: Math.max(290, rect.width)
      })
    }
    setIsOpen(!isOpen)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '7px 14px',
          borderRadius: '8px',
          border: current ? `1px solid ${current.color}44` : '1px dashed var(--border-light)',
          background: current ? current.bg : 'var(--bg-app)',
          color: current ? current.color : 'var(--text-muted)',
          fontWeight: '700',
          fontSize: '12.5px',
          cursor: disabled ? 'default' : 'pointer',
          transition: 'all 0.15s',
          boxShadow: isOpen ? '0 0 0 2px var(--primary-bg)' : 'none'
        }}
      >
        {current ? (
          <>
            <span style={{
              padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '800',
              background: '#fff', color: current.color, boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>{current.short}</span>
            <span>{current.label}</span>
          </>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>— Select Shift Assignment —</span>
        )}
        {!disabled && <i className={`ri-arrow-${isOpen ? 'up' : 'down'}-s-line`} style={{ marginLeft: '4px', opacity: 0.7 }} />}
      </button>

      {isOpen && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setIsOpen(false)} />
          <div style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            minWidth: `${coords.minWidth}px`,
            zIndex: 9999,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-lg)',
            padding: '6px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            {SHIFT_OPTIONS.map(s => {
              const isSelected = value === s.code
              return (
                <div
                  key={s.code}
                  onClick={() => { onChange(s.code); setIsOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                    background: isSelected ? s.bg : 'transparent',
                    color: isSelected ? s.color : 'var(--text-primary)',
                    fontWeight: isSelected ? '800' : '600',
                    fontSize: '12px', transition: 'all 0.1s'
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-app)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      padding: '2px 7px', borderRadius: '5px', fontSize: '10px', fontWeight: '800',
                      background: s.bg, color: s.color, border: `1px solid ${s.color}33`
                    }}>{s.short}</span>
                    <span>{s.label}</span>
                  </div>
                  {isSelected && <i className="ri-check-line" style={{ fontWeight: '800', color: s.color }} />}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default function DutyRoster() {
  const isAdmin = useIsAdmin()
  const { permissions } = usePermissions('duty_roster')
  const { toast } = useToast()
  const confirm = useConfirm()

  // ── Data state ──────────────────────────────────────────────────────────────
  const [dutyGroups, setDutyGroups] = useState([])
  const [groupMembers, setGroupMembers] = useState([])   // { id, group_id, employee_id, schedule_type }
  const [shiftRosters, setShiftRosters] = useState([])   // { id, group_id, year, month, cutoff_period, shift_type }
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // ── Period selectors ────────────────────────────────────────────────────────
  const today = new Date()
  const [selectedYear, setSelectedYear]   = useState(today.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth())
  const [cutoffPeriod, setCutoffPeriod]   = useState('1st')

  // ── UI state ────────────────────────────────────────────────────────────────
  const [selectedGroupId, setSelectedGroupId] = useState(null)
  const [isGroupModalOpen, setIsGroupModalOpen]   = useState(false)
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false)
  const [isApplyModalOpen, setIsApplyModalOpen]   = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)

  const [groupForm, setGroupForm] = useState({ name: '', color: GROUP_COLORS[0], description: '' })
  const [memberSearch, setMemberSearch] = useState('')
  const [pendingMembers, setPendingMembers] = useState([]) // employees being added with their schedule_type

  // ─── Load data ──────────────────────────────────────────────────────────────
  const loadData = async () => {
    try {
      setLoading(true)
      const [grpRes, memRes, rosterRes, empRes] = await Promise.all([
        supabase.from('duty_groups').select('*').order('name'),
        supabase.from('duty_group_members').select('*'),
        supabase.from('shift_rosters').select('*'),
        supabase.from('employees').select('employee_id, id, name, designation, office, duty_status').order('name'),
      ])
      if (grpRes.data)    setDutyGroups(grpRes.data)
      if (memRes.data)    setGroupMembers(memRes.data)
      if (rosterRes.data) setShiftRosters(rosterRes.data)
      if (empRes.data)    setEmployees(empRes.data)
    } catch (err) {
      toast.error('Failed to load roster data: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // ─── Derived ─────────────────────────────────────────────────────────────────
  const selectedGroup = useMemo(() =>
    dutyGroups.find(g => g.id === selectedGroupId) || null,
    [dutyGroups, selectedGroupId]
  )

  const membersOfSelectedGroup = useMemo(() =>
    groupMembers.filter(m => m.group_id === selectedGroupId),
    [groupMembers, selectedGroupId]
  )

  // Current period's roster assignments: { [group_id]: shift_type }
  const currentRosterMap = useMemo(() => {
    const map = {}
    shiftRosters
      .filter(r => r.year === selectedYear && r.month === selectedMonth && r.cutoff_period === cutoffPeriod)
      .forEach(r => { map[r.group_id] = r.shift_type })
    return map
  }, [shiftRosters, selectedYear, selectedMonth, cutoffPeriod])

  // Employees NOT yet in ANY group (for adding members)
  const assignedEmployeeIds = useMemo(() => new Set(groupMembers.map(m => m.employee_id)), [groupMembers])

  const unassignedEmployees = useMemo(() =>
    employees.filter(e => {
      const eid = e.employee_id || e.id
      return !assignedEmployeeIds.has(eid)
    }),
    [employees, assignedEmployeeIds]
  )

  // Employees in selected group enriched with employee data
  const enrichedMembers = useMemo(() =>
    membersOfSelectedGroup.map(m => {
      const emp = employees.find(e => (e.employee_id || e.id) === m.employee_id)
      return { ...m, emp }
    }),
    [membersOfSelectedGroup, employees]
  )

  // ─── Group CRUD ──────────────────────────────────────────────────────────────
  const openNewGroupModal = () => {
    setEditingGroup(null)
    setGroupForm({ name: '', color: GROUP_COLORS[dutyGroups.length % GROUP_COLORS.length], description: '' })
    setIsGroupModalOpen(true)
  }

  const openEditGroupModal = (group) => {
    setEditingGroup(group)
    setGroupForm({ name: group.name, color: group.color, description: group.description || '' })
    setIsGroupModalOpen(true)
  }

  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) { toast.error('Group name is required'); return }
    setIsSaving(true)
    try {
      if (editingGroup) {
        const { error } = await supabase.from('duty_groups')
          .update({ name: groupForm.name, color: groupForm.color, description: groupForm.description })
          .eq('id', editingGroup.id)
        if (error) throw error
        setDutyGroups(prev => prev.map(g => g.id === editingGroup.id ? { ...g, ...groupForm } : g))
        await logAudit('Updated', 'Duty Group', editingGroup.id, `Updated group: ${groupForm.name}`)
        toast.success(`Group "${groupForm.name}" updated!`)
      } else {
        const { data, error } = await supabase.from('duty_groups')
          .insert([{ name: groupForm.name, color: groupForm.color, description: groupForm.description }])
          .select()
        if (error) throw error
        setDutyGroups(prev => [...prev, data[0]])
        await logAudit('Created', 'Duty Group', data[0].id, `Created group: ${groupForm.name}`)
        toast.success(`Group "${groupForm.name}" created!`)
      }
      setIsGroupModalOpen(false)
    } catch (err) {
      toast.error('Failed to save group: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteGroup = async (group) => {
    const ok = await confirm(`Are you sure you want to delete group "${group.name}"? This will remove all member assignments and roster entries for this group.`, {
      title: 'Delete Duty Group',
      confirmText: 'Delete Group',
      variant: 'danger',
      icon: 'ri-delete-bin-line'
    })
    if (!ok) return
    try {
      await supabase.from('duty_groups').delete().eq('id', group.id)
      setDutyGroups(prev => prev.filter(g => g.id !== group.id))
      setGroupMembers(prev => prev.filter(m => m.group_id !== group.id))
      setShiftRosters(prev => prev.filter(r => r.group_id !== group.id))
      if (selectedGroupId === group.id) setSelectedGroupId(null)
      toast.success(`Group "${group.name}" deleted.`)
    } catch (err) {
      toast.error('Failed to delete group: ' + err.message)
    }
  }

  // ─── Member management ───────────────────────────────────────────────────────
  const openMemberModal = () => {
    setPendingMembers([])
    setMemberSearch('')
    setIsMemberModalOpen(true)
  }

  const togglePendingMember = (emp) => {
    const eid = emp.employee_id || emp.id
    setPendingMembers(prev => {
      const exists = prev.find(m => m.employee_id === eid)
      if (exists) return prev.filter(m => m.employee_id !== eid)
      return [...prev, { employee_id: eid, schedule_type: 'WEEKDAY_ONLY', emp }]
    })
  }

  const updatePendingScheduleType = (eid, schedType) => {
    setPendingMembers(prev => prev.map(m => m.employee_id === eid ? { ...m, schedule_type: schedType } : m))
  }

  const handleAddMembers = async () => {
    if (pendingMembers.length === 0) { toast.error('No employees selected'); return }
    setIsSaving(true)
    try {
      const inserts = pendingMembers.map(m => ({
        group_id: selectedGroupId,
        employee_id: m.employee_id,
        schedule_type: m.schedule_type
      }))
      const { data, error } = await supabase.from('duty_group_members').insert(inserts).select()
      if (error) throw error
      setGroupMembers(prev => [...prev, ...data])
      await logAudit('Updated', 'Duty Group', selectedGroupId, `Added ${data.length} members to ${selectedGroup?.name}`)
      toast.success(`Added ${data.length} member(s) to ${selectedGroup?.name}!`)
      setIsMemberModalOpen(false)
    } catch (err) {
      toast.error('Failed to add members: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemoveMember = async (member) => {
    const emp = employees.find(e => (e.employee_id || e.id) === member.employee_id)
    const empName = emp?.name || member.employee_id
    const ok = await confirm(`Remove ${empName} from ${selectedGroup?.name}?`, {
      title: 'Remove Group Member',
      confirmText: 'Remove Member',
      variant: 'danger',
      icon: 'ri-user-unfollow-line'
    })
    if (!ok) return
    try {
      await supabase.from('duty_group_members').delete().eq('id', member.id)
      setGroupMembers(prev => prev.filter(m => m.id !== member.id))
      toast.success('Member removed.')
    } catch (err) {
      toast.error('Failed to remove member: ' + err.message)
    }
  }

  const handleUpdateMemberScheduleType = async (member, schedType) => {
    try {
      await supabase.from('duty_group_members').update({ schedule_type: schedType }).eq('id', member.id)
      setGroupMembers(prev => prev.map(m => m.id === member.id ? { ...m, schedule_type: schedType } : m))
    } catch (err) {
      toast.error('Failed to update schedule type: ' + err.message)
    }
  }

  // ─── Roster (shift assignment) management ────────────────────────────────────
  const handleSetShift = async (groupId, shiftCode) => {
    try {
      const existing = shiftRosters.find(
        r => r.group_id === groupId && r.year === selectedYear && r.month === selectedMonth && r.cutoff_period === cutoffPeriod
      )
      if (existing) {
        await supabase.from('shift_rosters').update({ shift_type: shiftCode }).eq('id', existing.id)
        setShiftRosters(prev => prev.map(r => r.id === existing.id ? { ...r, shift_type: shiftCode } : r))
      } else {
        const { data, error } = await supabase.from('shift_rosters').insert([{
          group_id: groupId,
          year: selectedYear,
          month: selectedMonth,
          cutoff_period: cutoffPeriod,
          shift_type: shiftCode
        }]).select()
        if (error) throw error
        setShiftRosters(prev => [...prev, data[0]])
      }
    } catch (err) {
      toast.error('Failed to update shift: ' + err.message)
    }
  }

  // One-click rotate: swap Day↔Night for all groups in current period
  const handleRotateShifts = async () => {
    const assignedGroups = dutyGroups.filter(g => currentRosterMap[g.id])
    if (assignedGroups.length === 0) { toast.error('No shift assignments to rotate in this period.'); return }

    const ok = await confirm(`Rotate Day ↔ Night shifts for ${assignedGroups.length} groups in ${MONTHS[selectedMonth]} ${cutoffPeriod} cutoff?\n\nDay Duty (12h) and Night Duty (12h) shifts will be swapped.`, {
      title: 'Rotate Shift Roster',
      confirmText: 'Rotate Shifts',
      variant: 'info',
      icon: 'ri-refresh-line'
    })
    if (!ok) return

    const ROTATION_MAP = { DAY_12: 'NIGHT_12', NIGHT_12: 'DAY_12', DAY_REG: 'NIGHT_12' }
    setIsSaving(true)
    try {
      for (const group of assignedGroups) {
        const current = currentRosterMap[group.id]
        const next = ROTATION_MAP[current] || current
        if (next !== current) await handleSetShift(group.id, next)
      }
      await logAudit('Bulk Update', 'Shift Roster', `${selectedYear}-${selectedMonth}-${cutoffPeriod}`, 'Rotated Day/Night shifts')
      toast.success('Shifts rotated successfully!')
    } catch (err) {
      toast.error('Failed to rotate shifts: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Open modal for Apply Roster to Attendance confirmation
  const handleApplyToAttendance = () => {
    const assignedGroups = dutyGroups.filter(g => currentRosterMap[g.id])
    if (assignedGroups.length === 0) {
      toast.error('No shift assignments found. Assign shifts to groups first.')
      return
    }
    setIsApplyModalOpen(true)
  }

  // Execute Apply Roster to Attendance after user confirms in modal
  const handleConfirmApplyToAttendance = async () => {
    const daysInM = getDaysInMonth(new Date(selectedYear, selectedMonth, 1))
    const startDay = cutoffPeriod === '2nd' ? 16 : 1
    const endDay   = cutoffPeriod === '1st' ? 15 : daysInM

    const cutoffDates = []
    for (let d = startDay; d <= endDay; d++) {
      cutoffDates.push(format(new Date(selectedYear, selectedMonth, d), 'yyyy-MM-dd'))
    }

    setIsSaving(true)
    try {
      const logs = []
      for (const group of dutyGroups) {
        const shiftCode = currentRosterMap[group.id]
        if (!shiftCode) continue
        const shiftDef = SHIFT_TYPES.find(s => s.code === shiftCode)
        if (!shiftDef) continue

        const members = groupMembers.filter(m => m.group_id === group.id)
        for (const member of members) {
          const emp = employees.find(e => (e.employee_id || e.id) === member.employee_id)
          if (!emp) continue

          for (const dateStr of cutoffDates) {
            const dateObj = new Date(dateStr + 'T00:00:00')
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6
            const schedType = member.schedule_type || 'WEEKDAY_ONLY'
            const effectiveShiftCode = (isWeekend && schedType === 'WEEKDAY_ONLY') ? 'OFF' : shiftCode
            const effectiveShift = SHIFT_TYPES.find(s => s.code === effectiveShiftCode)

            logs.push({
              id: `log-${Date.now()}-${member.employee_id}-${dateStr}`,
              record_id: `ATT-${dateStr}-${member.employee_id}`,
              employee_id: member.employee_id,
              employee_name: emp.name || 'Unnamed Employee',
              designation: emp.designation || 'Staff',
              office: emp.office || 'CDRRMO Headquarters',
              date: dateStr,
              status: effectiveShift.status,
              duty_status: effectiveShift.status === 'Present' ? 'On Duty' : 'Off Duty',
              shift_type: effectiveShift.code,
              time_in: effectiveShift.timeIn,
              time_out: effectiveShift.timeOut,
              rendered_hours: effectiveShift.hours,
              night_diff_hours: effectiveShift.code === 'NIGHT_12' ? 8 : effectiveShift.code === 'DUTY_24' ? 8 : 0,
              remarks: `Assigned via Duty Roster — ${group.name} (${shiftDef.label})`
            })
          }
        }
      }

      if (logs.length > 0) {
        await supabase.from('employee_attendance').upsert(logs)
        await logAudit('Bulk Update', 'Attendance', `ROSTER-${selectedYear}-${selectedMonth}-${cutoffPeriod}`, `Applied roster to ${logs.length} attendance entries`)
        toast.success(`Applied roster: ${logs.length} attendance entries written!`)
        setIsApplyModalOpen(false)
      } else {
        toast.error('No roster entries were generated.')
      }
    } catch (err) {
      toast.error('Failed to apply roster: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  const years  = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1]
  const filteredUnassigned = unassignedEmployees.filter(e =>
    (e.name || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
    (e.designation || '').toLowerCase().includes(memberSearch.toLowerCase())
  )

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner" />
        <p>Loading duty roster...</p>
      </div>
    )
  }

  return (
    <div className="page-content">
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h2>Duty Roster Manager — LGU Palayan City</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Manage CDRRMO emergency response & administrative duty teams, assign 6-to-6 shifts per cutoff period, and rotate Day/Night schedules.
          </p>
        </div>
        {(isAdmin || permissions.can_edit) && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn-secondary"
              onClick={handleRotateShifts}
              disabled={isSaving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700' }}
            >
              <i className="ri-refresh-line" /> Rotate Day ↔ Night
            </button>
            <button
              className="btn-primary"
              onClick={handleApplyToAttendance}
              disabled={isSaving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700' }}
            >
              <i className="ri-calendar-check-line" /> Apply to Attendance
            </button>
          </div>
        )}
      </div>

      {/* ── Period Controls & KPI Summary Bar ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px'
      }}>
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)', padding: '14px 18px', boxShadow: 'var(--shadow-sm)',
          display: 'flex', alignItems: 'center', gap: '14px'
        }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
            <i className="ri-group-line" />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Duty Groups</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>{dutyGroups.length}</div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)', padding: '14px 18px', boxShadow: 'var(--shadow-sm)',
          display: 'flex', alignItems: 'center', gap: '14px'
        }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
            <i className="ri-team-line" />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Enrolled Staff</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>{groupMembers.length}</div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)', padding: '14px 18px', boxShadow: 'var(--shadow-sm)',
          display: 'flex', alignItems: 'center', gap: '14px'
        }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
            <i className="ri-sun-fill" />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Day Shift Teams</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
              {dutyGroups.filter(g => currentRosterMap[g.id] === 'DAY_REG' || currentRosterMap[g.id] === 'DAY_12').length}
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)', padding: '14px 18px', boxShadow: 'var(--shadow-sm)',
          display: 'flex', alignItems: 'center', gap: '14px'
        }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
            <i className="ri-moon-clear-fill" />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Night & 24H Teams</div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
              {dutyGroups.filter(g => currentRosterMap[g.id] === 'NIGHT_12' || currentRosterMap[g.id] === 'DUTY_24').length}
            </div>
          </div>
        </div>
      </div>

      {/* ── Period Selector Controls ── */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)', padding: '14px 18px', marginBottom: '20px',
        display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="ri-calendar-2-line" style={{ color: 'var(--primary)', fontSize: '16px' }} />
          <span style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-muted)' }}>Period:</span>
        </div>

        <select
          value={selectedYear}
          onChange={e => setSelectedYear(Number(e.target.value))}
          style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '13px', fontWeight: '700', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(Number(e.target.value))}
          style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '13px', fontWeight: '700', background: 'var(--bg-app)', color: 'var(--text-primary)' }}
        >
          {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>

        {['1st', '2nd'].map(c => (
          <button
            key={c}
            onClick={() => setCutoffPeriod(c)}
            style={{
              padding: '7px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: '700',
              background: cutoffPeriod === c ? 'var(--primary)' : 'var(--bg-app)',
              color: cutoffPeriod === c ? '#fff' : 'var(--text-muted)',
              boxShadow: cutoffPeriod === c ? '0 2px 8px rgba(220,38,38,0.3)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            {c === '1st' ? '1st Cutoff (1–15)' : '2nd Cutoff (16–End)'}
          </button>
        ))}

        <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
          <i className="ri-information-line" style={{ marginRight: '4px' }} />
          Assignments shown for selected period
        </div>
      </div>

      {/* ── Main 2-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'start' }}>

        {/* ── LEFT: Groups Panel ── */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid var(--border-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <div style={{ fontWeight: '800', fontSize: '14px', color: 'var(--text-primary)' }}>
              <i className="ri-group-line" style={{ marginRight: '7px', color: 'var(--primary)' }} />
              Duty Groups ({dutyGroups.length})
            </div>
            {(isAdmin || permissions.can_edit) && (
              <button
                className="btn-primary"
                onClick={openNewGroupModal}
                style={{ padding: '5px 12px', fontSize: '12px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <i className="ri-add-line" /> New Group
              </button>
            )}
          </div>

          {dutyGroups.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <i className="ri-group-line" style={{ fontSize: '32px', marginBottom: '8px', display: 'block', opacity: 0.4 }} />
              <div style={{ fontSize: '13px' }}>No duty groups yet.</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>Create a group to get started.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {dutyGroups.map(group => {
                const memberCount = groupMembers.filter(m => m.group_id === group.id).length
                const currentShift = currentRosterMap[group.id]
                const shiftOpt = currentShift ? getShiftOption(currentShift) : null
                const isSelected = selectedGroupId === group.id

                return (
                  <div
                    key={group.id}
                    onClick={() => setSelectedGroupId(isSelected ? null : group.id)}
                    style={{
                      padding: '12px 16px', cursor: 'pointer', transition: 'all 0.15s',
                      background: isSelected ? 'var(--primary-bg)' : 'transparent',
                      borderLeft: isSelected ? `3px solid ${group.color}` : '3px solid transparent',
                      borderBottom: '1px solid var(--border-light)'
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-app)' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '12px', height: '12px', borderRadius: '50%',
                        background: group.color, flexShrink: 0
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text-primary)' }}>{group.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                          {memberCount} member{memberCount !== 1 ? 's' : ''}
                          {group.description && ` · ${group.description}`}
                        </div>
                      </div>
                      {shiftOpt && (
                        <span style={{
                          padding: '2px 7px', borderRadius: '5px', fontSize: '10px', fontWeight: '800',
                          background: shiftOpt.bg, color: shiftOpt.color, flexShrink: 0
                        }}>{shiftOpt.short}</span>
                      )}
                      {(isAdmin || permissions.can_edit) && (
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => openEditGroupModal(group)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px', color: 'var(--text-muted)', fontSize: '14px' }}
                            title="Edit group"
                          ><i className="ri-pencil-line" /></button>
                          <button
                            onClick={() => handleDeleteGroup(group)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px', color: '#ef4444', fontSize: '14px' }}
                            title="Delete group"
                          ><i className="ri-delete-bin-line" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT: Roster Assignment Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Shift Assignment Table */}
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: '800', fontSize: '14px', color: 'var(--text-primary)' }}>
                <i className="ri-swap-line" style={{ marginRight: '7px', color: 'var(--primary)' }} />
                Shift Assignments — {MONTHS[selectedMonth]} {selectedYear} · {cutoffPeriod === '1st' ? '1st Cutoff (1–15)' : '2nd Cutoff (16–End)'}
              </div>
            </div>

            {dutyGroups.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <i className="ri-swap-line" style={{ fontSize: '40px', marginBottom: '12px', display: 'block', opacity: 0.3 }} />
                <div style={{ fontSize: '14px', fontWeight: '700' }}>No groups yet</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>Create a duty group on the left to assign shifts.</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-app)', borderBottom: '2px solid var(--border-light)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Group</th>
                    <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Members</th>
                    <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shift Assignment</th>
                    <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Weekend Policy</th>
                  </tr>
                </thead>
                <tbody>
                  {dutyGroups.map((group, gi) => {
                    const mems = groupMembers.filter(m => m.group_id === group.id)
                    const weekdayOnly = mems.filter(m => m.schedule_type === 'WEEKDAY_ONLY').length
                    const allWeek    = mems.filter(m => m.schedule_type === 'ALL_WEEK').length
                    const currentShiftCode = currentRosterMap[group.id] || ''

                    return (
                      <tr key={group.id} style={{ borderBottom: '1px solid var(--border-light)', background: gi % 2 === 0 ? 'transparent' : 'var(--bg-app)' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: group.color, flexShrink: 0 }} />
                            <div>
                              <div style={{ fontWeight: '800', fontSize: '13px', color: 'var(--text-primary)' }}>{group.name}</div>
                              {group.description && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{group.description}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{ fontWeight: '800', fontSize: '14px', color: 'var(--text-primary)' }}>{mems.length}</span>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>employees</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <ShiftSelectPill
                            value={currentShiftCode}
                            onChange={newCode => handleSetShift(group.id, newCode)}
                            disabled={!isAdmin && !permissions.can_edit}
                          />
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {mems.length === 0 ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>No members</span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                              {weekdayOnly > 0 && (
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#0284c7', background: '#e0f2fe', padding: '2px 7px', borderRadius: '4px' }}>
                                  <i className="ri-sun-line" style={{ marginRight: '3px' }} />{weekdayOnly} Mon–Fri Only
                                </span>
                              )}
                              {allWeek > 0 && (
                                <span style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a', background: '#dcfce7', padding: '2px 7px', borderRadius: '4px' }}>
                                  <i className="ri-calendar-2-line" style={{ marginRight: '3px' }} />{allWeek} All Week
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Group Member Detail Panel */}
          {selectedGroup && (
            <div style={{
              background: 'var(--bg-surface)', border: `1px solid ${selectedGroup.color}55`,
              borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
              borderTop: `3px solid ${selectedGroup.color}`
            }}>
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: selectedGroup.color }} />
                  <div style={{ fontWeight: '800', fontSize: '14px', color: 'var(--text-primary)' }}>
                    {selectedGroup.name} — Members ({enrichedMembers.length})
                  </div>
                </div>
                {(isAdmin || permissions.can_edit) && (
                  <button
                    className="btn-primary"
                    onClick={openMemberModal}
                    style={{ padding: '5px 12px', fontSize: '12px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <i className="ri-user-add-line" /> Add Members
                  </button>
                )}
              </div>

              {enrichedMembers.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <i className="ri-user-add-line" style={{ fontSize: '32px', marginBottom: '8px', display: 'block', opacity: 0.3 }} />
                  <div style={{ fontSize: '13px', fontWeight: '700' }}>No members in this group</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>Click "Add Members" to assign employees.</div>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-app)', borderBottom: '2px solid var(--border-light)' }}>
                      <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Employee</th>
                      <th style={{ textAlign: 'left', padding: '10px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Designation</th>
                      <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Weekend Policy</th>
                      {(isAdmin || permissions.can_edit) && (
                        <th style={{ textAlign: 'center', padding: '10px 16px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {enrichedMembers.map((m, mi) => (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--border-light)', background: mi % 2 === 0 ? 'transparent' : 'var(--bg-app)' }}>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>{m.emp?.name || m.employee_id}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{m.emp?.office || ''}</div>
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>{m.emp?.designation || '—'}</td>
                        <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                          {(isAdmin || permissions.can_edit) ? (
                            <select
                              value={m.schedule_type || 'WEEKDAY_ONLY'}
                              onChange={e => handleUpdateMemberScheduleType(m, e.target.value)}
                              style={{ padding: '4px 8px', borderRadius: '5px', fontSize: '11px', fontWeight: '700', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                            >
                              {SCHEDULE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {SCHEDULE_TYPES.find(s => s.value === m.schedule_type)?.label || 'Weekday Only'}
                            </span>
                          )}
                        </td>
                        {(isAdmin || permissions.can_edit) && (
                          <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                            <button
                              onClick={() => handleRemoveMember(m)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '16px', padding: '4px' }}
                              title="Remove from group"
                            ><i className="ri-user-unfollow-line" /></button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Create / Edit Group Modal ── */}
      {isGroupModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '440px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-light)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', background: 'var(--primary-bg)' }}>
              <div style={{ fontWeight: '800', fontSize: '16px', color: 'var(--text-primary)' }}>
                {editingGroup ? 'Edit Duty Group' : 'Create Duty Group'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {editingGroup ? `Editing: ${editingGroup.name}` : 'Define a new team for shift assignment'}
              </div>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: '700', fontSize: '12px', marginBottom: '5px', color: 'var(--text-muted)' }}>GROUP NAME *</label>
                <input
                  type="text"
                  value={groupForm.name}
                  onChange={e => setGroupForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Team Alpha, Bravo Squad..."
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', border: '1px solid var(--border-light)', fontSize: '13px', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: '700', fontSize: '12px', marginBottom: '8px', color: 'var(--text-muted)' }}>COLOR</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {GROUP_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setGroupForm(p => ({ ...p, color: c }))}
                      style={{
                        width: '28px', height: '28px', borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                        outline: groupForm.color === c ? `3px solid ${c}` : 'none',
                        outlineOffset: '2px', transition: 'transform 0.15s',
                        transform: groupForm.color === c ? 'scale(1.2)' : 'scale(1)'
                      }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: '700', fontSize: '12px', marginBottom: '5px', color: 'var(--text-muted)' }}>DESCRIPTION (Optional)</label>
                <input
                  type="text"
                  value={groupForm.description}
                  onChange={e => setGroupForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. Emergency response team..."
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', border: '1px solid var(--border-light)', fontSize: '13px', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'var(--bg-app)' }}>
              <button className="btn-secondary" onClick={() => setIsGroupModalOpen(false)} disabled={isSaving} style={{ fontSize: '13px' }}>Cancel</button>
              <button className="btn-submit" onClick={handleSaveGroup} disabled={isSaving} style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {isSaving ? <><i className="ri-loader-4-line" /> Saving...</> : <><i className="ri-save-line" /> {editingGroup ? 'Save Changes' : 'Create Group'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Members Modal ── */}
      {isMemberModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '580px', maxHeight: '85vh', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', background: 'var(--primary-bg)' }}>
              <div style={{ fontWeight: '800', fontSize: '16px', color: 'var(--text-primary)' }}>
                Add Members to {selectedGroup?.name}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Select employees and set their weekend work schedule.
              </div>
            </div>

            <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border-light)' }}>
              <input
                type="text"
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                placeholder="Search employee name or designation..."
                style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', border: '1px solid var(--border-light)', fontSize: '13px', background: 'var(--bg-app)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
              />
              {pendingMembers.length > 0 && (
                <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--primary)', fontWeight: '700' }}>
                  <i className="ri-checkbox-circle-fill" style={{ marginRight: '4px' }} />
                  {pendingMembers.length} employee(s) selected
                </div>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px' }}>
              {filteredUnassigned.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {unassignedEmployees.length === 0
                    ? 'All employees are already assigned to a group.'
                    : 'No employees match your search.'}
                </div>
              ) : filteredUnassigned.map(emp => {
                const eid = emp.employee_id || emp.id
                const pending = pendingMembers.find(m => m.employee_id === eid)
                const isSelected = Boolean(pending)

                return (
                  <div
                    key={eid}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px',
                      borderRadius: '8px', marginBottom: '4px', cursor: 'pointer',
                      background: isSelected ? 'var(--primary-bg)' : 'var(--bg-app)',
                      border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-light)',
                      transition: 'all 0.15s'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePendingMember(emp)}
                      style={{ width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }} onClick={() => togglePendingMember(emp)}>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)' }}>{emp.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{emp.designation} · {emp.office}</div>
                    </div>
                    {isSelected && (
                      <select
                        value={pending.schedule_type}
                        onChange={e => { e.stopPropagation(); updatePendingScheduleType(eid, e.target.value) }}
                        onClick={e => e.stopPropagation()}
                        style={{ padding: '4px 7px', borderRadius: '5px', fontSize: '11px', fontWeight: '700', border: '1px solid var(--border-light)', background: 'var(--bg-surface)', color: 'var(--text-primary)', flexShrink: 0 }}
                      >
                        {SCHEDULE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'var(--bg-app)' }}>
              <button className="btn-secondary" onClick={() => setIsMemberModalOpen(false)} disabled={isSaving} style={{ fontSize: '13px' }}>Cancel</button>
              <button className="btn-submit" onClick={handleAddMembers} disabled={isSaving || pendingMembers.length === 0} style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                {isSaving ? <><i className="ri-loader-4-line" /> Adding...</> : <><i className="ri-user-add-line" /> Add {pendingMembers.length > 0 ? `${pendingMembers.length} Member(s)` : 'Members'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Apply Roster to Attendance Confirmation Modal ── */}
      {isApplyModalOpen && (() => {
        const daysInM = getDaysInMonth(new Date(selectedYear, selectedMonth, 1))
        const startDay = cutoffPeriod === '2nd' ? 16 : 1
        const endDay   = cutoffPeriod === '1st' ? 15 : daysInM
        const daysCount = endDay - startDay + 1

        const activeGroupRosters = dutyGroups
          .filter(g => currentRosterMap[g.id])
          .map(g => {
            const shiftCode = currentRosterMap[g.id]
            const shiftDef = SHIFT_OPTIONS.find(s => s.code === shiftCode) || SHIFT_OPTIONS[0]
            const members = groupMembers.filter(m => m.group_id === g.id)
            const enrichedMems = members.map(m => employees.find(e => (e.employee_id || e.id) === m.employee_id)?.name || m.employee_id)
            return { group: g, shiftDef, members, enrichedMems }
          })

        const totalMemberCount = activeGroupRosters.reduce((sum, item) => sum + item.members.length, 0)
        const totalLogsToCreate = totalMemberCount * daysCount

        return (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}>
            <div style={{
              background: 'var(--bg-surface)', borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '620px',
              boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-light)',
              display: 'flex', flexDirection: 'column', maxHeight: '88vh', overflow: 'hidden'
            }}>
              {/* Header */}
              <div style={{
                padding: '22px 24px 16px', borderBottom: '1px solid var(--border-light)',
                background: 'linear-gradient(135deg, var(--primary-bg) 0%, var(--bg-surface) 100%)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                  <div style={{
                    width: '42px', height: '42px', borderRadius: '12px',
                    background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(220,38,38,0.3)'
                  }}>
                    <i className="ri-calendar-check-fill" style={{ color: '#fff', fontSize: '20px' }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: '800', fontSize: '16px', color: 'var(--text-primary)' }}>
                      Apply Roster Shifts to Attendance
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Snapshot for <strong>{MONTHS[selectedMonth]} {selectedYear} · {cutoffPeriod === '1st' ? '1st Cutoff (1–15)' : '2nd Cutoff (16–End)'}</strong> ({daysCount} days)
                    </div>
                  </div>
                </div>
              </div>

              {/* Body Content */}
              <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>

                {/* Notice Alert Box */}
                <div style={{
                  background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-md)',
                  padding: '12px 16px', marginBottom: '18px', display: 'flex', gap: '12px', alignItems: 'flex-start'
                }}>
                  <i className="ri-information-fill" style={{ color: '#2563eb', fontSize: '18px', marginTop: '1px' }} />
                  <div style={{ fontSize: '12.5px', color: '#1e40af', lineHeight: '1.45' }}>
                    This action will populate or overwrite attendance records in the <strong>DTR matrix</strong> for all assigned duty group members across these <strong>{daysCount} cutoff days</strong>.
                  </div>
                </div>

                {/* Summary Metrics */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px'
                }}>
                  <div style={{ background: 'var(--bg-app)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Duty Groups</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>{activeGroupRosters.length}</div>
                  </div>
                  <div style={{ background: 'var(--bg-app)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assigned Staff</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>{totalMemberCount}</div>
                  </div>
                  <div style={{ background: 'var(--bg-app)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-light)', textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>DTR Logs Created</div>
                    <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--primary)', marginTop: '2px' }}>{totalLogsToCreate}</div>
                  </div>
                </div>

                {/* Group Shift Roster Breakdown */}
                <div style={{ fontWeight: '800', fontSize: '12.5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
                  Assigned Shift Schedule
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {activeGroupRosters.map(({ group, shiftDef, members, enrichedMems }) => (
                    <div key={group.id} style={{
                      padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-app)',
                      border: '1px solid var(--border-light)', borderLeft: `4px solid ${group.color}`
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ fontWeight: '800', fontSize: '13.5px', color: 'var(--text-primary)' }}>
                          {group.name}
                        </div>
                        <span style={{
                          padding: '4px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '800',
                          background: shiftDef.bg, color: shiftDef.color
                        }}>
                          {shiftDef.label}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        <strong>{members.length} member(s):</strong> {enrichedMems.length > 0 ? enrichedMems.join(', ') : 'No employees assigned'}
                      </div>
                    </div>
                  ))}
                </div>

              </div>

              {/* Footer Actions */}
              <div style={{
                padding: '16px 24px', borderTop: '1px solid var(--border-light)',
                display: 'flex', justifyContent: 'flex-end', gap: '10px',
                background: 'var(--bg-app)'
              }}>
                <button
                  className="btn-secondary"
                  onClick={() => setIsApplyModalOpen(false)}
                  disabled={isSaving}
                  style={{ fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  className="btn-submit"
                  onClick={handleConfirmApplyToAttendance}
                  disabled={isSaving}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '13px' }}
                >
                  {isSaving
                    ? <><i className="ri-loader-4-line" /> Writing DTR Logs...</>
                    : <><i className="ri-calendar-check-fill" /> Confirm & Apply Roster</>
                  }
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
