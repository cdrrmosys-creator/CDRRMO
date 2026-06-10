import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/useAuthStore'

export default function Login() {
  const navigate = useNavigate()
  const { signIn, loading } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    let email = username.trim()
    // Fallback: If it's not a valid email, append default domain
    if (!email.includes('@')) {
      email = `${email}@cdrrmo.gov`
    }

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
              <p>Sign in to access the CDRRMO Recording System</p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <div className="input-wrapper">
                  <input
                    id="username"
                    type="text"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                  />
                  <i className="ri-user-3-line"></i>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="input-wrapper">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    style={{ paddingRight: '44px' }}
                  />
                  <i className="ri-lock-line"></i>
                  <i
                    className={showPassword ? 'ri-eye-line' : 'ri-eye-off-line'}
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      cursor: 'pointer',
                      pointerEvents: 'auto',
                      color: 'rgba(255, 255, 255, 0.5)',
                      fontSize: '18px'
                    }}
                  ></i>
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


              <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', display: 'block' }}>
                {loading ? (
                  <>
                    <i className="ri-loader-4-line" style={{ animation: 'spin 1s linear infinite', marginRight: '8px' }}></i>
                    Verifying...
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column - Branding */}
        <div className="auth-col-right">
          <div className="official-info-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="official-header-split">
              <div className="official-logos-split">
                <img 
                  src="https://lh3.googleusercontent.com/d/1-26zjRFIZWYnFHm-nUcrdue8wIx_rErz" 
                  alt="Palayan City Logo" 
                  onError={(e) => { e.target.style.display = 'none' }}
                />
                <img 
                  src="https://lh3.googleusercontent.com/d/1H0xg8TFCBl6A2jPycEZNI6dxyX-HmWZ8" 
                  alt="CDRRMO Logo" 
                  style={{ height: '96px' }}
                  onError={(e) => { e.target.style.display = 'none' }}
                />
                <img 
                  src="https://lh3.googleusercontent.com/d/1uY1Kn77Az5a25LLo23oo3uDk8ZOv8_so" 
                  alt="Rescue Logo" 
                  onError={(e) => { e.target.style.display = 'none' }}
                />
              </div>
              <div className="official-city-name-split">
                City of Palayan
                <br />
                <span className="city-subtext">Capital of Nueva Ecija</span>
              </div>
              <div className="official-office-name-split">
                City Disaster Risk Reduction and Management Office
              </div>
              <div className="official-rescue-name-split">
                Palayan City Rescue
              </div>
            </div>

            <div className="motto-block-split">
              <div className="motto-main-split">One Heart, One Mind, One Mission</div>
              <div className="motto-sub-split">“We Save Lives”</div>
            </div>

            <div className="mvv-block-split">
              <div className="mvv-item-split">
                <div className="mvv-label-split">Mission</div>
                <div className="mvv-text-split">
                  Deliver prompt and effective disaster response for Palayan City
                </div>
              </div>
              <div className="mvv-item-split">
                <div className="mvv-label-split">Vision</div>
                <div className="mvv-text-split">
                  A resilient community prepared for all hazards and disasters
                </div>
              </div>
              <div className="mvv-item-split">
                <div className="mvv-label-split">Core Values</div>
                <div className="mvv-text-split">
                  Service • Integrity • Excellence • Dedication
                </div>
              </div>
            </div>

            <div className="hotline-block-split">
              <div className="hotline-block-title-split">
                <i className="ri-phone-fill"></i> PALAYAN CITY EMERGENCY HOTLINE NUMBERS
              </div>
              <div className="hotline-row-split">
                <span>CDRRMO - Palayan City Rescue</span>
                <span>0920-574-1581 / 0966-910-9674</span>
              </div>
              <div className="hotline-row-split">
                <span>Palayan City Health Office</span>
                <span>0920-947-2735 / 0917-107-3808</span>
              </div>
              <div className="hotline-row-split">
                <span>Palayan City PNP Station</span>
                <span>0998-598-5430 / 0955-683-2498</span>
              </div>
              <div className="hotline-row-split">
                <span>Palayan City BFP Station</span>
                <span>0943-066-9962</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
