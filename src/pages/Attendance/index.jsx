import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../services/supabase'
import { logAudit } from '../../services/audit'
import { format, getDaysInMonth, startOfMonth, addDays } from 'date-fns'
import { printPDF } from '../../utils/printPDF'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'
import ModuleToolbar from '../../components/ModuleToolbar'
import ListPagination from '../../components/ListPagination'
import ExportModal from '../../components/ExportModal'
import TableGhostRows from '../../components/TableGhostRows'
import useListPagination from '../../hooks/useListPagination'
import StatusSelect from '../../components/StatusSelect'

const INITIAL_FORM_STATE = {
  record_id: '',
  employee_id: '',
  employee_name: '',
  designation: '',
  office: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  status: 'Present',
  duty_status: 'On Duty',
  shift_type: 'DAY_REG',
  time_in: '08:00',
  time_out: '17:00',
  rendered_hours: 8,
  night_diff_hours: 0,
  remarks: '',
}

export const SHIFT_TYPES = [
  {
    code: 'DAY_REG',
    label: 'Regular Day Duty (8:00 AM – 5:00 PM)',
    short: 'P',
    subText: '8 hrs',
    hours: 8,
    timeIn: '08:00',
    timeOut: '17:00',
    status: 'Present',
    bg: '#dcfce7',
    color: '#16a34a',
    icon: 'ri-sun-fill'
  },
  {
    code: 'DAY_12',
    label: 'Day Duty 12-hr (6:00 AM – 6:00 PM)',
    short: 'D12',
    subText: '12 hrs',
    hours: 12,
    timeIn: '06:00',
    timeOut: '18:00',
    status: 'Present',
    bg: '#e0f2fe',
    color: '#0284c7',
    icon: 'ri-sun-line'
  },
  {
    code: 'NIGHT_12',
    label: 'Night Duty 12-hr (6:00 PM – 6:00 AM)',
    short: 'N12',
    subText: '12 hrs',
    hours: 12,
    timeIn: '18:00',
    timeOut: '06:00',
    status: 'Present',
    bg: '#ede9fe',
    color: '#7c3aed',
    icon: 'ri-moon-clear-fill'
  },
  {
    code: 'DUTY_24',
    label: '24-Hour Emergency Duty (6:00 AM – 6:00 AM)',
    short: '24H',
    subText: '24 hrs',
    hours: 24,
    timeIn: '06:00',
    timeOut: '06:00',
    status: 'Present',
    bg: '#fef3c7',
    color: '#b45309',
    icon: 'ri-alarm-warning-fill'
  },
  {
    code: 'OFF',
    label: 'Off Duty / Rest Day',
    short: 'OFF',
    subText: '0 hrs',
    hours: 0,
    timeIn: '',
    timeOut: '',
    status: 'Off Duty',
    bg: '#f1f5f9',
    color: '#475569',
    icon: 'ri-moon-line'
  },
  {
    code: 'LEAVE',
    label: 'On Leave (Vacation / Sick / Official)',
    short: 'LV',
    subText: 'Leave',
    hours: 0,
    timeIn: '',
    timeOut: '',
    status: 'On Leave',
    bg: '#fff7ed',
    color: '#ea580c',
    icon: 'ri-calendar-event-fill'
  },
  {
    code: 'ABSENT',
    label: 'Absent (Unexcused)',
    short: 'ABS',
    subText: 'Absent',
    hours: 0,
    timeIn: '',
    timeOut: '',
    status: 'Absent',
    bg: '#fee2e2',
    color: '#dc2626',
    icon: 'ri-close-circle-fill'
  }
]

export const getShiftDetails = (rec) => {
  if (rec?.shift_type) {
    const found = SHIFT_TYPES.find(s => s.code === rec.shift_type)
    if (found) return found
  }
  const status = rec?.status || 'Present'
  if (status === 'Off Duty') return SHIFT_TYPES.find(s => s.code === 'OFF')
  if (status === 'On Leave') return SHIFT_TYPES.find(s => s.code === 'LEAVE')
  if (status === 'Absent') return SHIFT_TYPES.find(s => s.code === 'ABSENT')
  return SHIFT_TYPES[0]
}

export const calculateRenderedHours = (shiftCode, timeIn, timeOut) => {
  const shift = SHIFT_TYPES.find(s => s.code === shiftCode)
  if (shiftCode === 'OFF' || shiftCode === 'LEAVE' || shiftCode === 'ABSENT') return 0
  if (shiftCode === 'DUTY_24') return 24
  if (shiftCode === 'DAY_12' || shiftCode === 'NIGHT_12') return 12
  if (shiftCode === 'DAY_REG') return 8

  if (timeIn && timeOut) {
    try {
      const [hIn, mIn] = timeIn.split(':').map(Number)
      const [hOut, mOut] = timeOut.split(':').map(Number)
      let diff = (hOut * 60 + mOut) - (hIn * 60 + mIn)
      if (diff < 0) diff += 24 * 60
      let hours = diff / 60
      if (hours > 5 && hours <= 9) hours -= 1
      return Math.max(0, Math.round(hours * 10) / 10)
    } catch {
      return shift?.hours || 8
    }
  }
  return shift?.hours || 8
}

const ATTENDANCE_STATUS_OPTIONS = SHIFT_TYPES.map(s => ({
  value: s.status,
  shift_type: s.code,
  label: `${s.label} (${s.short})`,
  icon: s.icon,
  bg: s.bg,
  color: s.color,
  short: s.short
}))

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function Attendance() {
  const isAdmin = useIsAdmin()
  const permissions = usePermissions('attendance')
  const toast = useToast()
  const confirm = useConfirm()

  // Date Cutoff Controls
  const today = new Date()
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth()) // 0 - 11
  const [cutoffPeriod, setCutoffPeriod] = useState(today.getDate() <= 15 ? '1st' : '2nd') // '1st' (1-15), '2nd' (16-End), 'all', 'single'
  const [singleDate, setSingleDate] = useState(format(today, 'yyyy-MM-dd'))
  const [viewMode, setViewMode] = useState('matrix') // 'matrix' (DTR Grid) vs 'daily' (Single Day List)

  const [employees, setEmployees] = useState([])
  const [attendanceLogs, setAttendanceLogs] = useState([])
  const [dutyGroups, setDutyGroups] = useState([])
  const [dutyGroupMembers, setDutyGroupMembers] = useState([])
  const [shiftRosters, setShiftRosters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false)
  const [isTodayRosterModalOpen, setIsTodayRosterModalOpen] = useState(false)
  const [todayShiftSlot, setTodayShiftSlot] = useState('DAY') // 'DAY' (6am-6pm) vs 'NIGHT' (6pm-6am)
  const [todayRosterPreview, setTodayRosterPreview] = useState([])
  const [rosterPattern, setRosterPattern] = useState('REGULAR_8_5')
  const [isEditing, setIsEditing] = useState(false)
  const [isViewing, setIsViewing] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [formData, setFormData] = useState(INITIAL_FORM_STATE)

  // Compute array of dates for the selected cutoff period
  const cutoffDates = useMemo(() => {
    if (cutoffPeriod === 'single') {
      return [singleDate]
    }
    const daysInM = getDaysInMonth(new Date(selectedYear, selectedMonth, 1))
    let startDay = 1
    let endDay = 15

    if (cutoffPeriod === '2nd') {
      startDay = 16
      endDay = daysInM
    } else if (cutoffPeriod === 'all') {
      startDay = 1
      endDay = daysInM
    }

    const dates = []
    for (let day = startDay; day <= endDay; day++) {
      const d = new Date(selectedYear, selectedMonth, day)
      dates.push(format(d, 'yyyy-MM-dd'))
    }
    return dates
  }, [selectedYear, selectedMonth, cutoffPeriod, singleDate])

  // Fetch employees and attendance logs
  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch all active employees
      const { data: empData, error: empErr } = await supabase
        .from('employees')
        .select('*')
        .order('name', { ascending: true })

      if (empErr) throw empErr
      setEmployees(empData || [])

      // Fetch custom attendance overrides, duty group memberships, and shift rosters
      try {
        const [attRes, memRes, rosRes, grpRes] = await Promise.allSettled([
          supabase.from('employee_attendance').select('*'),
          supabase.from('duty_group_members').select('*'),
          supabase.from('shift_rosters').select('*'),
          supabase.from('duty_groups').select('*').order('name')
        ])

        if (attRes.status === 'fulfilled' && attRes.value.data) setAttendanceLogs(attRes.value.data)
        if (memRes.status === 'fulfilled' && memRes.value.data) setDutyGroupMembers(memRes.value.data)
        if (rosRes.status === 'fulfilled' && rosRes.value.data) setShiftRosters(rosRes.value.data)
        if (grpRes.status === 'fulfilled' && grpRes.value.data) setDutyGroups(grpRes.value.data)
      } catch (err) {
        console.info('Roster & attendance tables check notice:', err.message)
      }
    } catch (err) {
      console.error('Error loading attendance roster:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  // Derive matrix of attendance records for all employees across the selected cutoff dates
  const employeeMatrix = useMemo(() => {
    return employees.map(emp => {
      const empId = emp.employee_id || emp.id
      const empDutyStatus = emp.duty_status || 'Off Duty'

      // Resolve employee's duty group assignment for this period (used for column badge + defaults)
      const memberInfo = dutyGroupMembers.find(m => m.employee_id === empId)
      const groupInfo = memberInfo ? dutyGroups.find(g => g.id === memberInfo.group_id) : null
      const groupRosterForPeriod = memberInfo
        ? shiftRosters.find(r => r.group_id === memberInfo.group_id && r.year === selectedYear && r.month === selectedMonth && r.cutoff_period === cutoffPeriod)
        : null

      const dailyRecords = {}
      let totalRenderedHours = 0
      let totalNightDiffHours = 0
      let presentCount = 0
      let duty24Count = 0
      let nightCount = 0
      let dayCount = 0
      let offCount = 0
      let leaveCount = 0
      let absentCount = 0

      cutoffDates.forEach(dateStr => {
        const isFuture = dateStr > todayStr
        const dateObj = new Date(dateStr + 'T00:00:00')
        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6

        const existing = attendanceLogs.find(
          l => l.employee_id === empId && l.date === dateStr
        )

        let shiftObj = SHIFT_TYPES[0]
        if (existing) {
          shiftObj = getShiftDetails(existing)
        } else if (groupRosterForPeriod && groupRosterForPeriod.shift_type) {
          const isWeekendOnly = memberInfo?.schedule_type === 'WEEKDAY_ONLY'
          if (isWeekend && isWeekendOnly) {
            shiftObj = SHIFT_TYPES.find(s => s.code === 'OFF') || SHIFT_TYPES[0]
          } else {
            shiftObj = SHIFT_TYPES.find(s => s.code === groupRosterForPeriod.shift_type) || SHIFT_TYPES[0]
          }
        } else {
          // Unlogged default logic:
          // 1. TODAY: apply employee's current real-time duty_status
          if (dateStr === todayStr) {
            if (empDutyStatus === 'Off Duty') shiftObj = SHIFT_TYPES.find(s => s.code === 'OFF')
            else if (empDutyStatus === 'On Leave') shiftObj = SHIFT_TYPES.find(s => s.code === 'LEAVE')
            else if (empDutyStatus === 'Standby') shiftObj = SHIFT_TYPES.find(s => s.code === 'DAY_REG')
            else shiftObj = isWeekend ? SHIFT_TYPES.find(s => s.code === 'OFF') : SHIFT_TYPES[0]
          } else {
            // 2. OTHER DATES: standard schedule (Mon-Fri Day Duty, Sat-Sun Off Duty)
            shiftObj = isWeekend ? SHIFT_TYPES.find(s => s.code === 'OFF') : SHIFT_TYPES[0]
          }
        }

        const shiftType = existing?.shift_type || shiftObj.code
        const status = existing?.status || shiftObj.status
        const dutyStatus = existing?.duty_status || empDutyStatus
        const timeIn = existing?.time_in || shiftObj.timeIn
        const timeOut = existing?.time_out || shiftObj.timeOut
        const isPending = isFuture && !existing

        const rawHours = existing?.rendered_hours ?? calculateRenderedHours(shiftType, timeIn, timeOut)
        const renderedHours = isPending ? 0 : rawHours
        // Night differential: 10PM–6AM = 8 hours for NIGHT_12 and DUTY_24 shifts per CSC/DBM rules
        const nightDiffHours = existing?.night_diff_hours ?? (shiftType === 'NIGHT_12' ? 8 : shiftType === 'DUTY_24' ? 8 : 0)
        const remarks = existing?.remarks || ''

        // Only count rendered hours & present totals for past/current days OR explicitly logged shifts
        if (!isPending) {
          totalRenderedHours += Number(renderedHours || 0)
          totalNightDiffHours += Number(nightDiffHours || 0)
          if (status === 'Present') presentCount++
          if (shiftType === 'DUTY_24') duty24Count++
          if (shiftType === 'NIGHT_12') nightCount++
          if (shiftType === 'DAY_REG' || shiftType === 'DAY_12') dayCount++
          if (status === 'Off Duty') offCount++
          if (status === 'On Leave') leaveCount++
          if (status === 'Absent') absentCount++
        }

        dailyRecords[dateStr] = {
          id: existing?.id || `auto-${empId}-${dateStr}`,
          record_id: existing?.record_id || `ATT-${dateStr}-${empId}`,
          employee_id: empId,
          employee_name: emp.name || 'Unnamed Employee',
          designation: emp.designation || 'Staff',
          office: emp.office || 'CDRRMO Headquarters',
          date: dateStr,
          status,
          duty_status: dutyStatus,
          shift_type: shiftType,
          time_in: timeIn,
          time_out: timeOut,
          rendered_hours: rawHours,
          night_diff_hours: nightDiffHours,
          remarks,
          isOverride: Boolean(existing),
          isPending,
          isFuture
        }
      })

      return {
        emp,
        employee_id: empId,
        name: emp.name || 'Unnamed Employee',
        designation: emp.designation || 'Staff',
        office: emp.office || 'CDRRMO',
        groupInfo,             // { id, name, color } or null
        groupRoster: groupRosterForPeriod,  // { shift_type } or null
        dailyRecords,
        summary: {
          totalHours: Math.round(totalRenderedHours * 10) / 10,
          totalNightDiffHours: Math.round(totalNightDiffHours * 10) / 10,
          presentCount,
          duty24Count,
          nightCount,
          dayCount,
          offCount,
          leaveCount,
          absentCount,
          total: cutoffDates.length
        }
      }
    })
  }, [employees, attendanceLogs, cutoffDates, todayStr, dutyGroupMembers, dutyGroups, shiftRosters, selectedYear, selectedMonth, cutoffPeriod])

  // Filtered matrix rows based on toolbar filters
  const filteredMatrix = useMemo(() => {
    return employeeMatrix.filter(row => {
      let matchesSearch = true
      if (searchTerm) {
        const q = searchTerm.toLowerCase()
        matchesSearch =
          row.name?.toLowerCase().includes(q) ||
          row.employee_id?.toLowerCase().includes(q) ||
          row.designation?.toLowerCase().includes(q) ||
          row.office?.toLowerCase().includes(q)
      }

      let matchesStatus = true
      if (filter) {
        matchesStatus = Object.values(row.dailyRecords).some(rec =>
          rec.status === filter || rec.shift_type === filter
        )
      }

      return matchesSearch && matchesStatus
    })
  }, [employeeMatrix, searchTerm, filter])

  // KPI Summary Counts across entire department for the cutoff period
  const kpiSummary = useMemo(() => {
    let totalLogs = 0
    let totalPresent = 0
    let totalHours = 0
    let totalDuty24 = 0
    let totalNight = 0
    let totalLeave = 0
    let totalOff = 0
    let totalAbsent = 0

    employeeMatrix.forEach(row => {
      totalLogs += row.summary.total
      totalPresent += row.summary.presentCount
      totalHours += row.summary.totalHours
      totalDuty24 += row.summary.duty24Count
      totalNight += row.summary.nightCount
      totalLeave += row.summary.leaveCount
      totalOff += row.summary.offCount
      totalAbsent += row.summary.absentCount
    })

    return {
      totalLogs,
      totalPresent,
      totalHours: Math.round(totalHours),
      totalDuty24,
      totalNight,
      totalLeave,
      totalOff,
      totalAbsent,
      totalEmployees: employees.length
    }
  }, [employeeMatrix, employees])

  const { totalPages, safePage, pagedRecords: pagedMatrix } = useListPagination(filteredMatrix)

  // Open modal to view/edit a single cell attendance record
  const handleCellClick = (rec) => {
    const shift = getShiftDetails(rec)
    setFormData({
      ...rec,
      shift_type: rec.shift_type || shift.code,
      time_in: rec.time_in || shift.timeIn,
      time_out: rec.time_out || shift.timeOut,
      rendered_hours: rec.rendered_hours ?? shift.hours,
      night_diff_hours: rec.night_diff_hours ?? (shift.code === 'NIGHT_12' ? 8 : shift.code === 'DUTY_24' ? 8 : 0)
    })
    setIsViewing(false)
    setIsEditing(true)
    setIsModalOpen(true)
  }

  // Shift selection handler inside quick edit modal
  const handleShiftTypeChange = (shiftCode) => {
    const shift = SHIFT_TYPES.find(s => s.code === shiftCode) || SHIFT_TYPES[0]
    setFormData(prev => ({
      ...prev,
      shift_type: shift.code,
      status: shift.status,
      time_in: shift.timeIn,
      time_out: shift.timeOut,
      rendered_hours: shift.hours,
      night_diff_hours: shift.code === 'NIGHT_12' ? 8 : shift.code === 'DUTY_24' ? 8 : 0
    }))
  }

  // Batch Roster Generator / Auto-Fill Cutoff Attendance
  const handleApplyRosterPattern = async () => {
    const periodLabel = cutoffPeriod === '1st' ? '1st Cutoff (1–15)' : cutoffPeriod === '2nd' ? '2nd Cutoff (16–End)' : 'Full Month'

    try {
      setIsSaving(true)
      const newLogs = []

      employeeMatrix.forEach((row, empIdx) => {
        cutoffDates.forEach((dateStr, dIdx) => {
          const dateObj = new Date(dateStr)
          const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6
          let targetShiftCode = 'DAY_REG'

          if (rosterPattern === 'REGULAR_8_5') {
            targetShiftCode = isWeekend ? 'OFF' : 'DAY_REG'
          } else if (rosterPattern === 'ROTATION_24H') {
            const isDutyDay = (dIdx + empIdx) % 2 === 0
            targetShiftCode = isDutyDay ? 'DUTY_24' : 'OFF'
          } else if (rosterPattern === 'DAY_12H') {
            targetShiftCode = isWeekend ? 'OFF' : 'DAY_12'
          } else if (rosterPattern === 'NIGHT_12H') {
            targetShiftCode = isWeekend ? 'OFF' : 'NIGHT_12'
          }

          const shift = SHIFT_TYPES.find(s => s.code === targetShiftCode)
          const rec = row.dailyRecords[dateStr]

          newLogs.push({
            id: `log-${Date.now()}-${row.employee_id}-${dateStr}`,
            record_id: rec.record_id,
            employee_id: row.employee_id,
            employee_name: row.name,
            designation: row.designation,
            office: row.office,
            date: dateStr,
            shift_type: shift.code,
            status: shift.status,
            duty_status: shift.status === 'Present' ? 'On Duty' : 'Off Duty',
            time_in: shift.timeIn,
            time_out: shift.timeOut,
            rendered_hours: shift.hours,
            night_diff_hours: shift.code === 'NIGHT_12' ? 8 : shift.code === 'DUTY_24' ? 8 : 0,
            remarks: `Assigned via ${rosterPattern} Cutoff Roster`
          })
        })
      })

      if (newLogs.length > 0) {
        try {
          await supabase.from('employee_attendance').upsert(newLogs)
        } catch (err) {
          console.info('Supabase batch save notice:', err.message)
        }

        setAttendanceLogs(prev => {
          const filtered = prev.filter(l => !cutoffDates.includes(l.date))
          return [...filtered, ...newLogs]
        })

        await logAudit('Bulk Update', 'Attendance', `CUTOFF-${selectedYear}-${selectedMonth + 1}-${cutoffPeriod}`, `Applied ${rosterPattern} roster for ${periodLabel}`)
        toast.success(`Successfully populated ${newLogs.length} roster entries for ${periodLabel}!`)
        setIsRosterModalOpen(false)
      }
    } catch (err) {
      console.error('Error applying roster schedule:', err)
      toast.error('Failed to apply roster schedule: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Build preview list and open the today roster modal
  const handleLogTodayRoster = () => {
    const currentHour = new Date().getHours()
    const initialSlot = (currentHour >= 18 || currentHour < 6) ? 'NIGHT' : 'DAY'
    setTodayShiftSlot(initialSlot)
    buildTodayRosterPreview(initialSlot)
    setIsTodayRosterModalOpen(true)
  }

  const buildTodayRosterPreview = (slot) => {
    const formattedToday = format(new Date(), 'yyyy-MM-dd')
    const todayDateObj = new Date(formattedToday + 'T00:00:00')
    const isWeekendToday = todayDateObj.getDay() === 0 || todayDateObj.getDay() === 6

    const preview = employees.map(emp => {
      const empId = emp.employee_id || emp.id
      const empDutyStatus = emp.duty_status || 'Off Duty'

      // Resolve duty group membership and roster for the current period
      const memberInfo = dutyGroupMembers.find(m => m.employee_id === empId)
      const groupInfo = memberInfo ? dutyGroups.find(g => g.id === memberInfo.group_id) : null
      const groupRoster = memberInfo
        ? shiftRosters.find(r =>
            r.group_id === memberInfo.group_id &&
            r.year === selectedYear &&
            r.month === selectedMonth &&
            r.cutoff_period === cutoffPeriod)
        : null

      let shiftObj = SHIFT_TYPES[0]

      if (groupRoster && groupRoster.shift_type) {
        // Employee has a roster-assigned shift for this period
        const isWeekendOnly = memberInfo?.schedule_type === 'WEEKDAY_ONLY'
        if (isWeekendToday && isWeekendOnly) {
          shiftObj = SHIFT_TYPES.find(s => s.code === 'OFF')
        } else {
          shiftObj = SHIFT_TYPES.find(s => s.code === groupRoster.shift_type) || SHIFT_TYPES[0]
        }
      } else {
        // No roster assignment — fall back to duty status or slot default
        if (empDutyStatus === 'Off Duty') shiftObj = SHIFT_TYPES.find(s => s.code === 'OFF')
        else if (empDutyStatus === 'On Leave') shiftObj = SHIFT_TYPES.find(s => s.code === 'LEAVE')
        else if (empDutyStatus === 'Standby') shiftObj = SHIFT_TYPES.find(s => s.code === 'DAY_REG')
        else if (isWeekendToday) shiftObj = SHIFT_TYPES.find(s => s.code === 'OFF')
        else {
          // Use the DAY/NIGHT slot to determine which shift for unassigned employees
          shiftObj = slot === 'NIGHT'
            ? SHIFT_TYPES.find(s => s.code === 'NIGHT_12')
            : SHIFT_TYPES.find(s => s.code === 'DAY_12')
        }
      }

      return {
        id: empId,
        name: emp.name || 'Unnamed Employee',
        designation: emp.designation || 'Staff',
        office: emp.office || '',
        dutyStatus: empDutyStatus,
        groupInfo,          // { id, name, color } for badge display
        groupRoster,        // { shift_type } for context
        shiftObj,
        date: formattedToday,
        slot
      }
    })
    setTodayRosterPreview(preview)
  }

  // Actually save when admin confirms in the modal
  const handleConfirmLogTodayRoster = async () => {
    const formattedToday = format(new Date(), 'yyyy-MM-dd')
    try {
      setIsSaving(true)
      const newTodayLogs = todayRosterPreview.map(p => {
        const existing = attendanceLogs.find(l => l.employee_id === p.id && l.date === formattedToday)
        return {
          id: existing?.id || `log-${Date.now()}-${p.id}-${formattedToday}`,
          record_id: `ATT-${formattedToday}-${p.id}`,
          employee_id: p.id,
          employee_name: p.name,
          designation: p.designation,
          office: p.office,
          date: formattedToday,
          status: p.shiftObj.status,
          duty_status: p.shiftObj.status === 'Present' ? 'On Duty' : 'Off Duty',
          shift_type: p.shiftObj.code,
          time_in: p.shiftObj.timeIn,
          time_out: p.shiftObj.timeOut,
          rendered_hours: p.shiftObj.hours,
          night_diff_hours: p.shiftObj.code === 'NIGHT_12' ? 8 : p.shiftObj.code === 'DUTY_24' ? 8 : 0,
          remarks: `Recorded via Today's Roster Snapshot (${p.dutyStatus})`
        }
      })

      try {
        await supabase.from('employee_attendance').upsert(newTodayLogs)
      } catch (err) {
        console.info('Supabase save notice:', err.message)
      }

      setAttendanceLogs(prev => {
        const filtered = prev.filter(l => l.date !== formattedToday)
        return [...filtered, ...newTodayLogs]
      })

      await logAudit('Bulk Update', 'Attendance', `TODAY-${formattedToday}`, `Recorded attendance roster for ${newTodayLogs.length} employees on ${formattedToday}`)
      toast.success(`Today's roster locked for ${newTodayLogs.length} employees!`)
      setIsTodayRosterModalOpen(false)
    } catch (err) {
      console.error("Error recording today's attendance:", err)
      toast.error("Failed to record today's attendance: " + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Save single attendance entry from modal
  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const shift = SHIFT_TYPES.find(s => s.code === formData.shift_type) || SHIFT_TYPES[0]
      const rHours = calculateRenderedHours(formData.shift_type, formData.time_in, formData.time_out)

      const updatedLog = {
        id: formData.id.startsWith('auto-') ? `log-${Date.now()}` : formData.id,
        record_id: formData.record_id,
        employee_id: formData.employee_id,
        employee_name: formData.employee_name,
        designation: formData.designation,
        office: formData.office,
        date: formData.date,
        status: formData.status || shift.status,
        duty_status: formData.status === 'Present' ? 'On Duty' : 'Off Duty',
        shift_type: formData.shift_type,
        time_in: formData.time_in,
        time_out: formData.time_out,
        rendered_hours: Number(formData.rendered_hours ?? rHours),
        night_diff_hours: Number(formData.night_diff_hours ?? (formData.shift_type === 'NIGHT_12' ? 8 : 0)),
        remarks: formData.remarks,
      }

      try {
        const { error: attErr } = await supabase
          .from('employee_attendance')
          .upsert([updatedLog])
        if (attErr) console.info('Supabase save notice:', attErr.message)
      } catch (err) {
        console.info('Supabase attendance save notice:', err.message)
      }

      setAttendanceLogs(prev => {
        const idx = prev.findIndex(l => l.employee_id === formData.employee_id && l.date === formData.date)
        if (idx !== -1) {
          const next = [...prev]
          next[idx] = updatedLog
          return next
        }
        return [...prev, updatedLog]
      })

      await logAudit('Updated', 'Attendance', formData.record_id, `Updated ${formData.shift_type} shift for ${formData.employee_name} on ${formData.date}`)
      toast.success(`Attendance updated for ${formData.employee_name}!`)
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving attendance update:', err)
      toast.error('Failed to update attendance: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // DTR PDF Export callback
  const handlePrintPDF = () => {
    const periodLabel = cutoffPeriod === '1st' ? '1st Cutoff (Day 1 – 15)'
      : cutoffPeriod === '2nd' ? `2nd Cutoff (Day 16 – ${getDaysInMonth(new Date(selectedYear, selectedMonth, 1))})`
      : cutoffPeriod === 'all' ? 'Full Month Cutoff'
      : `Single Day (${singleDate})`

    const recordsForPdf = filteredMatrix.map(row => ({
      employee_id: row.employee_id,
      name: row.name,
      designation: row.designation,
      office: row.office,
      rendered_hours: `${row.summary.totalHours} hrs`,
      present_days: `${row.summary.presentCount} days`,
      duty_24h: `${row.summary.duty24Count} duties`,
      night_shifts: `${row.summary.nightCount} shifts`,
      off_days: row.summary.offCount,
      leave_days: row.summary.leaveCount,
      absent_days: row.summary.absentCount,
    }))

    printPDF({
      title: `CDRRMO Daily Time Record (DTR) & Shift Summary — ${MONTH_NAMES[selectedMonth]} ${selectedYear}`,
      subtitle: `Period: ${periodLabel} • ${filteredMatrix.length} Employees Listed`,
      columns: [
        { header: 'Employee ID', key: 'employee_id' },
        { header: 'Employee Name', key: 'name' },
        { header: 'Designation', key: 'designation' },
        { header: 'Office', key: 'office' },
        { header: 'Total Rendered', key: 'rendered_hours' },
        { header: 'Present Days', key: 'present_days' },
        { header: '24-Hr Duties', key: 'duty_24h' },
        { header: 'Night Shifts', key: 'night_shifts' },
        { header: 'Off Duty', key: 'off_days' },
        { header: 'On Leave', key: 'leave_days' },
        { header: 'Absences', key: 'absent_days' },
      ],
      records: recordsForPdf,
    })
  }

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading semi-monthly DTR roster...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: '24px', color: '#991b1b', maxWidth: '500px', margin: '0 auto' }}>
          <h3>Failed to load attendance</h3>
          <p>{error}</p>
          <button className="btn-secondary" onClick={loadData} style={{ marginTop: '16px' }}>Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2>CDRRMO Employee Attendance & DTR Roster — LGU Palayan City</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Semi-monthly DTR attendance tracking (1st–15th & 16th–End of Month cutoffs) with multi-shift duty team rosters (8–5 Regular, 12h Day 6AM–6PM, 12h Night 6PM–6AM +ND, 24h Duty).
          </p>
        </div>

        {/* Toolbar Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {(isAdmin || permissions.can_edit) && (
            <>
              <button
                className="btn-secondary"
                onClick={handleLogTodayRoster}
                disabled={isSaving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700' }}
              >
                <i className="ri-checkbox-circle-line" style={{ color: 'var(--primary)' }} />
                Record Today's Roster
              </button>

              <button
                className="btn-primary"
                onClick={() => setIsRosterModalOpen(true)}
                disabled={isSaving}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '700' }}
              >
                <i className="ri-layout-grid-line" />
                Assign Cutoff Roster
              </button>
            </>
          )}
        </div>
      </div>

      {/* Cutoff Period Controls Bar */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)',
        padding: '14px 18px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        {/* Left: Month & Year Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="ri-calendar-line" style={{ fontSize: '18px', color: 'var(--primary)' }} />
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>Month:</span>
            <select
              value={selectedMonth}
              onChange={e => { setSelectedMonth(Number(e.target.value)); setCurrentPage(1); }}
              style={{
                padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-light)',
                background: 'var(--bg-app)', fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', cursor: 'pointer'
              }}
            >
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx}>{m}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>Year:</span>
            <select
              value={selectedYear}
              onChange={e => { setSelectedYear(Number(e.target.value)); setCurrentPage(1); }}
              style={{
                padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-light)',
                background: 'var(--bg-app)', fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', cursor: 'pointer'
              }}
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Middle: Cutoff Period Pills */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-app)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border-light)' }}>
          <button
            onClick={() => { setCutoffPeriod('1st'); setViewMode('matrix'); setCurrentPage(1); }}
            style={{
              padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', border: 'none', cursor: 'pointer',
              background: cutoffPeriod === '1st' ? 'var(--primary)' : 'transparent',
              color: cutoffPeriod === '1st' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s ease'
            }}
          >
            1st Cutoff (1–15)
          </button>

          <button
            onClick={() => { setCutoffPeriod('2nd'); setViewMode('matrix'); setCurrentPage(1); }}
            style={{
              padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', border: 'none', cursor: 'pointer',
              background: cutoffPeriod === '2nd' ? 'var(--primary)' : 'transparent',
              color: cutoffPeriod === '2nd' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s ease'
            }}
          >
            2nd Cutoff (16–End)
          </button>

          <button
            onClick={() => { setCutoffPeriod('all'); setViewMode('matrix'); setCurrentPage(1); }}
            style={{
              padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', border: 'none', cursor: 'pointer',
              background: cutoffPeriod === 'all' ? 'var(--primary)' : 'transparent',
              color: cutoffPeriod === 'all' ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.15s ease'
            }}
          >
            Full Month
          </button>
        </div>
      </div>

      {/* KPI Cards Summary for Cutoff */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Personnel Roster</span>
            <i className="ri-team-line" style={{ fontSize: '18px', color: '#0284c7' }} />
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--text-main)' }}>{kpiSummary.totalEmployees}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Total Active Staff</div>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Hours Rendered</span>
            <i className="ri-time-line" style={{ fontSize: '18px', color: '#16a34a' }} />
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#16a34a' }}>{kpiSummary.totalHours.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: '600' }}>hrs</span></div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Cutoff Rendered Work Hours</div>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>24-Hr Duties</span>
            <i className="ri-alarm-warning-line" style={{ fontSize: '18px', color: '#b45309' }} />
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#b45309' }}>{kpiSummary.totalDuty24}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Emergency 24-Hr Duties Logged</div>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Night Shifts</span>
            <i className="ri-moon-clear-line" style={{ fontSize: '18px', color: '#7c3aed' }} />
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#7c3aed' }}>{kpiSummary.totalNight}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>12-Hr Night Duties Logged</div>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Off / Leave / Absent</span>
            <i className="ri-user-unfollow-line" style={{ fontSize: '18px', color: '#dc2626' }} />
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#dc2626' }}>{kpiSummary.totalOff + kpiSummary.totalLeave + kpiSummary.totalAbsent}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Off ({kpiSummary.totalOff}), LV ({kpiSummary.totalLeave}), ABS ({kpiSummary.totalAbsent})</div>
        </div>
      </div>

      {/* Visual Shift Legend Bar */}
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
        fontSize: '12px'
      }}>
        <span style={{ fontWeight: '800', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <i className="ri-information-line" style={{ color: 'var(--primary)' }} /> Shift Legend:
        </span>
        {SHIFT_TYPES.map(shift => (
          <div key={shift.code} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              padding: '2px 6px',
              borderRadius: '4px',
              fontWeight: '800',
              fontSize: '11px',
              background: shift.bg,
              color: shift.color
            }}>
              {shift.short}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>{shift.label.split('(')[0]} ({shift.subText})</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <ModuleToolbar
        onSearch={v => { setSearchTerm(v); setCurrentPage(1); }}
        filterOptions={[
          { value: 'DAY_REG', label: 'Regular Day (8-5)' },
          { value: 'DAY_12', label: 'Day Duty (12h)' },
          { value: 'NIGHT_12', label: 'Night Duty (12h)' },
          { value: 'DUTY_24', label: '24-Hr Duty' },
          { value: 'OFF', label: 'Off Duty' },
          { value: 'LEAVE', label: 'On Leave' },
          { value: 'ABSENT', label: 'Absent' },
        ]}
        filterLabel="Filter by Shift/Status"
        onFilterChange={v => { setFilter(v); setCurrentPage(1); }}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        onExportClick={() => setIsExportOpen(true)}
        onClearFilters={() => { setSearchTerm(''); setFilter(''); setDateRange({ start: '', end: '' }); setCurrentPage(1); }}
        hasActiveFilters={Boolean(searchTerm || filter || dateRange.start || dateRange.end)}
      />

      {/* DTR Matrix Grid Table */}
      {employees.length === 0 ? (
        <div className="empty-state">
          <i className="ri-team-line" />
          <h3>No Employees Found</h3>
          <p>Add employees in the Employees module to start recording attendance.</p>
        </div>
      ) : filteredMatrix.length === 0 ? (
        <div className="empty-state">
          <i className="ri-filter-off-line" />
          <h3>No Matching Attendance Records</h3>
          <p>Try adjusting your search query or status filter.</p>
        </div>
      ) : (
        <>
          <div className="data-table" style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: '180px', position: 'sticky', left: 0, background: 'var(--bg-surface)', zIndex: 2 }}>
                    Employee Name
                  </th>
                  <th style={{ minWidth: '120px' }}>Designation</th>
                  <th style={{ minWidth: '110px', textAlign: 'center' }}>Duty Team</th>
                  {/* Dynamic Date Headers for Cutoff */}
                  {cutoffDates.map(dateStr => {
                    const dayNum = dateStr.split('-')[2]
                    const dObj = new Date(dateStr)
                    const isWeekend = dObj.getDay() === 0 || dObj.getDay() === 6
                    return (
                      <th key={dateStr} style={{ textAlign: 'center', padding: '8px 4px', minWidth: '42px', background: isWeekend ? 'var(--bg-app)' : 'transparent' }}>
                        <div style={{ fontSize: '11px', fontWeight: '800' }}>Day {dayNum}</div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dObj.getDay()]}
                        </div>
                      </th>
                    )
                  })}
                  <th style={{ textAlign: 'center', minWidth: '140px' }}>Cutoff Summary</th>
                </tr>
              </thead>
              <tbody>
                {pagedMatrix.map(row => (
                  <tr key={row.employee_id}>
                    {/* Employee Info Sticky */}
                    <td style={{ position: 'sticky', left: 0, background: 'var(--bg-surface)', zIndex: 1, borderRight: '1px solid var(--border-light)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary-bg)', color: 'var(--primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '12px', flexShrink: 0
                        }}>
                          {row.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '13px' }}>{row.name}</div>
                          <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>ID: {row.employee_id}</div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ fontWeight: '600', fontSize: '12px' }}>{row.designation}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{row.office}</div>
                    </td>

                    {/* Duty Team Badge */}
                    <td style={{ textAlign: 'center' }}>
                      {row.groupInfo ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800',
                            background: row.groupInfo.color + '20', color: row.groupInfo.color,
                            border: `1px solid ${row.groupInfo.color}40`
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: row.groupInfo.color, flexShrink: 0 }} />
                            {row.groupInfo.name}
                          </span>
                          {row.groupRoster && (
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: '700' }}>
                              {SHIFT_TYPES.find(s => s.code === row.groupRoster.shift_type)?.short || row.groupRoster.shift_type}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Unassigned</span>
                      )}
                    </td>

                    {/* Daily Status / Shift Cells */}
                    {cutoffDates.map(dateStr => {
                      const rec = row.dailyRecords[dateStr]
                      const shift = getShiftDetails(rec)

                      return (
                        <td
                          key={dateStr}
                          style={{ textAlign: 'center', padding: '6px 2px' }}
                          onClick={() => (isAdmin || permissions.can_edit) && handleCellClick(rec)}
                          title={`${row.name} — ${dateStr}: ${shift.label} ${rec.isPending ? '(Scheduled - Pending Date)' : `(${rec.rendered_hours} hrs rendered)`} ${rec.remarks ? '• ' + rec.remarks : ''}`}
                        >
                          <span style={{
                            padding: '4px 6px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '800',
                            background: rec.isPending ? 'var(--bg-app)' : shift.bg,
                            color: rec.isPending ? 'var(--text-muted)' : shift.color,
                            border: rec.isPending ? '1px dashed var(--border-light)' : rec.isOverride ? '1px solid currentColor' : 'none',
                            opacity: rec.isPending ? 0.7 : 1,
                            cursor: (isAdmin || permissions.can_edit) ? 'pointer' : 'default',
                            display: 'inline-block',
                            minWidth: '32px',
                          }}>
                            {shift.short}
                          </span>
                        </td>
                      )
                    })}

                    {/* Cutoff Summary Column */}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: '800', fontSize: '13px', color: 'var(--primary)', marginBottom: '2px' }}>
                        {row.summary.totalHours} <span style={{ fontSize: '10px', fontWeight: '600' }}>hrs</span>
                      </div>
                      {row.summary.totalNightDiffHours > 0 && (
                        <div style={{ fontSize: '10px', color: '#7c3aed', fontWeight: '700', marginBottom: '3px' }}>
                          <i className="ri-moon-clear-fill" style={{ marginRight: '2px' }} />
                          +{row.summary.totalNightDiffHours}h ND
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', fontSize: '10px', fontWeight: '700', flexWrap: 'wrap' }}>
                        {row.summary.duty24Count > 0 && (
                          <span style={{ color: '#b45309', background: '#fef3c7', padding: '1px 4px', borderRadius: '4px' }} title="24-Hr Duties">
                            {row.summary.duty24Count}×24h
                          </span>
                        )}
                        {row.summary.nightCount > 0 && (
                          <span style={{ color: '#7c3aed', background: '#ede9fe', padding: '1px 4px', borderRadius: '4px' }} title="Night Duties">
                            {row.summary.nightCount}×N12
                          </span>
                        )}
                        <span style={{ color: '#16a34a', background: '#dcfce7', padding: '1px 4px', borderRadius: '4px' }} title="Days Present">
                          {row.summary.presentCount}P
                        </span>
                        {(row.summary.offCount + row.summary.leaveCount + row.summary.absentCount) > 0 && (
                          <span style={{ color: '#475569', background: '#f1f5f9', padding: '1px 4px', borderRadius: '4px' }} title="Off / Leave / Absent">
                            {row.summary.offCount + row.summary.leaveCount + row.summary.absentCount}O
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                <TableGhostRows count={Math.max(0, pageSize - pagedMatrix.length)} colSpan={cutoffDates.length + 4} />
              </tbody>
            </table>
          </div>

          <ListPagination
            currentPage={safePage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalRecords={filteredMatrix.length}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      {/* Unified Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        records={filteredMatrix.map(r => ({
          employee_id: r.employee_id,
          name: r.name,
          designation: r.designation,
          office: r.office,
          rendered_hours: r.summary.totalHours,
          present_days: r.summary.presentCount,
          duty_24h: r.summary.duty24Count,
          night_shifts: r.summary.nightCount,
          off_days: r.summary.offCount,
          leave_days: r.summary.leaveCount,
          absent_days: r.summary.absentCount,
          total_days: r.summary.total,
        }))}
        filename={`dtr_cutoff_report_${MONTH_NAMES[selectedMonth]}_${selectedYear}_${cutoffPeriod}.xlsx`}
        sheetName="DTR Cutoff Attendance"
        columns={['employee_id', 'name', 'designation', 'office', 'rendered_hours', 'present_days', 'duty_24h', 'night_shifts', 'off_days', 'leave_days', 'absent_days', 'total_days']}
        headers={{
          employee_id: 'Employee ID',
          name: 'Employee Name',
          designation: 'Designation',
          office: 'Office',
          rendered_hours: 'Rendered Hours',
          present_days: 'Days Present',
          duty_24h: '24-Hr Duties',
          night_shifts: 'Night Shifts',
          off_days: 'Off Duty Days',
          leave_days: 'Leave Days',
          absent_days: 'Absences',
          total_days: 'Total Cutoff Days'
        }}
        onSuccess={count => toast.success(`Exported ${count} DTR attendance summaries.`)}
        onPrintPdf={handlePrintPDF}
        onError={msg => toast.error(msg)}
      />

      {/* Single Cell Quick Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isViewing ? 'Attendance Details' : 'Update Duty Shift & Attendance'}
        maxWidth="520px"
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '12px 14px', background: 'var(--primary-bg)', borderRadius: '10px', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '15px' }}>
                {formData.employee_name?.charAt(0) || 'E'}
              </div>
              <div>
                <div style={{ fontWeight: '800', fontSize: '14px' }}>{formData.employee_name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Date: {formData.date} &bull; ID: {formData.employee_id}</div>
              </div>
            </div>

            <div className="form-group">
              <label>Duty Shift Schedule *</label>
              <select
                value={formData.shift_type || 'DAY_REG'}
                onChange={e => handleShiftTypeChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-app)',
                  fontSize: '13px',
                  fontWeight: '700'
                }}
              >
                {SHIFT_TYPES.map(shift => (
                  <option key={shift.code} value={shift.code}>
                    {shift.label} — [{shift.short}]
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Time In</label>
                <input
                  type="time"
                  value={formData.time_in || ''}
                  onChange={e => {
                    const newTimeIn = e.target.value
                    const newHours = calculateRenderedHours(formData.shift_type, newTimeIn, formData.time_out)
                    setFormData(prev => ({ ...prev, time_in: newTimeIn, rendered_hours: newHours }))
                  }}
                  disabled={formData.shift_type === 'OFF' || formData.shift_type === 'LEAVE' || formData.shift_type === 'ABSENT'}
                />
              </div>

              <div className="form-group">
                <label>Time Out</label>
                <input
                  type="time"
                  value={formData.time_out || ''}
                  onChange={e => {
                    const newTimeOut = e.target.value
                    const newHours = calculateRenderedHours(formData.shift_type, formData.time_in, newTimeOut)
                    setFormData(prev => ({ ...prev, time_out: newTimeOut, rendered_hours: newHours }))
                  }}
                  disabled={formData.shift_type === 'OFF' || formData.shift_type === 'LEAVE' || formData.shift_type === 'ABSENT'}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label>Rendered Work Hours</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.rendered_hours ?? 0}
                  onChange={e => setFormData(prev => ({ ...prev, rendered_hours: Number(e.target.value) }))}
                  placeholder="e.g. 8, 12, 24"
                />
              </div>

              <div className="form-group">
                <label>Night Differential Hours</label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.night_diff_hours ?? 0}
                  onChange={e => setFormData(prev => ({ ...prev, night_diff_hours: Number(e.target.value) }))}
                  placeholder="e.g. 8"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Duty Remarks / Pass Slip / Special Notes</label>
              <textarea
                rows={3}
                value={formData.remarks || ''}
                onChange={e => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Optional notes (e.g. Shuffled duty with Team Beta, Pass slip, Typhoon Incident Standby)..."
              />
            </div>
          </fieldset>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Shift Entry'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Roster & Shift Pattern Batch Generator Modal */}
      <Modal
        isOpen={isRosterModalOpen}
        onClose={() => setIsRosterModalOpen(false)}
        title="Assign Roster Duty Schedule"
        maxWidth="540px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ padding: '12px 14px', background: 'var(--primary-bg)', borderRadius: '10px', fontSize: '13px', color: 'var(--text-main)', border: '1px solid var(--border-light)' }}>
            <strong>Cutoff Target:</strong> {cutoffPeriod === '1st' ? '1st Cutoff (Day 1–15)' : cutoffPeriod === '2nd' ? '2nd Cutoff (Day 16–End)' : 'Full Month'} of {MONTH_NAMES[selectedMonth]} {selectedYear}.
          </div>

          <div className="form-group">
            <label style={{ fontWeight: '700', marginBottom: '6px' }}>Select Team Roster Pattern *</label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', borderRadius: '8px',
                border: rosterPattern === 'REGULAR_8_5' ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                background: rosterPattern === 'REGULAR_8_5' ? 'var(--primary-bg)' : 'var(--bg-app)', cursor: 'pointer'
              }}>
                <input
                  type="radio"
                  name="rosterPattern"
                  value="REGULAR_8_5"
                  checked={rosterPattern === 'REGULAR_8_5'}
                  onChange={e => setRosterPattern(e.target.value)}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontWeight: '800', fontSize: '13px' }}>Regular Office Roster (8:00 AM – 5:00 PM)</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Monday to Friday 8-hour Day Duty, Saturdays & Sundays Off Duty.</div>
                </div>
              </label>

              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', borderRadius: '8px',
                border: rosterPattern === 'ROTATION_24H' ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                background: rosterPattern === 'ROTATION_24H' ? 'var(--primary-bg)' : 'var(--bg-app)', cursor: 'pointer'
              }}>
                <input
                  type="radio"
                  name="rosterPattern"
                  value="ROTATION_24H"
                  checked={rosterPattern === 'ROTATION_24H'}
                  onChange={e => setRosterPattern(e.target.value)}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontWeight: '800', fontSize: '13px' }}>Emergency 24-Hour Duty Rotation</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Alternating 24-Hour Emergency Duty followed by Rest Days (24h On / 24h Off).</div>
                </div>
              </label>

              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', borderRadius: '8px',
                border: rosterPattern === 'DAY_12H' ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                background: rosterPattern === 'DAY_12H' ? 'var(--primary-bg)' : 'var(--bg-app)', cursor: 'pointer'
              }}>
                <input
                  type="radio"
                  name="rosterPattern"
                  value="DAY_12H"
                  checked={rosterPattern === 'DAY_12H'}
                  onChange={e => setRosterPattern(e.target.value)}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontWeight: '800', fontSize: '13px' }}>12-Hour Day Duty Shift (6:00 AM – 6:00 PM)</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>12-hour day duty roster for active CDRRMO response personnel.</div>
                </div>
              </label>

              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px', borderRadius: '8px',
                border: rosterPattern === 'NIGHT_12H' ? '2px solid var(--primary)' : '1px solid var(--border-light)',
                background: rosterPattern === 'NIGHT_12H' ? 'var(--primary-bg)' : 'var(--bg-app)', cursor: 'pointer'
              }}>
                <input
                  type="radio"
                  name="rosterPattern"
                  value="NIGHT_12H"
                  checked={rosterPattern === 'NIGHT_12H'}
                  onChange={e => setRosterPattern(e.target.value)}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontWeight: '800', fontSize: '13px' }}>12-Hour Night Duty Shift (6:00 PM – 6:00 AM +ND)</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>12-hour overnight duty roster. Includes 8 hours Night Differential (10PM–6AM) per CSC/DBM rules.</div>
                </div>
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setIsRosterModalOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn-submit" disabled={isSaving} onClick={handleApplyRosterPattern}>
              {isSaving ? 'Applying Roster...' : 'Apply Roster Schedule'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Today's Roster Snapshot Confirmation Modal ── */}
      {isTodayRosterModalOpen && (() => {
        const formattedToday = format(new Date(), 'yyyy-MM-dd')
        const grouped = {
          present: todayRosterPreview.filter(p => p.shiftObj.status === 'Present'),
          off: todayRosterPreview.filter(p => p.shiftObj.code === 'OFF'),
          leave: todayRosterPreview.filter(p => p.shiftObj.code === 'LEAVE'),
          absent: todayRosterPreview.filter(p => p.shiftObj.code === 'ABSENT'),
        }

        const groupConfig = [
          { key: 'present', label: 'Present / On Duty', icon: 'ri-checkbox-circle-fill', color: '#16a34a', bg: '#dcfce7' },
          { key: 'off',     label: 'Off Duty (Rest Day)', icon: 'ri-moon-fill', color: '#64748b', bg: '#f1f5f9' },
          { key: 'leave',   label: 'On Leave', icon: 'ri-calendar-event-fill', color: '#d97706', bg: '#fef3c7' },
          { key: 'absent',  label: 'Absent', icon: 'ri-close-circle-fill', color: '#dc2626', bg: '#fee2e2' },
        ]

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
                padding: '20px 24px 16px', borderBottom: '1px solid var(--border-light)',
                background: 'linear-gradient(135deg, var(--primary-bg) 0%, var(--bg-surface) 100%)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px',
                      background: todayShiftSlot === 'NIGHT' ? '#7c3aed' : '#0284c7',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                    }}>
                      <i className={todayShiftSlot === 'NIGHT' ? 'ri-moon-clear-fill' : 'ri-sun-fill'} style={{ color: '#fff', fontSize: '18px' }} />
                    </div>
                    <div>
                      <div style={{ fontWeight: '800', fontSize: '16px', color: 'var(--text-primary)' }}>
                        Record Today's Duty Roster
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>
                        <strong>{formattedToday}</strong> · LGU Palayan CDRRMO · {todayRosterPreview.length} employees
                      </div>
                    </div>
                  </div>

                  {/* 2-Segment Shift Slot Selector */}
                  <div style={{ display: 'flex', background: 'var(--bg-app)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <button
                      type="button"
                      onClick={() => { setTodayShiftSlot('DAY'); buildTodayRosterPreview('DAY') }}
                      style={{
                        padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                        fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '5px',
                        background: todayShiftSlot === 'DAY' ? '#0284c7' : 'transparent',
                        color: todayShiftSlot === 'DAY' ? '#fff' : 'var(--text-muted)',
                        transition: 'all 0.15s'
                      }}
                    >
                      <i className="ri-sun-line" /> Day (6am–6pm)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setTodayShiftSlot('NIGHT'); buildTodayRosterPreview('NIGHT') }}
                      style={{
                        padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                        fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '5px',
                        background: todayShiftSlot === 'NIGHT' ? '#7c3aed' : 'transparent',
                        color: todayShiftSlot === 'NIGHT' ? '#fff' : 'var(--text-muted)',
                        transition: 'all 0.15s'
                      }}
                    >
                      <i className="ri-moon-clear-fill" /> Night (6pm–6am)
                    </button>
                  </div>
                </div>

                {/* Summary pills */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                  {groupConfig.map(g => grouped[g.key].length > 0 && (
                    <span key={g.key} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                      background: g.bg, color: g.color
                    }}>
                      <i className={g.icon} />
                      {grouped[g.key].length} {g.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Scrollable employee list */}
              <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px' }}>
                {groupConfig.map(g => grouped[g.key].length > 0 && (
                  <div key={g.key} style={{ marginBottom: '18px' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '7px',
                      fontSize: '12px', fontWeight: '800', color: g.color,
                      marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em'
                    }}>
                      <i className={g.icon} />
                      {g.label} ({grouped[g.key].length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {grouped[g.key].map(p => (
                        <div key={p.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '9px 12px', borderRadius: '8px',
                          background: g.bg, border: `1px solid ${g.color}22`
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                              {p.name}
                              {p.groupInfo && (
                                <span style={{
                                  fontSize: '10px', fontWeight: '800',
                                  padding: '1px 6px', borderRadius: '4px',
                                  background: p.groupInfo.color + '22', color: p.groupInfo.color
                                }}>{p.groupInfo.name}</span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                              {p.designation} · {p.office}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                            <span style={{
                              padding: '3px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: '800',
                              background: p.shiftObj.bg, color: p.shiftObj.color
                            }}>{p.shiftObj.short}</span>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {p.shiftObj.hours > 0 ? `${p.shiftObj.hours}h` : '–'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer Actions */}
              <div style={{
                padding: '16px 24px', borderTop: '1px solid var(--border-light)',
                display: 'flex', justifyContent: 'flex-end', gap: '10px',
                background: 'var(--bg-app)'
              }}>
                <button
                  className="btn-secondary"
                  onClick={() => setIsTodayRosterModalOpen(false)}
                  disabled={isSaving}
                  style={{ fontSize: '13px' }}
                >
                  Cancel
                </button>
                <button
                  className="btn-submit"
                  onClick={handleConfirmLogTodayRoster}
                  disabled={isSaving}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '13px' }}
                >
                  {isSaving
                    ? <><i className="ri-loader-4-line" /> Recording...</>
                    : <><i className="ri-checkbox-circle-fill" /> Lock Today's Roster</>
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
