import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { supabase, supabaseAdmin } from '../services/supabase'
import { uploadFile, deleteFiles } from '../services/storage'
import { exportEmployeeProfile } from '../utils/exportEmployeeProfile'
import { useToast } from './Toast'
import ImageCropper from './ImageCropper'

const PROFILE_TABS = [
  { id: 'personal',    label: 'Personal Info',   icon: 'ri-user-line' },
  { id: 'designation', label: 'Designation',     icon: 'ri-briefcase-line' },
  { id: 'profile',     label: 'Profile',         icon: 'ri-heart-pulse-line' },
  { id: 'family',      label: 'Family',          icon: 'ri-group-line' },
  { id: 'work',        label: 'Work Experience', icon: 'ri-building-line' },
  { id: 'training',    label: 'Training',        icon: 'ri-book-open-line' },
  { id: 'other',       label: 'Other Info',      icon: 'ri-more-line' },
  { id: 'remarks',     label: 'Remarks',         icon: 'ri-sticky-note-line' },
]

const ALL_TABS_VISITED = new Set(PROFILE_TABS.map(t => t.id))

function isTabComplete(tabId, f) {
  switch (tabId) {
    case 'personal':
      return ['name','contact','address','dob','pob','sex','civil_status','blood_type']
        .every(k => String(f[k] ?? '').trim() !== '')
    case 'designation':
      return String(f.designation ?? '').trim() !== '' && String(f.email ?? '').trim() !== ''
    case 'profile':
      return ['emergency_contact_person','emergency_contact_no']
        .some(k => String(f[k] ?? '').trim() !== '')
    case 'family':
      return ['father_name','mother_name','spouse_name']
        .some(k => String(f[k] ?? '').trim() !== '')
    case 'work':
      return Array.isArray(f.work_experience) && f.work_experience.length > 0
        && f.work_experience.some(w => String(w.job_description ?? '').trim() !== '')
    case 'training':
      return Array.isArray(f.trainings_attended) && f.trainings_attended.length > 0
        && f.trainings_attended.some(t => String(t.seminar ?? '').trim() !== '')
    case 'other':
      return ['tin','sss','philhealth','pagibig','gsis']
        .some(k => String(f[k] ?? '').trim() !== '')
    case 'remarks':
      return String(f.remarks ?? '').trim() !== ''
    default:
      return false
  }
}

export default function Topbar() {
  const navigate = useNavigate()
  const { signOut, user } = useAuthStore()
  const toast = useToast()

  // ── Global search ────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState([])

  // ── Dark mode state ──────────────────────────────────────────────────
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark'
  })

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
      localStorage.setItem('theme', 'light')
    }
  }, [isDarkMode])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchTerm.trim().length >= 2) {
        performGlobalSearch(searchTerm)
      } else {
        setResults([])
        setShowDropdown(false)
      }
    }, 300)
    return () => clearTimeout(delayDebounceFn)
  }, [searchTerm])

  const performGlobalSearch = async (query) => {
    setIsSearching(true)
    setShowDropdown(true)
    try {
      const allResults = []
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('id, employee_id, name, designation')
        .or(`name.ilike.%${query}%,employee_id.ilike.%${query}%,designation.ilike.%${query}%`)
        .limit(5)
      if (!empError && empData) {
        empData.forEach(emp => {
          allResults.push({
            id: emp.id,
            title: emp.name,
            subtitle: `${emp.employee_id} • ${emp.designation || 'Employee'}`,
            module: 'Employees',
            path: '/employees'
          })
        })
      }
      setResults(allResults)
    } catch (err) {
      console.error('Global search error:', err)
    } finally {
      setIsSearching(false)
    }
  }

  const handleResultClick = (result) => {
    setShowDropdown(false)
    setSearchTerm('')
    navigate(result.path)
  }

  const handleLogout = async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  // ── Profile modal state ──────────────────────────────────────────────
  const [currentEmployee, setCurrentEmployee] = useState(null)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isViewMode, setIsViewMode] = useState(true)   // true = VIEW, false = EDIT
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('personal')
  const [visitedTabs, setVisitedTabs] = useState(ALL_TABS_VISITED)
  const [formData, setFormData] = useState({})

  // Avatar crop states
  const [isCropperOpen, setIsCropperOpen] = useState(false)
  const [selectedImageSrc, setSelectedImageSrc] = useState(null)
  const [croppedBlob, setCroppedBlob] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')

  useEffect(() => {
    if (user?.email) fetchCurrentEmployee()
  }, [user])

  const fetchCurrentEmployee = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('email', user.email)
        .single()
      if (!error && data) setCurrentEmployee(data)
    } catch (err) {
      console.error('Error fetching employee record:', err)
    }
  }

  const openProfileModal = () => {
    if (!currentEmployee) return
    const emp = currentEmployee
    setFormData({
      employee_id: emp.employee_id || '',
      name: emp.name || '',
      designation: emp.designation || '',
      email: emp.email || '',
      contact: emp.contact || '',
      duty_status: emp.duty_status || 'Off Duty',
      office: emp.office || 'CDRRMO Headquarters',
      dob: emp.dob || '',
      pob: emp.pob || '',
      civil_status: emp.civil_status || 'Single',
      sex: emp.sex || '',
      blood_type: emp.blood_type || '',
      address: emp.address || '',
      height: emp.height || '',
      weight: emp.weight || '',
      waist: emp.waist || '',
      shirt_size: emp.shirt_size || '',
      shoe_size: emp.shoe_size || '',
      tin: emp.tin || '',
      pagibig: emp.pagibig || '',
      sss: emp.sss || '',
      gsis: emp.gsis || '',
      philhealth: emp.philhealth || '',
      emergency_contact_person: emp.emergency_contact_person || '',
      emergency_contact_no: emp.emergency_contact_no || '',
      medical_condition: emp.medical_condition || '',
      elementary: emp.elementary || '',
      highschool: emp.highschool || '',
      college: emp.college || '',
      eligibility: emp.eligibility || '',
      father_name: emp.father_name || '',
      mother_name: emp.mother_name || '',
      spouse_name: emp.spouse_name || '',
      children: emp.children || [],
      work_experience: emp.work_experience || [],
      trainings_attended: emp.trainings_attended || [],
      remarks: emp.remarks || '',
      avatar_url: emp.avatar_url || '',
      role: emp.role || 'user',
    })
    setAvatarPreview(emp.avatar_url || '')
    setCroppedBlob(null)
    setActiveTab('personal')
    setVisitedTabs(ALL_TABS_VISITED)
    setIsViewMode(true)
    setIsProfileModalOpen(true)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      const reader = new FileReader()
      reader.addEventListener('load', () => {
        setSelectedImageSrc(reader.result)
        setIsCropperOpen(true)
      })
      reader.readAsDataURL(file)
      e.target.value = null
    }
  }

  const handleCropComplete = (blob) => {
    setCroppedBlob(blob)
    setAvatarPreview(URL.createObjectURL(blob))
    setIsCropperOpen(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      let payload = {
        name:                     formData.name,
        contact:                  formData.contact,
        address:                  formData.address,
        dob:                      formData.dob || null,
        pob:                      formData.pob,
        civil_status:             formData.civil_status,
        sex:                      formData.sex,
        blood_type:               formData.blood_type,
        height:                   formData.height,
        weight:                   formData.weight,
        waist:                    formData.waist,
        shirt_size:               formData.shirt_size,
        shoe_size:                formData.shoe_size,
        tin:                      formData.tin,
        pagibig:                  formData.pagibig,
        sss:                      formData.sss,
        gsis:                     formData.gsis,
        philhealth:               formData.philhealth,
        emergency_contact_person: formData.emergency_contact_person,
        emergency_contact_no:     formData.emergency_contact_no,
        medical_condition:        formData.medical_condition,
        elementary:               formData.elementary,
        highschool:               formData.highschool,
        college:                  formData.college,
        eligibility:              formData.eligibility,
        father_name:              formData.father_name,
        mother_name:              formData.mother_name,
        spouse_name:              formData.spouse_name,
        children:                 formData.children,
        work_experience:          formData.work_experience,
        trainings_attended:       formData.trainings_attended,
        remarks:                  formData.remarks,
        updated_at:               new Date().toISOString(),
      }

      // Upload new avatar
      if (croppedBlob) {
        const ext = croppedBlob.type === 'image/png' ? 'png' : 'jpeg'
        const filename = `${currentEmployee.employee_id || Date.now()}-profile-${Date.now()}.${ext}`
        const publicUrl = await uploadFile('avatars', filename, croppedBlob)
        // Delete old avatar
        if (currentEmployee.avatar_url) {
          try {
            const match = currentEmployee.avatar_url.match(/\/avatars\/(.+)$/)
            if (match) await deleteFiles('avatars', [match[1]])
          } catch (delErr) {
            console.warn('Old avatar deletion failed:', delErr)
          }
        }
        payload.avatar_url = publicUrl
      }

      const { data, error } = await supabase
        .from('employees')
        .update(payload)
        .eq('id', currentEmployee.id)
        .select()
      if (error) throw error

      setCurrentEmployee(data[0])
      setAvatarPreview(data[0].avatar_url || '')
      setCroppedBlob(null)
      setIsViewMode(true)
      toast.success('Profile updated successfully!')
    } catch (err) {
      console.error('Error updating profile:', err)
      toast.error('Error saving profile: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleProfileClick = () => {
    openProfileModal()
  }

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="topbar">
      {/* ── Search ── */}
      <div className="topbar-search" ref={searchRef} style={{ position: 'relative' }}>
        <i className="ri-search-line"></i>
        <input
          type="text"
          placeholder="Global Search... (e.g. employee name)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => { if (searchTerm.trim().length >= 2) setShowDropdown(true) }}
        />

        {showDropdown && searchTerm.trim().length >= 2 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, width: '100%', minWidth: '300px',
            background: '#fff', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            border: '1px solid var(--border-light)', marginTop: '8px', zIndex: 1000,
            maxHeight: '400px', overflowY: 'auto'
          }}>
            {isSearching ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <i className="ri-loader-4-line ri-spin" style={{ marginRight: '8px' }}></i>Searching...
              </div>
            ) : results.length > 0 ? (
              <div style={{ padding: '8px 0' }}>
                <div style={{ padding: '4px 16px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Search Results
                </div>
                {results.map((result, idx) => (
                  <div key={`${result.module}-${result.id}-${idx}`} onClick={() => handleResultClick(result)}
                    style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'flex-start', gap: '12px', transition: 'background 0.2s' }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className={result.module === 'Employees' ? 'ri-team-line' : 'ri-file-list-3-line'}></i>
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '14px', marginBottom: '2px' }}>{result.title}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ background: '#e5e7eb', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', color: '#374151' }}>{result.module}</span>
                        {result.subtitle}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <i className="ri-search-line" style={{ fontSize: '24px', opacity: 0.5, display: 'block', marginBottom: '8px' }}></i>
                No results found for "{searchTerm}"
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right actions ── */}
      <div className="topbar-actions">
        {currentEmployee ? (
          <div onClick={handleProfileClick}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 12px', borderRadius: '24px', cursor: 'pointer', transition: 'background 0.2s', marginRight: '8px' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-app)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {currentEmployee.avatar_url
                ? <img src={currentEmployee.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <i className="ri-user-line" style={{ fontSize: '16px', color: 'var(--text-muted)' }}></i>
              }
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', lineHeight: '1.2' }}>
                {currentEmployee.name || currentEmployee.email}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '600', marginTop: '2px' }}>
                View Profile
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-main)', marginRight: '8px' }}>
            {user?.email || 'User'}
          </div>
        )}
        <button 
          type="button" 
          onClick={() => setIsDarkMode(prev => !prev)}
          style={{
            background: 'var(--bg-app)', border: '1px solid var(--border-light)',
            width: '36px', height: '36px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: isDarkMode ? '#facc15' : 'var(--text-muted)',
            marginRight: '8px', transition: 'all 0.2s'
          }}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          <i className={isDarkMode ? 'ri-moon-fill' : 'ri-sun-line'} style={{ fontSize: '18px' }}></i>
        </button>
        <button className="btn-logout" onClick={handleLogout}>
          <i className="ri-logout-box-line"></i>
          Logout
        </button>
      </div>

      {/* ── Profile Modal (sidebar-step layout) ── */}
      {isProfileModalOpen && createPortal(
        <div className="modal-backdrop" onClick={() => setIsProfileModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '1100px', maxWidth: '97vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

            {/* Header */}
            <div className="modal-header">
              <h3><i className="ri-user-line" style={{ marginRight: '8px' }}></i>My Profile</h3>
              <button className="modal-close" onClick={() => setIsProfileModalOpen(false)}>
                <i className="ri-close-line"></i>
              </button>
            </div>

            {/* Body */}
            <div className="modal-body" style={{ flex: 1, overflow: 'auto' }}>
              <form onSubmit={e => e.preventDefault()} className="modal-form">
                <div style={{ display: 'flex', gap: 0, minHeight: '520px' }}>

                  {/* Left sidebar */}
                  <div style={{ width: '185px', flexShrink: 0, borderRight: '1px solid var(--border-light)', paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {PROFILE_TABS.map((t, idx) => {
                      const isActive   = t.id === activeTab
                      const wasVisited = visitedTabs.has(t.id) && !isActive
                      const complete   = wasVisited && isTabComplete(t.id, formData)
                      const incomplete = wasVisited && !isTabComplete(t.id, formData)

                      let bg = 'transparent', color = 'var(--text-muted)'
                      let badgeBg = 'var(--border-light)', badgeColor = 'var(--text-muted)'
                      let badgeContent = String(idx + 1)

                      if (isActive) {
                        bg = 'var(--primary)'; color = '#fff'
                        badgeBg = 'rgba(255,255,255,0.25)'; badgeColor = '#fff'
                      } else if (complete) {
                        bg = '#f0fdf4'; color = '#15803d'
                        badgeBg = '#16a34a'; badgeColor = '#fff'; badgeContent = '✓'
                      } else if (incomplete) {
                        bg = '#fefce8'; color = '#92400e'
                        badgeBg = '#f59e0b'; badgeColor = '#fff'; badgeContent = '!'
                      }

                      return (
                        <button key={t.id} type="button"
                          onClick={() => { setVisitedTabs(prev => new Set([...prev, t.id])); setActiveTab(t.id) }}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', border: 'none', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: isActive ? '700' : '500', background: bg, color, transition: 'all 0.15s' }}>
                          <span style={{ width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', background: badgeBg, color: badgeColor }}>
                            {badgeContent}
                          </span>
                          {t.label}
                        </button>
                      )
                    })}
                  </div>

                  {/* Right content */}
                  <div style={{ flex: 1, paddingLeft: '24px', paddingTop: '4px', overflow: 'auto' }}>
                    <fieldset disabled={isViewMode} style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}>
                      <div style={{ minHeight: '420px' }}>

                        {/* ── Personal Info ── */}
                        {activeTab === 'personal' && (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '24px' }}>
                              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--bg-app)', border: '2px dashed var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                {avatarPreview
                                  ? <img src={avatarPreview} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : <i className="ri-user-line" style={{ fontSize: '32px', color: 'var(--border-light)' }}></i>
                                }
                              </div>
                              {!isViewMode && (
                                <div>
                                  <label style={{ display: 'inline-block', background: 'var(--primary-bg)', color: 'var(--primary-dark)', padding: '8px 16px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', border: '1px solid var(--primary-light)', transition: 'all 0.2s' }}>
                                    <i className="ri-upload-2-line" style={{ marginRight: '6px' }}></i>Upload Picture
                                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                                  </label>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>JPEG or PNG. Max 100kb (will be resized).</div>
                                </div>
                              )}
                            </div>
                            <div className="form-row">
                              <div className="form-group"><label>Full Name *</label><input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} required placeholder="e.g. Juan dela Cruz" /></div>
                              <div className="form-group"><label>Contact Number *</label><input type="text" name="contact" value={formData.contact || ''} onChange={handleInputChange} placeholder="e.g. 0917-XXX-XXXX" required /></div>
                            </div>
                            <div className="form-group"><label>Home Address *</label><textarea name="address" value={formData.address || ''} onChange={handleInputChange} rows={2} required /></div>
                            <div className="form-row">
                              <div className="form-group"><label>Date of Birth *</label><input type="date" name="dob" value={formData.dob || ''} onChange={handleInputChange} required /></div>
                              <div className="form-group"><label>Place of Birth *</label><input type="text" name="pob" value={formData.pob || ''} onChange={handleInputChange} required /></div>
                            </div>
                            <div className="form-row">
                              <div className="form-group"><label>Civil Status *</label>
                                <select name="civil_status" value={formData.civil_status || 'Single'} onChange={handleInputChange} required>
                                  <option>Single</option><option>Married</option><option>Divorced</option><option>Widowed</option>
                                </select>
                              </div>
                              <div className="form-group"><label>Sex *</label>
                                <select name="sex" value={formData.sex || ''} onChange={handleInputChange} required>
                                  <option value="">-- Select --</option><option>Male</option><option>Female</option>
                                </select>
                              </div>
                              <div className="form-group"><label>Blood Type *</label><input type="text" name="blood_type" value={formData.blood_type || ''} onChange={handleInputChange} placeholder="e.g. O+, A-" required /></div>
                            </div>
                          </>
                        )}

                        {/* ── Designation (read-only) ── */}
                        {activeTab === 'designation' && (
                          <>
                            <div className="form-row">
                              <div className="form-group"><label>Employee ID</label><input type="text" value={formData.employee_id || ''} disabled style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280' }} /></div>
                              <div className="form-group"><label>Designation</label><input type="text" value={formData.designation || ''} disabled style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280' }} /></div>
                            </div>
                            <div className="form-row">
                              <div className="form-group"><label>Office / Station</label><input type="text" value={formData.office || ''} disabled style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280' }} /></div>
                              <div className="form-group"><label>Duty Status</label><input type="text" value={formData.duty_status || ''} disabled style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280' }} /></div>
                            </div>
                            <div className="form-row">
                              <div className="form-group"><label>Email Address</label><input type="email" value={formData.email || ''} disabled style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280' }} /></div>
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                              <i className="ri-information-line"></i> Designation fields can only be changed by an Administrator.
                            </p>
                          </>
                        )}

                        {/* ── Profile ── */}
                        {activeTab === 'profile' && (
                          <>
                            <div className="form-row">
                              <div className="form-group"><label>Medical Condition</label><input type="text" name="medical_condition" value={formData.medical_condition || ''} onChange={handleInputChange} placeholder="e.g. None, Asthma, Diabetes" /></div>
                            </div>
                            <div className="form-row">
                              <div className="form-group"><label>Emergency Contact Person</label><input type="text" name="emergency_contact_person" value={formData.emergency_contact_person || ''} onChange={handleInputChange} /></div>
                              <div className="form-group"><label>Emergency Contact No.</label><input type="text" name="emergency_contact_no" value={formData.emergency_contact_no || ''} onChange={handleInputChange} /></div>
                            </div>
                            <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '8px 0' }} />
                            <p style={{ fontWeight: '700', fontSize: '13px', marginBottom: '8px', color: 'var(--primary)' }}>Educational Background</p>
                            <div className="form-row">
                              <div className="form-group"><label>Elementary</label><input type="text" name="elementary" value={formData.elementary || ''} onChange={handleInputChange} /></div>
                              <div className="form-group"><label>High School</label><input type="text" name="highschool" value={formData.highschool || ''} onChange={handleInputChange} /></div>
                            </div>
                            <div className="form-row">
                              <div className="form-group"><label>College</label><input type="text" name="college" value={formData.college || ''} onChange={handleInputChange} /></div>
                              <div className="form-group"><label>Eligibility</label><input type="text" name="eligibility" value={formData.eligibility || ''} onChange={handleInputChange} /></div>
                            </div>
                          </>
                        )}

                        {/* ── Family ── */}
                        {activeTab === 'family' && (
                          <>
                            <div className="form-row">
                              <div className="form-group"><label>Father's Name</label><input type="text" name="father_name" value={formData.father_name || ''} onChange={handleInputChange} /></div>
                              <div className="form-group"><label>Mother's Maiden Name</label><input type="text" name="mother_name" value={formData.mother_name || ''} onChange={handleInputChange} /></div>
                            </div>
                            <div className="form-row">
                              <div className="form-group"><label>Spouse Name</label><input type="text" name="spouse_name" value={formData.spouse_name || ''} onChange={handleInputChange} /></div>
                            </div>
                            <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '8px 0' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <p style={{ fontWeight: '700', fontSize: '13px', color: 'var(--primary)', margin: 0 }}>Children</p>
                              {!isViewMode && (
                                <button type="button" onClick={() => setFormData(p => ({ ...p, children: [...(p.children || []), { name: '', dob: '' }] }))}
                                  style={{ fontSize: '12px', fontWeight: '700', padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--primary)', color: 'var(--primary)', background: 'transparent', cursor: 'pointer' }}>
                                  + Add Child
                                </button>
                              )}
                            </div>
                            {(formData.children || []).length === 0 && <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No children added.</p>}
                            {(formData.children || []).map((child, idx) => (
                              <div key={idx} className="form-row" style={{ alignItems: 'flex-end', marginBottom: '6px' }}>
                                <div className="form-group"><label>Name</label><input type="text" value={child.name} onChange={e => { const u = [...formData.children]; u[idx] = { ...u[idx], name: e.target.value }; setFormData(p => ({ ...p, children: u })) }} /></div>
                                <div className="form-group"><label>Date of Birth</label><input type="date" value={child.dob} onChange={e => { const u = [...formData.children]; u[idx] = { ...u[idx], dob: e.target.value }; setFormData(p => ({ ...p, children: u })) }} /></div>
                                {!isViewMode && (
                                  <button type="button" onClick={() => setFormData(p => ({ ...p, children: p.children.filter((_, i) => i !== idx) }))}
                                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', flexShrink: 0, marginBottom: '2px' }}>
                                    <i className="ri-delete-bin-line" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </>
                        )}

                        {/* ── Work Experience ── */}
                        {activeTab === 'work' && (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <p style={{ fontWeight: '700', fontSize: '13px', color: 'var(--primary)', margin: 0 }}>Work Experience</p>
                              {!isViewMode && (
                                <button type="button" onClick={() => setFormData(p => ({ ...p, work_experience: [...(p.work_experience || []), { job_description: '', date_from: '', date_to: '' }] }))}
                                  style={{ fontSize: '12px', fontWeight: '700', padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--primary)', color: 'var(--primary)', background: 'transparent', cursor: 'pointer' }}>
                                  + Add Entry
                                </button>
                              )}
                            </div>
                            {(formData.work_experience || []).length === 0 && <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No work experience added.</p>}
                            {(formData.work_experience || []).map((we, idx) => (
                              <div key={idx} style={{ background: 'var(--bg-app)', borderRadius: '8px', padding: '12px', marginBottom: '10px', border: '1px solid var(--border-light)' }}>
                                <div className="form-row" style={{ marginBottom: '6px' }}>
                                  <div className="form-group" style={{ flex: 2 }}><label>Job Description</label><input type="text" value={we.job_description} onChange={e => { const u = [...formData.work_experience]; u[idx] = { ...u[idx], job_description: e.target.value }; setFormData(p => ({ ...p, work_experience: u })) }} /></div>
                                  <div className="form-group"><label>From</label><input type="date" value={we.date_from} onChange={e => { const u = [...formData.work_experience]; u[idx] = { ...u[idx], date_from: e.target.value }; setFormData(p => ({ ...p, work_experience: u })) }} /></div>
                                  <div className="form-group"><label>To</label><input type="date" value={we.date_to} onChange={e => { const u = [...formData.work_experience]; u[idx] = { ...u[idx], date_to: e.target.value }; setFormData(p => ({ ...p, work_experience: u })) }} /></div>
                                  {!isViewMode && (
                                    <button type="button" onClick={() => setFormData(p => ({ ...p, work_experience: p.work_experience.filter((_, i) => i !== idx) }))}
                                      style={{ padding: '8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', flexShrink: 0, alignSelf: 'flex-end', marginBottom: '2px' }}>
                                      <i className="ri-delete-bin-line" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </>
                        )}

                        {/* ── Training ── */}
                        {activeTab === 'training' && (
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <p style={{ fontWeight: '700', fontSize: '13px', color: 'var(--primary)', margin: 0 }}>Seminar / Training Attended</p>
                              {!isViewMode && (
                                <button type="button" onClick={() => setFormData(p => ({ ...p, trainings_attended: [...(p.trainings_attended || []), { seminar: '', date: '', conducted_by: '', venue: '' }] }))}
                                  style={{ fontSize: '12px', fontWeight: '700', padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--primary)', color: 'var(--primary)', background: 'transparent', cursor: 'pointer' }}>
                                  + Add Training
                                </button>
                              )}
                            </div>
                            {(formData.trainings_attended || []).length === 0 && <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No trainings added.</p>}
                            {(formData.trainings_attended || []).map((tr, idx) => (
                              <div key={idx} style={{ background: 'var(--bg-app)', borderRadius: '8px', padding: '12px', marginBottom: '10px', border: '1px solid var(--border-light)' }}>
                                <div className="form-row" style={{ flexWrap: 'wrap', gap: '8px' }}>
                                  <div className="form-group" style={{ flex: '2 1 180px' }}><label>Training / Seminar</label><input type="text" value={tr.seminar} onChange={e => { const u = [...formData.trainings_attended]; u[idx] = { ...u[idx], seminar: e.target.value }; setFormData(p => ({ ...p, trainings_attended: u })) }} /></div>
                                  <div className="form-group" style={{ flex: '1 1 130px' }}><label>Date of Training</label><input type="date" value={tr.date} onChange={e => { const u = [...formData.trainings_attended]; u[idx] = { ...u[idx], date: e.target.value }; setFormData(p => ({ ...p, trainings_attended: u })) }} /></div>
                                  <div className="form-group" style={{ flex: '1 1 150px' }}><label>Conducted By</label><input type="text" value={tr.conducted_by} onChange={e => { const u = [...formData.trainings_attended]; u[idx] = { ...u[idx], conducted_by: e.target.value }; setFormData(p => ({ ...p, trainings_attended: u })) }} /></div>
                                  <div className="form-group" style={{ flex: '1 1 150px' }}><label>Training Venue</label><input type="text" value={tr.venue} onChange={e => { const u = [...formData.trainings_attended]; u[idx] = { ...u[idx], venue: e.target.value }; setFormData(p => ({ ...p, trainings_attended: u })) }} /></div>
                                  {!isViewMode && (
                                    <button type="button" onClick={() => setFormData(p => ({ ...p, trainings_attended: p.trainings_attended.filter((_, i) => i !== idx) }))}
                                      style={{ padding: '8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', flexShrink: 0, alignSelf: 'flex-end', marginBottom: '2px' }}>
                                      <i className="ri-delete-bin-line" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </>
                        )}

                        {/* ── Other Info ── */}
                        {activeTab === 'other' && (
                          <>
                            <div className="form-row">
                              <div className="form-group"><label>Height (cm)</label><input type="text" name="height" value={formData.height || ''} onChange={handleInputChange} placeholder="e.g. 170" /></div>
                              <div className="form-group"><label>Weight (kg)</label><input type="text" name="weight" value={formData.weight || ''} onChange={handleInputChange} placeholder="e.g. 65" /></div>
                            </div>
                            <div className="form-row">
                              <div className="form-group"><label>Waist</label><input type="text" name="waist" value={formData.waist || ''} onChange={handleInputChange} /></div>
                              <div className="form-group"><label>Shirt Size</label><input type="text" name="shirt_size" value={formData.shirt_size || ''} onChange={handleInputChange} placeholder="e.g. M, L, XL" /></div>
                            </div>
                            <div className="form-row">
                              <div className="form-group"><label>Shoe Size</label><input type="text" name="shoe_size" value={formData.shoe_size || ''} onChange={handleInputChange} /></div>
                              <div className="form-group"><label>TIN</label><input type="text" name="tin" value={formData.tin || ''} onChange={handleInputChange} /></div>
                            </div>
                            <div className="form-row">
                              <div className="form-group"><label>Pag-IBIG No.</label><input type="text" name="pagibig" value={formData.pagibig || ''} onChange={handleInputChange} /></div>
                              <div className="form-group"><label>SSS No.</label><input type="text" name="sss" value={formData.sss || ''} onChange={handleInputChange} /></div>
                            </div>
                            <div className="form-row">
                              <div className="form-group"><label>GSIS No.</label><input type="text" name="gsis" value={formData.gsis || ''} onChange={handleInputChange} /></div>
                              <div className="form-group"><label>PhilHealth No.</label><input type="text" name="philhealth" value={formData.philhealth || ''} onChange={handleInputChange} /></div>
                            </div>
                          </>
                        )}

                        {/* ── Remarks ── */}
                        {activeTab === 'remarks' && (
                          <div className="form-group">
                            <label>Remarks / Notes</label>
                            <textarea name="remarks" value={formData.remarks || ''} onChange={handleInputChange} rows={6} placeholder="Any additional notes..." />
                          </div>
                        )}

                      </div>
                    </fieldset>

                    {/* ── Footer actions ── */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                      {/* Export PDF always visible */}
                      <button type="button"
                        onClick={async () => {
                          try { await exportEmployeeProfile(formData, avatarPreview) }
                          catch (err) { console.error('Export failed:', err); toast.error('Export failed: ' + (err?.message || '')) }
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px' }}>
                        <i className="ri-file-pdf-line" style={{ fontSize: '15px' }}></i> Export PDF
                      </button>

                      {isViewMode ? (
                        <button type="button" className="btn-edit"
                          onClick={() => setIsViewMode(false)}
                          style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                          <i className="ri-pencil-line" style={{ marginRight: '6px' }}></i>Edit
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <button type="button" className="btn-secondary"
                            onClick={() => { openProfileModal() }}>
                            Cancel
                          </button>
                          <button type="button" className="btn-submit" disabled={isSaving}
                            onClick={handleSave}>
                            <i className="ri-save-line" style={{ marginRight: '6px' }}></i>
                            {isSaving ? 'Saving...' : 'Save Changes'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* end right content */}

                </div>
                {/* end sidebar+content flex */}
              </form>
            </div>
            {/* end modal-body */}

          </div>
          {/* end modal-content */}
        </div>
        /* end backdrop */
      , document.body)}

      {/* ── Avatar Image Cropper ── */}
      {isCropperOpen && selectedImageSrc && (
        <ImageCropper
          isOpen={true}
          imageSrc={selectedImageSrc}
          onCropComplete={handleCropComplete}
          onClose={() => { setIsCropperOpen(false); setSelectedImageSrc(null) }}
        />
      )}

    </div>
  )
}
