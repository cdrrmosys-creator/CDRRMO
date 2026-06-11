import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { supabase } from '../services/supabase'

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
  const [isCropperOpen, setIsCropperOpen] = useState(false)
  const [selectedImageSrc, setSelectedImageSrc] = useState(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  // Profile Form State
  const [profileName, setProfileName] = useState('')
  const [profileAvatar, setProfileAvatar] = useState('')

  useEffect(() => {
    if (user?.email) {
      fetchCurrentEmployee()
    }
  }, [user])

  const fetchCurrentEmployee = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('email', user.email)
        .single()
      
      if (!error && data) {
        setCurrentEmployee(data)
        setProfileName(data.name || '')
        setProfileAvatar(data.avatar_url || '')
      }
    } catch (err) {
      console.error('Error fetching employee record:', err)
    }
  }

  const handleProfileClick = () => {
    if (currentEmployee) {
      setProfileName(currentEmployee.name || '')
      setProfileAvatar(currentEmployee.avatar_url || '')
      setIsProfileModalOpen(true)
    }
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

  const handleCropComplete = async (blob) => {
    setIsCropperOpen(false)
    setIsSavingProfile(true)
    try {
      // Lazy load uploadFile
      const { uploadFile } = await import('../services/storage')
      const ext = blob.type === 'image/png' ? 'png' : 'jpeg'
      const filename = `${currentEmployee.employee_id || Date.now()}-profile-${Date.now()}.${ext}`
      const publicUrl = await uploadFile('avatars', filename, blob)
      
      // Update DB immediately
      const { error } = await supabase
        .from('employees')
        .update({ avatar_url: publicUrl })
        .eq('id', currentEmployee.id)
      
      if (!error) {
        setProfileAvatar(publicUrl)
        setCurrentEmployee(prev => ({ ...prev, avatar_url: publicUrl }))
      }
    } catch (err) {
      console.error('Error updating profile picture:', err)
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setIsSavingProfile(true)
    try {
      const { error } = await supabase
        .from('employees')
        .update({ name: profileName })
        .eq('id', currentEmployee.id)
      
      if (!error) {
        setCurrentEmployee(prev => ({ ...prev, name: profileName }))
        setIsProfileModalOpen(false)
      }
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

      {/* My Profile Modal */}
      {isProfileModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsProfileModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '400px' }}>
            <div className="modal-header">
              <h3>My Profile</h3>
              <button className="modal-close" onClick={() => setIsProfileModalOpen(false)}>
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSaveProfile} className="modal-form">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                  <div style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    background: 'var(--bg-app)',
                    border: '2px dashed var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    {isSavingProfile && !profileName ? (
                      <i className="ri-loader-4-line ri-spin" style={{ fontSize: '32px', color: 'var(--primary)' }}></i>
                    ) : profileAvatar ? (
                      <img src={profileAvatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <i className="ri-user-line" style={{ fontSize: '40px', color: 'var(--border-light)' }}></i>
                    )}
                  </div>
                  
                  <label style={{
                    background: 'var(--bg-app)',
                    color: 'var(--text-main)',
                    padding: '6px 16px',
                    borderRadius: '20px',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: 'pointer',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <i className="ri-camera-line"></i> Change Picture
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={{ display: 'none' }} 
                      onChange={handleFileChange}
                      disabled={isSavingProfile}
                    />
                  </label>
                </div>

                <div className="form-group">
                  <label>Name</label>
                  <input 
                    type="text" 
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-actions">
                  <button type="submit" className="btn-submit" disabled={isSavingProfile}>
                    {isSavingProfile ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Profile Image Cropper (Lazy Loaded) */}
      {isCropperOpen && selectedImageSrc && (
        <ImageCropperLoader 
          imageSrc={selectedImageSrc}
          onCropComplete={handleCropComplete}
          onClose={() => {
            setIsCropperOpen(false)
            setSelectedImageSrc(null)
          }}
        />
      )}

    </div>
  )
}

// Wrapper to lazy load ImageCropper so Topbar doesn't bundle Cropper unconditionally
function ImageCropperLoader({ imageSrc, onCropComplete, onClose }) {
  const [Component, setComponent] = useState(null)
  
  useEffect(() => {
    import('./ImageCropper').then(mod => {
      setComponent(() => mod.default)
    })
  }, [])

  if (!Component) return null
  return <Component isOpen={true} onClose={onClose} imageSrc={imageSrc} onCropComplete={onCropComplete} />
}

