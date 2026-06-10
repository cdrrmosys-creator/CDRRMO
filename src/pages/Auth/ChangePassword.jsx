import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { useAuthStore } from '../../stores/useAuthStore'

export default function ChangePassword() {
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (newPassword === '123456') {
      setError('Your new password cannot be the default password. Please choose a different one.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please try again.')
      return
    }

    setLoading(true)
    try {
      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { needs_password_change: false }
      })

      if (updateError) throw updateError

      setSuccess(true)
      setTimeout(() => {
        navigate('/', { replace: true })
        window.location.reload() // Refresh to clear the metadata check
      }, 2000)
    } catch (err) {
      console.error('Password change error:', err)
      setError(err.message || 'Failed to update password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="auth-screen">
      {/* Animated background blobs */}
      <div className="auth-blob blob-1"></div>
      <div className="auth-blob blob-2"></div>

      <div style={{
        width: '100%',
        maxWidth: '460px',
        margin: '0 auto',
        padding: '24px',
        position: 'relative',
        zIndex: 10
      }}>
        <div className="auth-form-card">

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: '28px'
            }}>
              🔐
            </div>
            <h2 style={{
              fontSize: '22px',
              fontWeight: '800',
              color: '#fff',
              marginBottom: '8px'
            }}>
              Password Change Required
            </h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: '1.6' }}>
              You are currently using the default password. <br />
              You <strong style={{ color: '#fbbf24' }}>must</strong> set a new password before accessing the system.
            </p>
          </div>

          {/* Account info */}
          <div style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '24px',
            fontSize: '13px',
            color: 'rgba(255,255,255,0.7)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <i className="ri-user-3-line" style={{ fontSize: '16px', color: '#60a5fa' }}></i>
            <span>Logged in as <strong style={{ color: '#fff' }}>{user?.email}</strong></span>
          </div>

          {success ? (
            <div style={{
              textAlign: 'center',
              padding: '32px 16px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
              <h3 style={{ color: '#4ade80', fontWeight: '700', marginBottom: '8px' }}>
                Password Changed!
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>
                Redirecting you to the dashboard...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* New Password */}
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="new-password" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                  New Password *
                </label>
                <div className="input-wrapper" style={{ position: 'relative' }}>
                  <input
                    id="new-password"
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter your new password"
                    required
                    autoComplete="new-password"
                    style={{ paddingRight: '48px' }}
                  />
                  <i
                    className={showNew ? 'ri-eye-off-line' : 'ri-eye-line'}
                    onClick={() => setShowNew(!showNew)}
                    style={{
                      position: 'absolute',
                      right: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      cursor: 'pointer',
                      fontSize: '16px',
                      color: 'rgba(255,255,255,0.5)',
                      zIndex: 2
                    }}
                  ></i>
                </div>
                {newPassword && newPassword.length < 6 && (
                  <p style={{ fontSize: '12px', color: '#f87171', marginTop: '4px' }}>
                    Must be at least 6 characters
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="confirm-password" style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                  Confirm New Password *
                </label>
                <div className="input-wrapper" style={{ position: 'relative' }}>
                  <input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    required
                    autoComplete="new-password"
                    style={{ paddingRight: '48px' }}
                  />
                  <i
                    className={showConfirm ? 'ri-eye-off-line' : 'ri-eye-line'}
                    onClick={() => setShowConfirm(!showConfirm)}
                    style={{
                      position: 'absolute',
                      right: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      cursor: 'pointer',
                      fontSize: '16px',
                      color: 'rgba(255,255,255,0.5)',
                      zIndex: 2
                    }}
                  ></i>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p style={{ fontSize: '12px', color: '#f87171', marginTop: '4px' }}>
                    Passwords do not match
                  </p>
                )}
                {confirmPassword && newPassword === confirmPassword && newPassword.length >= 6 && (
                  <p style={{ fontSize: '12px', color: '#4ade80', marginTop: '4px' }}>
                    ✓ Passwords match
                  </p>
                )}
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  padding: '12px',
                  background: 'rgba(220,38,38,0.15)',
                  border: '1px solid rgba(220,38,38,0.4)',
                  borderRadius: '8px',
                  color: '#fca5a5',
                  fontSize: '13px',
                  fontWeight: '600'
                }}>
                  <i className="ri-error-warning-line" style={{ marginRight: '6px' }}></i>
                  {error}
                </div>
              )}

              {/* Strength indicator */}
              {newPassword && (
                <div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>
                    Password Strength
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[1, 2, 3, 4].map((level) => {
                      const strength = Math.min(
                        Math.floor(newPassword.length / 3) +
                        (/[A-Z]/.test(newPassword) ? 1 : 0) +
                        (/[0-9]/.test(newPassword) ? 1 : 0) +
                        (/[^A-Za-z0-9]/.test(newPassword) ? 1 : 0),
                        4
                      )
                      const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e']
                      return (
                        <div key={level} style={{
                          flex: 1,
                          height: '4px',
                          borderRadius: '2px',
                          background: level <= strength ? colors[strength - 1] : 'rgba(255,255,255,0.1)',
                          transition: 'background 0.3s ease'
                        }} />
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || newPassword.length < 6 || newPassword !== confirmPassword}
                style={{ marginTop: '4px' }}
              >
                {loading ? (
                  <>
                    <i className="ri-loader-4-line" style={{ animation: 'spin 1s linear infinite' }}></i>
                    Updating Password...
                  </>
                ) : (
                  <>
                    <i className="ri-shield-check-line"></i>
                    Set New Password & Continue
                  </>
                )}
              </button>

              {/* Logout link */}
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: '4px'
                }}
              >
                Cancel & Log Out
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
