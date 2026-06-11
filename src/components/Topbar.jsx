import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { supabase } from '../services/supabase'
import { uploadFile } from '../services/storage'
import ImageCropper from './ImageCropper'

export default function Topbar() {
  const navigate = useNavigate()
  const { signOut, user } = useAuthStore()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState([])
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
      
      // Search Employees
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

      // TODO: Add more tables here as modules are implemented
      // e.g., Incidents, Vehicles, Vouchers

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

  const [currentEmployee, setCurrentEmployee] = useState(null)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileActiveTab, setProfileActiveTab] = useState('personal')

  // Avatar crop states
  const [isCropperOpen, setIsCropperOpen] = useState(false)
  const [selectedImageSrc, setSelectedImageSrc] = useState(null)
  const [croppedBlob, setCroppedBlob] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')

  // Full profile form state mirroring the employee record
  const [profileForm, setProfileForm] = useState({})

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

  const handleProfileClick = () => {
    if (!currentEmployee) return
    // Populate form from current employee record
    setProfileForm({
      name:         currentEmployee.name         || '',
      contact:      currentEmployee.contact      || '',
      address:      currentEmployee.address      || '',
      dob:          currentEmployee.dob          || '',
      pob:          currentEmployee.pob          || '',
      civil_status: currentEmployee.civil_status || 'Single',
      blood_type:   currentEmployee.blood_type   || '',
      height:       currentEmployee.height       || '',
      weight:       currentEmployee.weight       || '',
      waist:        currentEmployee.waist        || '',
      shirt_size:   currentEmployee.shirt_size   || '',
      shoe_size:    currentEmployee.shoe_size    || '',
      tin:          currentEmployee.tin          || '',
      pagibig:      currentEmployee.pagibig      || '',
      sss:          currentEmployee.sss          || '',
      gsis:         currentEmployee.gsis         || '',
      philhealth:   currentEmployee.philhealth   || '',
      remarks:      currentEmployee.remarks      || '',
      // read-only designation fields
      employee_id:  currentEmployee.employee_id  || '',
      username:     currentEmployee.username     || '',
      designation:  currentEmployee.designation  || '',
      office:       currentEmployee.office       || '',
      email:        currentEmployee.email        || '',
      duty_status:  currentEmployee.duty_status  || '',
    })
    setAvatarPreview(currentEmployee.avatar_url || '')
    setCroppedBlob(null)
    setProfileActiveTab('personal')
    setIsProfileModalOpen(true)
  }

  const handleProfileInput = (e) => {
    const { name, value } = e.target
    setProfileForm(prev => ({ ...prev, [name]: value }))
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

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setIsSavingProfile(true)
    try {
      let updatedData = {
        ...profileForm,
        dob: profileForm.dob || null,
        updated_at: new Date().toISOString()
      }
      // Remove read-only fields that shouldn't be updated here
      delete updatedData.employee_id
      delete updatedData.username
      delete updatedData.email
      delete updatedData.duty_status

      // Upload new avatar if cropped
      if (croppedBlob) {
        const ext = croppedBlob.type === 'image/png' ? 'png' : 'jpeg'
        const filename = `${currentEmployee.employee_id || Date.now()}-profile-${Date.now()}.${ext}`
        const publicUrl = await uploadFile('avatars', filename, croppedBlob)
        updatedData.avatar_url = publicUrl
      }

      const { data, error } = await supabase
        .from('employees')
        .update(updatedData)
        .eq('id', currentEmployee.id)
        .select()
      if (error) throw error

      setCurrentEmployee(data[0])
      setIsProfileModalOpen(false)
    } catch (err) {
      console.error('Error updating profile:', err)
    } finally {
      setIsSavingProfile(false)
    }
  }

  return (
    <div className="topbar">
      <div className="topbar-search" ref={searchRef} style={{ position: 'relative' }}>
        <i className="ri-search-line"></i>
        <input 
          type="text" 
          placeholder="Global Search... (e.g. employee name)" 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => {
            if (searchTerm.trim().length >= 2) setShowDropdown(true)
          }}
        />
        
        {/* Search Results Dropdown */}
        {showDropdown && searchTerm.trim().length >= 2 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            width: '100%',
            minWidth: '300px',
            background: '#fff',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
            border: '1px solid var(--border-light)',
            marginTop: '8px',
            zIndex: 1000,
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {isSearching ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <i className="ri-loader-4-line ri-spin" style={{ marginRight: '8px' }}></i>
                Searching...
              </div>
            ) : results.length > 0 ? (
              <div style={{ padding: '8px 0' }}>
                <div style={{ padding: '4px 16px', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Search Results
                </div>
                {results.map((result, idx) => (
                  <div 
                    key={`${result.module}-${result.id}-${idx}`}
                    onClick={() => handleResultClick(result)}
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-light)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <i className={result.module === 'Employees' ? 'ri-team-line' : 'ri-file-list-3-line'}></i>
                    </div>
                    <div>
                      <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '14px', marginBottom: '2px' }}>
                        {result.title}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ background: '#e5e7eb', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', color: '#374151' }}>
                          {result.module}
                        </span>
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

      <div className="topbar-actions">
        {currentEmployee ? (
          <div 
            onClick={handleProfileClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 12px',
              borderRadius: '24px',
              cursor: 'pointer',
              transition: 'background 0.2s',
              marginRight: '8px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.05)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--bg-app)',
              border: '1px solid var(--border-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              {currentEmployee.avatar_url ? (
                <img src={currentEmployee.avatar_url} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <i className="ri-user-line" style={{ fontSize: '16px', color: 'var(--text-muted)' }}></i>
              )}
            </div>
            <div style={{
              fontSize: '13px',
              fontWeight: '700',
              color: 'var(--text-main)'
            }}>
              {currentEmployee.name || currentEmployee.email}
            </div>
          </div>
        ) : (
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--text-main)',
            marginRight: '8px'
          }}>
            {user?.email || 'User'}
          </div>
        )}
        <button className="btn-logout" onClick={handleLogout}>
          <i className="ri-logout-box-line"></i>
          Logout
        </button>
      </div>

      {/* ── Full Profile Modal ─────────────────────────────────────────── */}
      {isProfileModalOpen && createPortal(
        <div className="modal-backdrop" onClick={() => setIsProfileModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '580px', maxWidth: '95vw' }}>
            <div className="modal-header">
              <h3>My Profile</h3>
              <button className="modal-close" onClick={() => setIsProfileModalOpen(false)}>
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSaveProfile} className="modal-form">

                {/* ── Tabs ── */}
                <div style={{ display:'flex', gap:'8px', marginBottom:'24px', borderBottom:'1px solid var(--border-light)', overflowX:'auto' }}>
                  {[
                    { key:'personal',    label:'Personal Info' },
                    { key:'designation', label:'Designation'   },
                    { key:'other',       label:'Other Info'    },
                    { key:'remarks',     label:'Remarks'       },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setProfileActiveTab(tab.key)}
                      style={{
                        padding:'8px 16px', background:'none', border:'none', whiteSpace:'nowrap', cursor:'pointer', fontWeight:'700',
                        borderBottom: profileActiveTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
                        color: profileActiveTab === tab.key ? 'var(--primary)' : 'var(--text-muted)',
                      }}
                    >{tab.label}</button>
                  ))}
                </div>

                <div style={{ minHeight:'320px' }}>

                  {/* ── Personal Info ── */}
                  {profileActiveTab === 'personal' && (
                    <>
                      {/* Avatar */}
                      <div style={{ display:'flex', alignItems:'center', gap:'24px', marginBottom:'24px' }}>
                        <div style={{
                          width:'80px', height:'80px', borderRadius:'50%', flexShrink:0,
                          background:'var(--bg-app)', border:'2px dashed var(--border-light)',
                          display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden'
                        }}>
                          {avatarPreview
                            ? <img src={avatarPreview} alt="avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            : <i className="ri-user-line" style={{ fontSize:'32px', color:'var(--border-light)' }}></i>
                          }
                        </div>
                        <div>
                          <label style={{
                            display:'inline-block', background:'var(--primary-bg)', color:'var(--primary-dark)',
                            padding:'8px 16px', borderRadius:'8px', fontWeight:'700', fontSize:'13px',
                            cursor:'pointer', border:'1px solid var(--primary-light)', transition:'all 0.2s'
                          }}>
                            <i className="ri-upload-2-line" style={{ marginRight:'6px' }}></i>Upload Picture
                            <input type="file" accept="image/*" style={{ display:'none' }} onChange={handleFileChange} />
                          </label>
                          <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'6px' }}>JPEG or PNG. Max 100kb (will be resized).</div>
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label>Full Name *</label>
                          <input type="text" name="name" value={profileForm.name || ''} onChange={handleProfileInput} required placeholder="e.g. Juan dela Cruz" />
                        </div>
                        <div className="form-group">
                          <label>Contact Number</label>
                          <input type="text" name="contact" value={profileForm.contact || ''} onChange={handleProfileInput} placeholder="e.g. 0917-XXX-XXXX" />
                        </div>
                      </div>

                      <div className="form-group">
                        <label>Home Address</label>
                        <textarea name="address" value={profileForm.address || ''} onChange={handleProfileInput} rows={2} />
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label>Date of Birth</label>
                          <input type="date" name="dob" value={profileForm.dob || ''} onChange={handleProfileInput} />
                        </div>
                        <div className="form-group">
                          <label>Place of Birth</label>
                          <input type="text" name="pob" value={profileForm.pob || ''} onChange={handleProfileInput} />
                        </div>
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label>Civil Status</label>
                          <select name="civil_status" value={profileForm.civil_status || 'Single'} onChange={handleProfileInput}>
                            <option>Single</option>
                            <option>Married</option>
                            <option>Divorced</option>
                            <option>Widowed</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Blood Type</label>
                          <input type="text" name="blood_type" value={profileForm.blood_type || ''} onChange={handleProfileInput} placeholder="e.g. O+, A-" />
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── Designation (read-only) ── */}
                  {profileActiveTab === 'designation' && (
                    <>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Employee ID</label>
                          <input type="text" value={profileForm.employee_id || ''} disabled style={{ backgroundColor:'#f3f4f6', cursor:'not-allowed', color:'#6b7280' }} />
                        </div>
                        <div className="form-group">
                          <label>Username</label>
                          <input type="text" value={profileForm.username || ''} disabled style={{ backgroundColor:'#f3f4f6', cursor:'not-allowed', color:'#6b7280' }} />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Designation</label>
                          <input type="text" value={profileForm.designation || ''} disabled style={{ backgroundColor:'#f3f4f6', cursor:'not-allowed', color:'#6b7280' }} />
                        </div>
                        <div className="form-group">
                          <label>Office / Station</label>
                          <input type="text" value={profileForm.office || ''} disabled style={{ backgroundColor:'#f3f4f6', cursor:'not-allowed', color:'#6b7280' }} />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Email Address</label>
                          <input type="email" value={profileForm.email || ''} disabled style={{ backgroundColor:'#f3f4f6', cursor:'not-allowed', color:'#6b7280' }} />
                        </div>
                        <div className="form-group">
                          <label>Duty Status</label>
                          <input type="text" value={profileForm.duty_status || ''} disabled style={{ backgroundColor:'#f3f4f6', cursor:'not-allowed', color:'#6b7280' }} />
                        </div>
                      </div>
                      <p style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'8px' }}>
                        <i className="ri-information-line"></i> Designation fields can only be changed by an Administrator.
                      </p>
                    </>
                  )}

                  {/* ── Other Info ── */}
                  {profileActiveTab === 'other' && (
                    <>
                      <div className="form-row">
                        <div className="form-group"><label>Height (cm)</label><input type="text" name="height" value={profileForm.height || ''} onChange={handleProfileInput} placeholder="e.g. 170" /></div>
                        <div className="form-group"><label>Weight (kg)</label><input type="text" name="weight" value={profileForm.weight || ''} onChange={handleProfileInput} placeholder="e.g. 65" /></div>
                      </div>
                      <div className="form-row">
                        <div className="form-group"><label>Waist</label><input type="text" name="waist" value={profileForm.waist || ''} onChange={handleProfileInput} /></div>
                        <div className="form-group"><label>Shirt Size</label><input type="text" name="shirt_size" value={profileForm.shirt_size || ''} onChange={handleProfileInput} placeholder="e.g. M, L, XL" /></div>
                      </div>
                      <div className="form-row">
                        <div className="form-group"><label>Shoe Size</label><input type="text" name="shoe_size" value={profileForm.shoe_size || ''} onChange={handleProfileInput} /></div>
                        <div className="form-group"><label>TIN</label><input type="text" name="tin" value={profileForm.tin || ''} onChange={handleProfileInput} /></div>
                      </div>
                      <div className="form-row">
                        <div className="form-group"><label>Pag-IBIG No.</label><input type="text" name="pagibig" value={profileForm.pagibig || ''} onChange={handleProfileInput} /></div>
                        <div className="form-group"><label>SSS No.</label><input type="text" name="sss" value={profileForm.sss || ''} onChange={handleProfileInput} /></div>
                      </div>
                      <div className="form-row">
                        <div className="form-group"><label>GSIS No.</label><input type="text" name="gsis" value={profileForm.gsis || ''} onChange={handleProfileInput} /></div>
                        <div className="form-group"><label>PhilHealth No.</label><input type="text" name="philhealth" value={profileForm.philhealth || ''} onChange={handleProfileInput} /></div>
                      </div>
                    </>
                  )}

                  {/* ── Remarks ── */}
                  {profileActiveTab === 'remarks' && (
                    <div className="form-group">
                      <label>Remarks / Notes</label>
                      <textarea name="remarks" value={profileForm.remarks || ''} onChange={handleProfileInput} rows={6} placeholder="Any additional notes..." />
                    </div>
                  )}

                </div>{/* end minHeight wrapper */}

                {/* ── Footer actions ── */}
                <div className="form-actions" style={{ display:'flex', justifyContent:'flex-end', gap:'12px', marginTop:'8px' }}>
                  <button type="button" className="btn-secondary" onClick={() => setIsProfileModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-submit" disabled={isSavingProfile}>
                    <i className="ri-save-line" style={{ marginRight:'6px' }}></i>
                    {isSavingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ── Avatar Image Cropper ─────────────────────────────────────────── */}
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

