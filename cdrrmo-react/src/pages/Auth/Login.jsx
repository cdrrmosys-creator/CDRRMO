import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/useAuthStore'

export default function Login() {
  const navigate = useNavigate()
  const { signIn, loading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    try {
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      console.error('Login error:', err)
      setError(err.message || 'Invalid credentials. Please try again.')
    }
  }

  return (
    <div className="auth-screen">
      {/* Animated background blobs */}
      <div className="auth-blob blob-1"></div>
      <div className="auth-blob blob-2"></div>

      {/* Main auth container */}
      <div className="split-auth-container">
        {/* Left Column - Login Form */}
        <div className="auth-col-left">
          <div className="auth-form-card">
            <div className="auth-form-header">
              <h2>Welcome Back</h2>
              <p>Sign in to access the CDRRMO System</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <div className="input-wrapper">
                  <input
                    id="email"
                    type="email"
                    placeholder="admin@cdrrmo.gov"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                  <i className="ri-user-3-line"></i>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="input-wrapper">
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <i className="ri-lock-password-line"></i>
                </div>
              </div>

              {error && (
                <div style={{
                  padding: '12px',
                  background: 'rgba(220, 38, 38, 0.1)',
                  border: '1px solid rgba(220, 38, 38, 0.3)',
                  borderRadius: '8px',
                  color: '#fca5a5',
                  fontSize: '13px',
                  fontWeight: '600'
                }}>
                  {error}
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <i className="ri-loader-4-line" style={{ animation: 'spin 1s linear infinite' }}></i>
                    Signing In...
                  </>
                ) : (
                  <>
                    <i className="ri-login-box-line"></i>
                    Sign In
                  </>
                )}
              </button>
            </form>

            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: 'rgba(250, 204, 21, 0.1)',
              border: '1px solid rgba(250, 204, 21, 0.3)',
              borderRadius: '8px',
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.7)',
              textAlign: 'center'
            }}>
              <strong>For Testing:</strong> Create an account in Supabase Dashboard → Authentication → Add User
            </div>
          </div>
        </div>

        {/* Right Column - Branding */}
        <div className="auth-col-right">
          <div className="official-info-card">
            <div className="official-header-split">
              <div className="official-city-name-split">
                REPUBLIC OF THE PHILIPPINES
                <br />
                <span style={{ fontSize: '14px' }}>CITY OF [YOUR CITY]</span>
              </div>
              <div className="official-office-name-split">
                City Disaster Risk Reduction & Management Office
              </div>
            </div>

            <div className="motto-block-split">
              <div className="motto-main-split">Ready to Serve</div>
              <div className="motto-sub-split">RESCUE & RESPOND</div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '16px',
              marginTop: '8px'
            }}>
              <div style={{
                fontSize: '11px',
                fontWeight: '800',
                color: '#fca5a5',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '12px'
              }}>
                System Features
              </div>
              <ul style={{
                fontSize: '13px',
                color: 'rgba(255, 255, 255, 0.8)',
                lineHeight: '1.8',
                paddingLeft: '20px'
              }}>
                <li>Employee Management</li>
                <li>Incident Reporting & Tracking</li>
                <li>Vehicle & Driver Management</li>
                <li>Inventory & Equipment</li>
                <li>Training & Volunteer Records</li>
                <li>Documentation & Calendar Events</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
