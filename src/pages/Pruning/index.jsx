import ModuleToolbar from '../../components/ModuleToolbar'
import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { logAudit } from '../../services/audit'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import { uploadFile, deleteFiles } from '../../services/storage'
import { compressImage } from '../../utils/imageCompression'

const PRIMARY = '#16a34a' // Green color for pruning

const INITIAL_FORM_STATE = {
  record_id: '',
  location: '',
  date: '',
  trees_pruned: '',
  conducted_by: '',
  remarks: '',
  photos: []
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
  const [isDragging, setIsDragging] = useState(false)

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

  useEffect(() => {
    loadRecords()
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
      trees_pruned: rec.trees_pruned || '',
      conducted_by: rec.conducted_by || '',
      remarks: rec.remarks || '',
      photos: rec.photos || []
    })
    setIsModalOpen(true)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleDragOver = (e) => {
    if (isViewing) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    if (isViewing) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    if (isViewing) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload({ target: { files: e.dataTransfer.files } });
    }
  };

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
          onSearch={setSearchTerm}
          onFilterChange={setFilter}
          onDateRangeChange={setDateRange}
          exportData={filteredRecords}
          exportFilename="pruning_report.xlsx"
        />
      )}

      {records.length === 0 ? (
        <div className="empty-state">
          <i className="ri-scissors-line"></i>
          <h3>No Pruning Records</h3>
          <p>Click "Log Pruning/Trimming" to create your first tree maintenance log.</p>
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Location</th>
                <th>Date</th>
                <th>Trees Pruned</th>
                <th>Conducted By</th>
                <th>Remarks</th>
                <th>Photos</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr 
                  key={record.id}
                  onClick={() => handleViewDetails(record)}
                  style={{ cursor: 'pointer' }}
                  className="table-row-clickable"
                >
                  <td><code style={{ fontWeight: '700' }}>{record.record_id || '-'}</code></td>
                  <td style={{ fontWeight: '700' }}>{record.location || '-'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                    {record.date 
                      ? format(new Date(record.date), 'MMM dd, yyyy')
                      : '-'}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '15px' }}>{record.trees_pruned || 0}</td>
                  <td>{record.conducted_by || '-'}</td>
                  <td>
                    <div style={{
                      maxWidth: '250px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '13px',
                      color: 'var(--text-muted)'
                    }}>
                      {record.remarks || '-'}
                    </div>
                  </td>
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
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{
        marginTop: '16px',
        fontSize: '14px',
        color: 'var(--text-muted)',
        textAlign: 'center'
      }}>
        Showing <strong>{filteredRecords.length}</strong> of <strong>{records.length}</strong>
      </div>

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
                      <label>Record ID *</label>
                      <input 
                        type="text" 
                        name="record_id" 
                        value={formData.record_id} 
                        onChange={handleInputChange} 
                        required 
                        disabled style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280' }} />
                    </div>
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
              <div style={{ minHeight: '350px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                <h4 style={{ margin: '0 0 12px 0', color: 'var(--primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Photos
                  {!isViewing && (
                    <div style={{ position: 'relative' }}>
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        onChange={handleFileUpload}
                        disabled={isUploading || isSaving}
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', zIndex: 10 }} 
                      />
                      <button 
                        type="button" 
                        className="btn-primary" 
                        disabled={isUploading || isSaving}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        {(isUploading || isSaving) ? <i className="ri-loader-4-line ri-spin" style={{ fontSize: '16px' }}></i> : <i className="ri-camera-line" style={{ fontSize: '16px' }}></i>}
                        {(isUploading || isSaving) ? 'Uploading...' : 'Add Photos'}
                      </button>
                    </div>
                  )}
                </h4>
                
                {(!formData.photos || formData.photos.length === 0) && pendingPhotos.length === 0 ? (
                  <div 
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '40px 20px',
                      textAlign: 'center',
                      background: isDragging ? 'var(--primary-bg)' : '#f8fafc',
                      borderRadius: '8px',
                      border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border-light)'}`,
                      color: isDragging ? 'var(--primary)' : 'var(--text-muted)',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}>
                    {!isViewing && (
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        onChange={handleFileUpload}
                        disabled={isUploading || isSaving}
                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: isDragging ? 'copy' : 'pointer', zIndex: 10 }} 
                      />
                    )}
                    <i className="ri-image-line" style={{ fontSize: '48px', color: isDragging ? 'var(--primary)' : 'var(--border-light)', transition: 'all 0.2s' }}></i>
                    <p style={{ marginTop: '12px', fontWeight: '600' }}>{isDragging ? 'Drop photos here' : 'No photos uploaded yet.'}</p>
                    {!isViewing && <p style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>Drag and drop or click to upload</p>}
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                    gap: '12px'
                  }}>
                    {formData.photos && formData.photos.map((url, idx) => (
                      <div key={`existing-${idx}`} style={{ 
                        position: 'relative', 
                        aspectRatio: '1', 
                        borderRadius: '8px', 
                        overflow: 'hidden',
                        border: '1px solid var(--border-light)'
                      }}>
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          <img 
                            src={url} 
                            alt={`Photo ${idx + 1}`} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          />
                        </a>
                        {!isViewing && (
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); removeExistingPhoto(idx); }}
                            style={{
                              position: 'absolute',
                              top: '6px',
                              right: '6px',
                              background: 'rgba(239, 68, 68, 0.9)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '50%',
                              width: '24px',
                              height: '24px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                            }}
                          >
                            <i className="ri-close-line" style={{ fontSize: '14px' }}></i>
                          </button>
                        )}
                      </div>
                    ))}

                    {pendingPhotos.map((file, idx) => {
                      const objectUrl = URL.createObjectURL(file);
                      return (
                        <div key={`pending-${idx}`} style={{ 
                          position: 'relative', 
                          aspectRatio: '1', 
                          borderRadius: '8px', 
                          overflow: 'hidden',
                          border: '1px solid var(--primary)',
                          opacity: isUploading ? 0.6 : 1
                        }}>
                          <img 
                            src={objectUrl} 
                            alt={`Pending photo ${idx + 1}`} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            onLoad={() => URL.revokeObjectURL(objectUrl)}
                          />
                          {!isViewing && !isUploading && (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); removePendingPhoto(idx); }}
                              style={{
                                position: 'absolute',
                                top: '6px',
                                right: '6px',
                                background: 'rgba(239, 68, 68, 0.9)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '50%',
                                width: '24px',
                                height: '24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                              }}
                            >
                              <i className="ri-close-line" style={{ fontSize: '14px' }}></i>
                            </button>
                          )}
                          {isUploading && (
                            <div style={{
                              position: 'absolute', inset: 0, display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                              background: 'rgba(255,255,255,0.5)'
                            }}>
                              <i className="ri-loader-4-line ri-spin" style={{ fontSize: '24px', color: 'var(--primary)' }}></i>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
