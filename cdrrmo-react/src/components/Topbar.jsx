import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'

export default function Topbar() {
  const navigate = useNavigate()
  const { signOut, user } = useAuthStore()

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
      <div className="topbar-search">
        <i className="ri-search-line"></i>
        <input type="text" placeholder="Search..." />
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
