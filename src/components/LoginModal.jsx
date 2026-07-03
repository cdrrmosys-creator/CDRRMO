import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { useToast } from './Toast'
import ForgotPasswordModal from './ForgotPasswordModal'

export default function LoginModal({ onClose }) {
  const navigate = useNavigate()
  const { signIn } = useAuthStore()
  const toast = useToast()
  
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [shake, setShake] = useState(false)
  const [showForgot, setShowForgot] = useState(false)

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 600)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return

    setError('')
    setIsSubmitting(true)

    let email = username.trim()
    if (!email.includes('@')) {
      email = `${email}@cdrrmo.gov`
    }

    try {
      const res = await signIn(email, password)
      if (res && !res.success) {
        const rawMsg = res.error || 'Invalid credentials. Please try again.'
        const errorMsg = rawMsg.toLowerCase().includes('invalid login credentials')
          ? 'Incorrect username or password. Please try again.'
          : rawMsg
        setPassword('')
        setError(errorMsg)
        triggerShake()
        toast.error(errorMsg)
      } else {
        onClose()
        navigate('/')
      }
    } catch (err) {
      console.error('Login error:', err)
      const rawMsg = err.message || 'Invalid credentials. Please try again.'
      const errorMsg = rawMsg.toLowerCase().includes('invalid login credentials')
        ? 'Incorrect username or password. Please try again.'
        : rawMsg
      setPassword('')
      setError(errorMsg)
      triggerShake()
      toast.error(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '400px', maxWidth: '90vw', padding: '32px', borderRadius: '16px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '20px', color: 'var(--text-main)', fontWeight: '700', marginBottom: '4px' }}>Staff Login</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Sign in to access modules</p>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <i className="ri-close-line" style={{ fontSize: '24px' }}></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="modal-username" style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)' }}>Username</label>
            <div style={{ position: 'relative' }}>
              <input
                id="modal-username"
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                style={{
                  width: '100%',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-main)',
                  padding: '12px 12px 12px 40px',
                  borderRadius: '8px',
                  outline: 'none',
                  fontSize: '14px'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-light)'}
              />
              <i className="ri-user-3-line" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '16px' }}></i>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label htmlFor="modal-password" style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="modal-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{
                  width: '100%',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-main)',
                  padding: '12px 44px 12px 40px',
                  borderRadius: '8px',
                  outline: 'none',
                  fontSize: '14px'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-light)'}
              />
              <i className="ri-lock-line" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '16px' }}></i>
              <i
                className={showPassword ? 'ri-eye-line' : 'ri-eye-off-line'}
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: '16px'
                }}
              ></i>
            </div>
          </div>

          <div style={{ textAlign: 'right', marginTop: '-8px' }}>
            <button
              type="button"
              onClick={() => setShowForgot(true)}
              style={{
                background: 'transparent', border: 'none',
                color: 'var(--primary)', fontSize: '12px',
                cursor: 'pointer', textDecoration: 'none', fontWeight: '600',
                padding: '2px 0', transition: 'opacity 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Forgot password?
            </button>
          </div>

          <div
            role="alert"
            aria-live="assertive"
            style={{ minHeight: error ? 'auto' : '0' }}
          >
            {error && (
              <div style={{
                padding: '10px',
                background: 'rgba(220, 38, 38, 0.1)',
                border: '1px solid rgba(220, 38, 38, 0.2)',
                borderRadius: '8px',
                color: '#dc2626',
                fontSize: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                animation: shake ? 'loginShake 0.5s ease' : 'none'
              }}>
                <i className="ri-error-warning-line" style={{ fontSize: '14px', flexShrink: 0 }}></i>
                <span>{error}</span>
              </div>
            )}
          </div>

          <button type="submit" className="btn-primary" disabled={isSubmitting} style={{ width: '100%', display: 'block', padding: '12px', borderRadius: '8px' }}>
            {isSubmitting ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  display: 'inline-block',
                  animation: 'loginSpin 0.7s linear infinite',
                  flexShrink: 0
                }} />
                Verifying...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {showForgot && (
          <ForgotPasswordModal onClose={() => setShowForgot(false)} />
        )}
      </div>
    </div>,
    document.body
  )
}
