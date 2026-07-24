import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../services/supabase'
import { logAudit } from '../../services/audit'
import { format } from 'date-fns'
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
  remarks: '',
}

const ATTENDANCE_STATUS_OPTIONS = [
  { value: 'Present', label: 'Present', icon: 'ri-checkbox-circle-fill', bg: '#dcfce7', color: '#16a34a' },
  { value: 'Off Duty', label: 'Off Duty', icon: 'ri-moon-fill', bg: '#f1f5f9', color: '#475569' },
  { value: 'On Leave', label: 'On Leave', icon: 'ri-calendar-event-fill', bg: '#fef3c7', color: '#d97706' },
  { value: 'Absent', label: 'Absent', icon: 'ri-close-circle-fill', bg: '#fee2e2', color: '#dc2626' },
]

export default function Attendance() {
  const isAdmin = useIsAdmin()
  const permissions = usePermissions('attendance')
  const toast = useToast()
  const confirm = useConfirm()

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [employees, setEmployees] = useState([])
  const [attendanceLogs, setAttendanceLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isViewing, setIsViewing] = useState(false)
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [formData, setFormData] = useState(INITIAL_FORM_STATE)

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

      // Attempt to fetch custom attendance overrides from employee_attendance table
      try {
        const { data: attData, error: attErr } = await supabase
          .from('employee_attendance')
          .select('*')
        if (!attErr && attData) {
          setAttendanceLogs(attData)
        }
      } catch (err) {
        console.info('Custom employee_attendance table not available, using roster duty status logic.')
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

  // Auto-record / derive attendance status for each employee for the selected date
  const dateAttendanceRecords = useMemo(() => {
    return employees.map(emp => {
      // Check if there is an explicit log entry for this date and employee
      const existingLog = attendanceLogs.find(
        log => log.employee_id === (emp.employee_id || emp.id) && log.date === selectedDate
      )

      if (existingLog) {
        return {
          id: existingLog.id || `att-${emp.id}`,
          record_id: existingLog.record_id || `ATT-${selectedDate}-${emp.employee_id || emp.id}`,
          employee_id: emp.employee_id || emp.id,
          employee_name: emp.name || 'Unnamed Employee',
          designation: emp.designation || 'Staff',
          office: emp.office || 'CDRRMO',
          duty_status: existingLog.duty_status || emp.duty_status || 'On Duty',
          status: existingLog.status || (emp.duty_status === 'On Duty' ? 'Present' : emp.duty_status || 'Present'),
          date: selectedDate,
          time_in: existingLog.time_in || '08:00',
          time_out: existingLog.time_out || '17:00',
          remarks: existingLog.remarks || '',
          emp_photo: emp.photo_url || emp.photo,
        }
      }

      // Default Automatic Recording:
      // When an employee is "On Duty" → Present
      // When "On Leave" → On Leave
      // When "Standby" → Present (on standby = on duty)
      // When "Off Duty" → Off Duty
      const dutyStatus = emp.duty_status || 'On Duty'
      let autoStatus = 'Present'
      if (dutyStatus === 'On Duty' || dutyStatus === 'Standby') autoStatus = 'Present'
      else if (dutyStatus === 'On Leave') autoStatus = 'On Leave'
      else autoStatus = 'Off Duty'

      return {
        id: `auto-${emp.id}`,
        record_id: `ATT-${selectedDate}-${emp.employee_id || emp.id}`,
        employee_id: emp.employee_id || emp.id,
        employee_name: emp.name || 'Unnamed Employee',
        designation: emp.designation || 'Staff',
        office: emp.office || 'CDRRMO Headquarters',
        duty_status: dutyStatus,
        status: autoStatus,
        date: selectedDate,
        time_in: undefined,
        time_out: undefined,
        remarks: dutyStatus === 'On Duty' ? 'Auto-recorded On Duty'
                : dutyStatus === 'Standby' ? 'Auto-recorded Standby'
                : dutyStatus === 'On Leave' ? 'Auto-recorded On Leave'
                : '',
        emp_photo: emp.photo_url || emp.photo,
      }
    })
  }, [employees, attendanceLogs, selectedDate])

  // Filtered attendance records based on toolbar controls
  const filteredRecords = useMemo(() => {
    return dateAttendanceRecords.filter(rec => {
      let matchesSearch = true
      if (searchTerm) {
        const q = searchTerm.toLowerCase()
        matchesSearch =
          rec.employee_name?.toLowerCase().includes(q) ||
          rec.employee_id?.toLowerCase().includes(q) ||
          rec.designation?.toLowerCase().includes(q) ||
          rec.office?.toLowerCase().includes(q) ||
          rec.status?.toLowerCase().includes(q)
      }

      const matchesStatus = !filter || rec.status === filter

      let matchesDate = true
      if (dateRange.start && dateRange.end) {
        const d = new Date(rec.date)
        const start = new Date(dateRange.start)
        const end = new Date(dateRange.end)
        end.setHours(23, 59, 59, 999)
        matchesDate = d >= start && d <= end
      }

      return matchesSearch && matchesStatus && matchesDate
    })
  }, [dateAttendanceRecords, searchTerm, filter, dateRange])

  // KPI Summary Counts
  const kpiCounts = useMemo(() => {
    const present = dateAttendanceRecords.filter(r => r.status === 'Present').length
    const leave = dateAttendanceRecords.filter(r => r.status === 'On Leave').length
    const offDuty = dateAttendanceRecords.filter(r => r.status === 'Off Duty').length
    const absent = dateAttendanceRecords.filter(r => r.status === 'Absent').length
    return { total: dateAttendanceRecords.length, present, leave, offDuty, absent }
  }, [dateAttendanceRecords])

  const { totalPages, safePage, pagedRecords } = useListPagination(filteredRecords)

  // Open modal to view details
  const handleViewDetails = (rec) => {
    setFormData(rec)
    setIsViewing(true)
    setIsEditing(false)
    setIsModalOpen(true)
  }

  // Open modal to edit attendance
  const handleOpenEdit = (e, rec) => {
    e.stopPropagation()
    setFormData(rec)
    setIsViewing(false)
    setIsEditing(true)
    setIsModalOpen(true)
  }

  // Submit attendance form update
  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      // 1. Update local attendance state
      const updatedLog = {
        id: formData.id.startsWith('auto-') ? `log-${Date.now()}` : formData.id,
        record_id: formData.record_id,
        employee_id: formData.employee_id,
        employee_name: formData.employee_name,
        designation: formData.designation,
        office: formData.office,
        date: formData.date,
        status: formData.status,
        duty_status: formData.duty_status,
        time_in: formData.time_in,
        time_out: formData.time_out,
        remarks: formData.remarks,
      }

      // Try saving to employee_attendance in Supabase
      try {
        const { error: attErr } = await supabase
          .from('employee_attendance')
          .upsert([updatedLog])
        if (attErr) console.info('Supabase employee_attendance table notice:', attErr.message)
      } catch (err) {
        console.info('Supabase attendance save notice:', err.message)
      }

      // Also update employee's duty status if changed
      try {
        await supabase
          .from('employees')
          .update({ duty_status: formData.duty_status })
          .eq('employee_id', formData.employee_id)
      } catch (err) {
        // Ignored if employee_id matches uuid
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

      await logAudit('Updated', 'Attendance', formData.record_id, `Updated attendance for ${formData.employee_name} (${formData.status})`)
      toast.success(`Attendance updated for ${formData.employee_name}!`)
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving attendance update:', err)
      toast.error('Failed to update attendance: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // PDF Export callback
  const handlePrintPDF = (overrideRecords) => {
    const list = overrideRecords ?? filteredRecords
    printPDF({
      title: `Employee Attendance Report — ${format(new Date(selectedDate), 'MMMM dd, yyyy')}`,
      subtitle: `${list.length} employee attendance records`,
      columns: [
        { header: 'Employee ID', key: 'employee_id' },
        { header: 'Employee Name', key: 'employee_name' },
        { header: 'Designation', key: 'designation' },
        { header: 'Office', key: 'office' },
        { header: 'Duty Status', key: 'duty_status' },
        { header: 'Attendance', key: 'status' },
        { header: 'Remarks', key: 'remarks' },
      ],
      records: list,
    })
  }

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading attendance roster...</p>
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
          <h2>Employee Attendance</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Employees marked On Duty are automatically recorded Present for the day.
          </p>
        </div>

        {/* Date Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-surface)', padding: '8px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
          <i className="ri-calendar-event-line" style={{ fontSize: '18px', color: 'var(--primary)' }} />
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>Attendance Date:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={e => { setSelectedDate(e.target.value); setCurrentPage(1); }}
            style={{
              padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border-light)',
              background: 'var(--bg-app)', fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', cursor: 'pointer'
            }}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Roster</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
              <i className="ri-team-line" />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-main)' }}>{kpiCounts.total}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Total Personnel Listed</div>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Present Today</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
              <i className="ri-checkbox-circle-line" />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#16a34a' }}>{kpiCounts.present}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Auto-recorded On Duty</div>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.5px' }}>On Leave / Off</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
              <i className="ri-moon-line" />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#d97706' }}>{kpiCounts.leave + kpiCounts.offDuty}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Off Duty or Leave</div>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Absent</span>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
              <i className="ri-close-circle-line" />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#dc2626' }}>{kpiCounts.absent}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Marked Absent</div>
        </div>
      </div>

      {/* Toolbar */}
      <ModuleToolbar
        onSearch={v => { setSearchTerm(v); setCurrentPage(1); }}
        filterOptions={[
          { value: 'Present', label: 'Present' },
          { value: 'Off Duty', label: 'Off Duty' },
          { value: 'On Leave', label: 'On Leave' },
          { value: 'Absent', label: 'Absent' },
        ]}
        filterLabel="All Attendance Status"
        filterColorMap={{
          'Present': { bg: '#dcfce7', color: '#16a34a', icon: 'ri-checkbox-circle-fill' },
          'Off Duty': { bg: '#f1f5f9', color: '#475569', icon: 'ri-moon-fill' },
          'On Leave': { bg: '#fef3c7', color: '#d97706', icon: 'ri-calendar-event-fill' },
          'Absent': { bg: '#fee2e2', color: '#dc2626', icon: 'ri-close-circle-fill' },
        }}
        onFilterChange={v => { setFilter(v); setCurrentPage(1); }}
        onDateRangeChange={r => { setDateRange(r); setCurrentPage(1); }}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        onExportClick={() => setIsExportOpen(true)}
        onClearFilters={() => { setSearchTerm(''); setFilter(''); setDateRange({ start: '', end: '' }); setCurrentPage(1); }}
        hasActiveFilters={Boolean(searchTerm || filter || dateRange.start || dateRange.end)}
      />

      {/* Table */}
      {employees.length === 0 ? (
        <div className="empty-state">
          <i className="ri-team-line" />
          <h3>No Employees Found</h3>
          <p>Add employees in the Employees module to start recording attendance.</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="empty-state">
          <i className="ri-filter-off-line" />
          <h3>No Matching Attendance Records</h3>
          <p>Try adjusting your search query or status filter.</p>
        </div>
      ) : (
        <>
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>Employee Name</th>
                  <th style={{ width: '20%' }}>Designation & Office</th>
                  <th style={{ width: '16%' }}>Duty Status</th>
                  <th style={{ width: '18%' }}>Attendance</th>
                  <th style={{ width: '18%' }}>Remarks</th>
                  <th style={{ width: '6%', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedRecords.map(record => {
                  const statusOpt = ATTENDANCE_STATUS_OPTIONS.find(o => o.value === record.status) || ATTENDANCE_STATUS_OPTIONS[0]
                  return (
                    <tr
                      key={record.id}
                      onClick={() => handleViewDetails(record)}
                      style={{ cursor: 'pointer' }}
                      className="table-row-clickable"
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '34px', height: '34px', borderRadius: '50%', background: 'var(--primary-bg)', color: 'var(--primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '13px', flexShrink: 0
                          }}>
                            {record.employee_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', fontSize: '13.5px' }}>{record.employee_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              ID: {record.employee_id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: '600', fontSize: '13px' }}>{record.designation}</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{record.office}</div>
                      </td>
                      <td>
                        <span style={{
                          padding: '4px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: '700',
                          background: record.duty_status === 'On Duty' ? '#dcfce7' : '#f1f5f9',
                          color: record.duty_status === 'On Duty' ? '#16a34a' : '#475569',
                          display: 'inline-flex', alignItems: 'center', gap: '4px'
                        }}>
                          <i className={record.duty_status === 'On Duty' ? 'ri-shield-check-line' : 'ri-moon-line'} />
                          {record.duty_status}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          padding: '4px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: '700',
                          background: statusOpt.bg, color: statusOpt.color,
                          display: 'inline-flex', alignItems: 'center', gap: '5px'
                        }}>
                          <i className={statusOpt.icon} />
                          {record.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {record.remarks || '—'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        {(isAdmin || permissions.can_edit) && (
                          <button
                            className="btn-icon btn-edit"
                            onClick={e => handleOpenEdit(e, record)}
                            title="Update Attendance"
                          >
                            <i className="ri-edit-line" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
                <TableGhostRows count={Math.max(0, pageSize - pagedRecords.length)} colSpan={6} />
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

      {/* Unified Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        records={filteredRecords}
        filename={`attendance_report_${selectedDate}.xlsx`}
        sheetName="Attendance"
        dateField="date"
        columns={['record_id', 'date', 'employee_id', 'employee_name', 'designation', 'office', 'duty_status', 'status', 'remarks']}
        headers={{
          record_id: 'Record ID',
          date: 'Date',
          employee_id: 'Employee ID',
          employee_name: 'Employee Name',
          designation: 'Designation',
          office: 'Office',
          duty_status: 'Duty Status',
          status: 'Attendance Status',
          remarks: 'Remarks'
        }}
        onSuccess={count => toast.success(`Exported ${count} attendance records successfully.`)}
        onPrintPdf={handlePrintPDF}
        onError={msg => toast.error(msg)}
      />

      {/* Edit / View Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isViewing ? 'Attendance Details' : 'Update Employee Attendance'}
        maxWidth="600px"
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '14px', background: 'var(--primary-bg)', borderRadius: '10px', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '16px' }}>
                {formData.employee_name?.charAt(0) || 'E'}
              </div>
              <div>
                <div style={{ fontWeight: '800', fontSize: '15px' }}>{formData.employee_name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formData.designation} &bull; {formData.office} &bull; ID: {formData.employee_id}</div>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Attendance Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label>Duty Status</label>
                <select
                  value={formData.duty_status}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    duty_status: e.target.value,
                    status: e.target.value === 'On Duty' ? 'Present' : (e.target.value === 'On Leave' ? 'On Leave' : 'Off Duty')
                  }))}
                >
                  <option value="On Duty">On Duty</option>
                  <option value="Off Duty">Off Duty</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Standby">Standby</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Attendance Record Status *</label>
              <StatusSelect
                value={formData.status}
                onChange={val => setFormData(prev => ({ ...prev, status: val }))}
                options={ATTENDANCE_STATUS_OPTIONS.map(opt => ({
                  value: opt.value,
                  label: opt.label,
                  icon: opt.icon,
                  bg: opt.bg,
                  color: opt.color
                }))}
              />
            </div>

            <div className="form-group">
              <label>Remarks / Notes</label>
              <textarea
                rows={3}
                value={formData.remarks}
                onChange={e => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Optional attendance remarks (e.g., On official business, Field duty, Approved leave)..."
              />
            </div>
          </fieldset>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
              {isViewing ? 'Close' : 'Cancel'}
            </button>
            {!isViewing && (
              <button type="submit" className="btn-submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Attendance'}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  )
}
