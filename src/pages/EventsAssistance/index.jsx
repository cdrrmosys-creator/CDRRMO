import ModuleToolbar from '../../components/ModuleToolbar'
import ListPagination from '../../components/ListPagination'
import ExportModal from '../../components/ExportModal'
import TableGhostRows from '../../components/TableGhostRows'
import useListPagination from '../../hooks/useListPagination'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../services/supabase'
import { logAudit } from '../../services/audit'
import { format, parseISO } from 'date-fns'
import { printPDF } from '../../utils/printPDF'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'
import CalendarView from '../../components/CalendarView'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const INITIAL_FORM_STATE = {
  record_id: '',
  event_name: '',
  date: '',
  location: '',
  type_of_assistance: '',
  requestor: '',
  description: '',
  remarks: '',
  created_by: '',
  updated_by: '',
  created_at: '',
  updated_at: ''
}

export default function EventsAssistance() {
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
  const isAdmin = useIsAdmin()
  const { canCreate, canUpdate, canDelete } = usePermissions('events-assistance')
  const toast = useToast()
  const confirm = useConfirm()


  // Toolbar states
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [viewMode, setViewMode] = useState('list')
  const [currentMonth, setCurrentMonth] = useState(new Date())

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

  const handlePrintPDF = () => {
    printPDF({
      title: 'Events Assistance Report',
      subtitle: `${filteredRecords.length} records`,
      columns: [
        { header: 'Date', key: 'date', format: v => v ? format(new Date(v), 'MMM dd, yyyy') : '—' },
        { header: 'Event Name', key: 'event_name' },
        { header: 'Type of Assistance', key: 'type_of_assistance' },
        { header: 'Location', key: 'location' },
        { header: 'Requestor', key: 'requestor' },
      ],
      records: filteredRecords,
    })
  }

  // Available years derived from records
  const availableYears = useMemo(() => {
    const years = new Set()
    records.forEach(rec => {
      if (rec.date) years.add(parseISO(rec.date).getFullYear())
    })
    years.add(new Date().getFullYear())
    return Array.from(years).sort((a, b) => b - a)
  }, [records])

  // Build monthly trend data for selected year
  const monthlyTrend = useMemo(() => {
    const months = []
    for (let m = 0; m < 12; m++) {
      const d = new Date(selectedYear, m, 1)
      months.push({
        key: `${selectedYear}-${String(m + 1).padStart(2, '0')}`,
        label: format(d, 'MMM'),
        count: 0
      })
    }
    records.forEach(rec => {
      if (!rec.date) return
      const d = parseISO(rec.date)
      if (d.getFullYear() !== selectedYear) return
      const key = `${selectedYear}-${String(d.getMonth() + 1).padStart(2, '00')}`
      const m = months.find(x => x.key === key)
      if (m) m.count++
    })
    return months
  }, [records, selectedYear])

  const loadRecords = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('events_assistance')
        .select('*')
        .order('date', { ascending: false })
      
      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Error loading events assistance records:', err)
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
      record_id: `AST-${year}-${rand}`,
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
      event_name: rec.event_name || '',
      date: rec.date || '',
      location: rec.location || '',
      type_of_assistance: rec.type_of_assistance || '',
      requestor: rec.requestor || '',
      description: rec.description || '',
      remarks: rec.remarks || '',
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
          .from('events_assistance')
          .update(formData)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setRecords(filteredRecords.map(rec => rec.id === selectedId ? data[0] : rec))
        await logAudit('Updated', 'EventsAssistance', formData.record_id || formData.id || selectedId, 'Updated record details')
        toast.success('Assistance record updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('events_assistance')
          .insert([formData])
          .select()

        if (error) throw error
        setRecords([data[0], ...records])
        await logAudit('Added', 'EventsAssistance', formData.record_id || data[0].record_id || data[0].id, 'Created new record')
        toast.success('Assistance record added successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving events assistance record:', err)
      toast.error('Error saving record: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    const ok = await confirm('This record will be permanently removed. This action cannot be undone.', { title: 'Delete Record' })
    if (!ok) return

    try {
      const { error } = await supabase
        .from('events_assistance')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setRecords(records.filter(rec => rec.id !== id))
      await logAudit('Deleted', 'EventsAssistance', id, 'Deleted record')
      toast.success('Assistance record deleted successfully!')
    } catch (err) {
      console.error('Error deleting events assistance record:', err)
      toast.error('Failed to delete record: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading events assistance records...</p>
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
          <i className="ri-calendar-event-line" style={{ marginRight: '12px' }}></i>
          Events Assistance
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
            Request Assistance
          </button>
        </div>
      </div>

      
      {/* Monthly Trend Line Chart */}
      {records.length > 0 && (
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          marginBottom: '24px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
                <i className="ri-line-chart-line" style={{ marginRight: '8px', color: 'var(--primary)' }}></i>
                Events Needing Assistance per Month
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>Monthly breakdown for selected year</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--primary)' }}>
                  {monthlyTrend.reduce((s, m) => s + m.count, 0)}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>TOTAL IN {selectedYear}</div>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyTrend} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '8px', fontSize: '13px' }}
                formatter={(value) => [value, 'Events']}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="var(--primary)"
                strokeWidth={2.5}
                dot={{ r: 4, fill: 'var(--primary)', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {records.length > 0 && (
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
            title: r.event_name,
            date: r.date,
            color: '#3b82f6',
            onClick: () => handleViewDetails(r)
          }))}
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
        />
      ) : (
        <>
        {records.length === 0 ? (
          <div className="empty-state">
            <i className="ri-calendar-event-line"></i>
            <h3>No Assistance Requests</h3>
            <p>Click "Request Assistance" to add a new record.</p>
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
                <th>Date</th>
                <th>Event Name</th>
                <th>Type of Assistance</th>
                <th>Location</th>
                <th>Requestor</th>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span>{record.date ? format(new Date(record.date), 'MMM dd, yyyy') : '-'}</span>
                      {record.created_by && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'inherit' }}>
                          <i className="ri-user-line" style={{ fontSize: '12px' }}></i>
                          {record.created_by.split('@')[0]}
                          {record.updated_by && record.updated_by !== record.created_by && (
                            <span style={{ marginLeft: '6px', color: 'var(--text-muted)' }}>
                              • updated by: {record.updated_by.split('@')[0]}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </td>
                  <td><span style={{ fontWeight: '700' }}>{record.event_name || '-'}</span></td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '700',
                      background: '#dbeafe',
                      color: '#1e40af'
                    }}>
                      {record.type_of_assistance || '-'}
                    </span>
                  </td>
                  <td>{record.location || '-'}</td>
                  <td>{record.requestor || '-'}</td>
                </tr>
              ))}
              <TableGhostRows count={pageSize - pagedRecords.length} colSpan={6} />
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
        filename="eventsassistance_report.xlsx"
        sheetName="Events Assistance"
        dateField="date"
        onSuccess={(count) => toast.success(`Exported ${count} records successfully.`)}
        onError={(msg) => toast.error(msg)}
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isViewing ? 'View Details' : (isEditing ? 'Edit Assistance Request' : 'Request Event Assistance')}
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
          <div className="form-row">
            
            <div className="form-group">
              <label>Event Name *</label>
              <input 
                type="text" 
                name="event_name" 
                value={formData.event_name} 
                onChange={handleInputChange} 
                required 
                placeholder="e.g. City Charter Day Parade"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Date *</label>
              <input 
                type="date" 
                name="date" 
                value={formData.date} 
                onChange={handleInputChange} 
                required 
              />
            </div>
            <div className="form-group">
              <label>Location *</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Type of Assistance *</label>
              <input 
                type="text" 
                name="type_of_assistance" 
                value={formData.type_of_assistance} 
                onChange={handleInputChange} 
                required 
                placeholder="e.g. Ambulance Standby, First-Aid Station"
              />
            </div>
            <div className="form-group">
              <label>Requestor / Agency</label>
              <input 
                type="text" 
                name="requestor" 
                value={formData.requestor} 
                onChange={handleInputChange} 
                placeholder="e.g. LGU Palayan - Tourism Office"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Description (Optional)</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              placeholder="Provide a description of the assistance needed..."
            />
          </div>

          <div className="form-group">
            <label>Remarks (Optional)</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleInputChange}
              rows={2}
              placeholder="Additional notes or remarks..."
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
  )
}
