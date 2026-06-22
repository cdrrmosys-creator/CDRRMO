import ModuleToolbar from '../../components/ModuleToolbar'
import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { logAudit } from '../../services/audit'
import { format } from 'date-fns'
import Modal from '../../components/Modal'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/ConfirmDialog'

const INITIAL_FORM_STATE = {
  record_id: '',
  client_name: '',
  gender: '',
  age: '',
  contact_number: '',
  office_name: '',
  service_provided: '',
  date: '',
  q1_timeliness: '',
  q2_expectation: '',
  q3_facilities: '',
  q4_information: '',
  q5_integrity: '',
  q6_competence: '',
  q7_overall: '',
  feedback: ''
}

const GENDER_OPTIONS = ['Male', 'Female', 'Rather not say']

const RATING_OPTIONS = [
  { value: 5, label: '(5) Lubos na sumasang ayon' },
  { value: 4, label: '(4) Sumasang ayon' },
  { value: 3, label: '(3) Sumasang ayon o hindi sumasangayon' },
  { value: 2, label: '(2) Hindi Sumasang ayon' },
  { value: 1, label: '(1) Lubos na hindi Sumasang ayon' }
]

const QUESTIONS = [
  { key: 'q1_timeliness', label: '1. Maagap na naibigay ang serbisyo sa kliyente.' },
  { key: 'q2_expectation', label: '2. Naisagawa ang serbisyo ayon sa inaasahan ng kliyente.' },
  { key: 'q3_facilities', label: '3. May maayos at angkop na pasilidad at sistema para sa serbisyo.' },
  { key: 'q4_information', label: '4. May sapat na impormasyon na madaling maunawaan at may mekanismo para matugunan ang mga puna o mungkahi.' },
  { key: 'q5_integrity', label: '5. Naglingkod nang may katapatan at mataas na integridad.' },
  { key: 'q6_competence', label: '6. Naibigay ang serbisyo nang may sapat na kakayahan at kaalaman.' },
  { key: 'q7_overall', label: '7. Nakamit ang kabuuang serbisyong inaasahan.' }
]

export default function ClientSatisfaction() {
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
  const toast = useToast()
  const confirm = useConfirm()

  // Toolbar states
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  useEffect(() => {
    loadRecords()
  }, [])

  const filteredRecords = records.filter(item => {
    let matchesSearch = true
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase()
      matchesSearch = Object.values(item).some(val => 
        val && typeof val === 'string' && val.toLowerCase().includes(lowerSearch)
      )
    }
    
    let matchesFilter = true // Can implement specific filters later if needed
    
    let matchesDate = true
    if (dateRange.start && dateRange.end) {
      const dateStr = item.date || item.created_at
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
        .from('client_satisfaction')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setRecords(data || [])
    } catch (err) {
      console.error('Error loading client satisfaction records:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetails = (rec) => {
    handleOpenEdit(rec)
    setIsViewing(true)
  }

  const handleEditFromView = () => {
    setIsViewing(false)
  }

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
      record_id: `CSM-${year}-${rand}`,
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
      client_name: rec.client_name || '',
      gender: rec.gender || '',
      age: rec.age || '',
      contact_number: rec.contact_number || '',
      office_name: rec.office_name || '',
      service_provided: rec.service_provided || '',
      date: rec.date || '',
      q1_timeliness: rec.q1_timeliness || '',
      q2_expectation: rec.q2_expectation || '',
      q3_facilities: rec.q3_facilities || '',
      q4_information: rec.q4_information || '',
      q5_integrity: rec.q5_integrity || '',
      q6_competence: rec.q6_competence || '',
      q7_overall: rec.q7_overall || '',
      feedback: rec.feedback || ''
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

    // Ensure numeric values for age and ratings are properly typed
    const payload = {
      ...formData,
      age: formData.age ? parseInt(formData.age, 10) : null,
      q1_timeliness: formData.q1_timeliness ? parseInt(formData.q1_timeliness, 10) : null,
      q2_expectation: formData.q2_expectation ? parseInt(formData.q2_expectation, 10) : null,
      q3_facilities: formData.q3_facilities ? parseInt(formData.q3_facilities, 10) : null,
      q4_information: formData.q4_information ? parseInt(formData.q4_information, 10) : null,
      q5_integrity: formData.q5_integrity ? parseInt(formData.q5_integrity, 10) : null,
      q6_competence: formData.q6_competence ? parseInt(formData.q6_competence, 10) : null,
      q7_overall: formData.q7_overall ? parseInt(formData.q7_overall, 10) : null,
    }

    try {
      if (isEditing) {
        const { data, error } = await supabase
          .from('client_satisfaction')
          .update(payload)
          .eq('id', selectedId)
          .select()

        if (error) throw error
        setRecords(filteredRecords.map(rec => rec.id === selectedId ? data[0] : rec))
        await logAudit('Updated', 'Client Satisfaction', formData.record_id || formData.id || selectedId, 'Updated survey record details')
        toast.success('Client Satisfaction record updated successfully!')
      } else {
        const { data, error } = await supabase
          .from('client_satisfaction')
          .insert([payload])
          .select()

        if (error) throw error
        setRecords([data[0], ...records])
        await logAudit('Added', 'Client Satisfaction', formData.record_id || data[0].record_id || data[0].id, 'Created new survey record')
        toast.success('Client Satisfaction record added successfully!')
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving CSM record:', err)
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
        .from('client_satisfaction')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      setRecords(records.filter(rec => rec.id !== id))
      await logAudit('Deleted', 'Client Satisfaction', id, 'Deleted survey record')
      toast.success('Record deleted successfully!')
    } catch (err) {
      console.error('Error deleting CSM record:', err)
      toast.error('Failed to delete record: ' + err.message)
    }
  }

  const getAverageScore = (rec) => {
    const scores = [
      rec.q1_timeliness, rec.q2_expectation, rec.q3_facilities,
      rec.q4_information, rec.q5_integrity, rec.q6_competence, rec.q7_overall
    ].filter(v => v !== null && v !== undefined && v !== '')
    
    if (scores.length === 0) return '-'
    
    const sum = scores.reduce((a, b) => a + parseInt(b, 10), 0)
    return (sum / scores.length).toFixed(2)
  }

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading survey records...</p>
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
          <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Error Loading Client Satisfaction</h3>
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
          <i className="ri-emotion-happy-line" style={{ marginRight: '12px' }}></i>
          Client Satisfaction Measurement
        </h2>
        <button className="btn-add" onClick={handleOpenAdd} style={{ display: isAdmin ? '' : 'none' }}>
          <i className="ri-add-line"></i>
          Encode Survey
        </button>
      </div>

      
      {records.length > 0 && (
        <ModuleToolbar 
          onSearch={setSearchTerm}
          onFilterChange={setFilter}
          onDateRangeChange={setDateRange}
          exportData={filteredRecords}
          exportFilename="client_satisfaction_report.xlsx"
        />
      )}

      {records.length === 0 ? (
        <div className="empty-state">
          <i className="ri-emotion-happy-line"></i>
          <h3>No Client Satisfaction Surveys</h3>
          <p>Click "Encode Survey" to log your first client feedback.</p>
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>Record ID</th>
                <th>Client Name</th>
                <th>Date</th>
                <th>Service Provided</th>
                <th>Overall Rating</th>
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
                  <td style={{ fontWeight: '700' }}>{record.client_name || '-'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '600' }}>
                    {record.date 
                      ? format(new Date(record.date), 'MMM dd, yyyy')
                      : '-'}
                  </td>
                  <td>{record.service_provided || '-'}</td>
                  <td>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '700',
                      background: '#fef3c7',
                      color: '#92400e'
                    }}>
                      <i className="ri-star-fill" style={{ color: '#f59e0b' }}></i>
                      {getAverageScore(record)} / 5
                    </span>
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
        title={isViewing ? 'View Survey Details' : (isEditing ? 'Edit Survey Record' : 'Encode Client Satisfaction Survey')}
        maxWidth="800px"
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <fieldset disabled={isViewing} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
            
            <h4 style={{ margin: '0 0 16px 0', paddingBottom: '8px', borderBottom: '1px solid var(--border-light)', color: 'var(--primary)' }}>Client Information</h4>
            
            <div className="form-row">
              <div className="form-group">
                <label>Client Name *</label>
                <input 
                  type="text" 
                  name="client_name" 
                  value={formData.client_name} 
                  onChange={handleInputChange} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Gender *</label>
                <select name="gender" value={formData.gender} onChange={handleInputChange} required>
                  <option value="">-- Select Gender --</option>
                  {GENDER_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Age *</label>
                <input 
                  type="number" 
                  name="age" 
                  value={formData.age} 
                  onChange={handleInputChange} 
                  required 
                  min="0"
                  max="120"
                />
              </div>
              <div className="form-group">
                <label>Contact Number</label>
                <input 
                  type="text" 
                  name="contact_number" 
                  value={formData.contact_number} 
                  onChange={handleInputChange} 
                  placeholder="e.g. 09123456789"
                />
              </div>
            </div>

            <h4 style={{ margin: '24px 0 16px 0', paddingBottom: '8px', borderBottom: '1px solid var(--border-light)', color: 'var(--primary)' }}>Service Information</h4>

            <div className="form-row">
              <div className="form-group">
                <label>Office Name *</label>
                <input 
                  type="text" 
                  name="office_name" 
                  value={formData.office_name} 
                  onChange={handleInputChange} 
                  required 
                  placeholder="e.g. CDRRMO"
                />
              </div>
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
            </div>

            <div className="form-group">
              <label>Service Provided *</label>
              <input 
                type="text" 
                name="service_provided" 
                value={formData.service_provided} 
                onChange={handleInputChange} 
                required 
                placeholder="e.g. Emergency Response, Issuance of Certificate"
              />
            </div>

            <h4 style={{ margin: '24px 0 16px 0', paddingBottom: '8px', borderBottom: '1px solid var(--border-light)', color: 'var(--primary)' }}>Survey Questionnaire</h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              {QUESTIONS.map(q => (
                <div className="form-group" key={q.key} style={{ marginBottom: '0' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '8px', fontWeight: '600' }}>{q.label}</label>
                  <select name={q.key} value={formData[q.key]} onChange={handleInputChange} required>
                    <option value="">-- Rate (1-5) --</option>
                    {RATING_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <h4 style={{ margin: '24px 0 16px 0', paddingBottom: '8px', borderBottom: '1px solid var(--border-light)', color: 'var(--primary)' }}>Feedback</h4>

            <div className="form-group">
              <label>Comments / Suggestions</label>
              <textarea 
                name="feedback" 
                value={formData.feedback} 
                onChange={handleInputChange} 
                rows={4} 
                placeholder="Any additional feedback or remarks..."
              />
            </div>

          </fieldset>

          <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
            <div></div>
            {isViewing ? (
              <div style={{ display: 'flex', gap: '12px' }}>
                {isAdmin && (
                  <>
                    <button 
                      type="button"
                      className="btn-delete"
                      onClick={handleDeleteFromView}
                      style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      <i className="ri-delete-bin-line" style={{ marginRight: '6px' }}></i> Delete
                    </button>
                    <button 
                      type="button"
                      className="btn-submit"
                      onClick={handleEditFromView}
                      style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}
                    >
                      <i className="ri-pencil-line" style={{ marginRight: '6px' }}></i> Edit
                    </button>
                  </>
                )}
                {!isAdmin && (
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
                  {isSaving ? 'Saving...' : 'Save Survey'}
                </button>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </div>
  )
}
