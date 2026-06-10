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
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          color: 'var(--text-main)',
          marginRight: '8px'
        }}>
          {user?.email || 'User'}
        </div>
        <button className="btn-logout" onClick={handleLogout}>
          <i className="ri-logout-box-line"></i>
          Logout
        </button>
      </div>
    </div>
  )
}
