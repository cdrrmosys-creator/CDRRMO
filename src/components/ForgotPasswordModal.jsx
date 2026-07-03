import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase, supabaseAdmin } from '../services/supabase'

export default function ForgotPasswordModal({ onClose }) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)

    try {
      const normalizedEmail = email.trim().toLowerCase().includes('@')
        ? email.trim().toLowerCase()
        : `${email.trim().toLowerCase()}@cdrrmo.gov`

      // ── Step 1: Check if the email exists in the system ──────────────────
      const client = supabaseAdmin || supabase
      const { data: empMatch, error: empError } = await client
        .from('employees')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle()

      if (empError) throw empError

      if (!empMatch) {
        setError('No account found with that email address. Please check and try again.')
        setSubmitting(false)
        return
      }

      // ── Step 2: Check for existing pending request to prevent spam ────────
      const { data: existing, error: checkError } = await supabase
        .from('password_reset_requests')
        .select('id, status')
        .eq('email', normalizedEmail)
        .eq('status', 'pending')
        .maybeSingle()

      if (checkError) throw checkError

      if (existing) {
        setError('A reset request for this account is already pending. Please wait for an administrator to process it.')
        setSubmitting(false)
        return
      }

      // ── Step 3: Submit the reset request ─────────────────────────────────
      const securityToken = crypto.randomUUID()

      const { error: insertError } = await supabase
        .from('password_reset_requests')
        .insert([{
          email: normalizedEmail,
          security_token: securityToken,
          status: 'pending',
        }])

      if (insertError) throw insertError

      setSubmitted(true)
    } catch (err) {
      console.error('Reset request error:', err)
      setError(err.message || 'Failed to submit request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(10,0,0,0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease'
      }}
      onClick={onClose}
    >
      <div
        style={{
          /* Matches the auth-screen card: dark red-navy tones */
          background: 'linear-gradient(160deg, rgba(69,10,10,0.97) 0%, rgba(30,10,10,0.97) 50%, rgba(15,23,42,0.97) 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
          padding: '36px 32px',
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(220,38,38,0.1)',
          position: 'relative',
          animation: 'slideUp 0.25s ease',
          backdropFilter: 'blur(20px)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px', width: '32px', height: '32px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'rgba(255,255,255,0.55)',
            fontSize: '18px', transition: 'all 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.2)'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
        >
          <i className="ri-close-line" />
        </button>

        {submitted ? (
          /* ── Success state ── */
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #dc2626, #991b1b)',
              border: '2px solid rgba(220,38,38,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: '26px', color: '#fff'
            }}>
              <i className="ri-checkbox-circle-line" />
            </div>
            <h3 style={{ color: '#fff', fontWeight: '800', fontSize: '20px', marginBottom: '12px' }}>
              Request Submitted!
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: '1.75', marginBottom: '24px' }}>
              Your password reset request has been submitted successfully.
              Please wait for an administrator to review and approve your request.
              You will be notified once your password has been reset.
            </p>
            <button
              onClick={onClose}
              style={{
                width: '100%', padding: '13px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                border: '1px solid rgba(220,38,38,0.4)',
                color: '#fff', fontWeight: '700',
                fontSize: '14px', cursor: 'pointer',
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              Back to Login
            </button>
          </div>
        ) : (
          /* ── Form state ── */
          <>
            {/* Icon + Title */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '16px',
                background: 'linear-gradient(135deg, #dc2626, #7f1d1d)',
                border: '1px solid rgba(220,38,38,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px', fontSize: '24px', color: '#fff'
              }}>
                <i className="ri-lock-password-line" />
              </div>
              <h3 style={{ color: '#fff', fontWeight: '800', fontSize: '20px', marginBottom: '8px' }}>
                Forgot Password?
              </h3>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', lineHeight: '1.65' }}>
                Enter your email. An administrator will review your
                request and reset your password.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{
                  display: 'block', fontSize: '12px', fontWeight: '700',
                  color: 'rgba(255,255,255,0.7)', marginBottom: '8px',
                  textTransform: 'uppercase', letterSpacing: '0.5px'
                }}>
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    autoFocus
                    style={{
                      width: '100%', padding: '12px 12px 12px 40px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.13)',
                      borderRadius: '10px', color: '#fff',
                      fontSize: '14px', outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={e => e.target.style.borderColor = 'rgba(220,38,38,0.6)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.13)'}
                  />
                  <i className="ri-mail-line" style={{
                    position: 'absolute', left: '13px', top: '50%',
                    transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.35)',
                    fontSize: '16px', pointerEvents: 'none'
                  }} />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div style={{
                  padding: '11px 14px',
                  background: 'rgba(220,38,38,0.15)',
                  border: '1px solid rgba(220,38,38,0.35)',
                  borderRadius: '8px', color: '#fca5a5',
                  fontSize: '13px', fontWeight: '600',
                  display: 'flex', alignItems: 'flex-start', gap: '8px'
                }}>
                  <i className="ri-error-warning-line" style={{ fontSize: '15px', flexShrink: 0, marginTop: '1px' }} />
                  <span>{error}</span>
                </div>
              )}

              {/* Security note */}
              <div style={{
                padding: '10px 14px',
                background: 'rgba(250,204,21,0.07)',
                border: '1px solid rgba(250,204,21,0.2)',
                borderRadius: '8px', color: 'rgba(250,204,21,0.8)',
                fontSize: '12px', display: 'flex', alignItems: 'flex-start', gap: '8px'
              }}>
                <i className="ri-shield-check-line" style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }} />
                <span>Your request will be reviewed by a system administrator before any password is changed.</span>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || !email.trim()}
                style={{
                  width: '100%', padding: '13px',
                  background: submitting || !email.trim()
                    ? 'rgba(220,38,38,0.3)'
                    : 'linear-gradient(135deg, #dc2626, #b91c1c)',
                  border: '1px solid rgba(220,38,38,0.4)',
                  borderRadius: '10px',
                  color: '#fff', fontWeight: '700', fontSize: '14px',
                  cursor: submitting || !email.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => { if (!submitting && email.trim()) e.currentTarget.style.opacity = '0.88' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
              >
                {submitting ? (
                  <>
                    <span style={{
                      width: '16px', height: '16px', borderRadius: '50%',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff', display: 'inline-block',
                      animation: 'loginSpin 0.7s linear infinite'
                    }} />
                    Submitting...
                  </>
                ) : (
                  <>
                    <i className="ri-send-plane-line" />
                    Submit Reset Request
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'transparent', border: 'none',
                  color: 'rgba(255,255,255,0.35)', fontSize: '13px',
                  cursor: 'pointer', textDecoration: 'underline',
                  padding: '4px', transition: 'color 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}
              >
                Cancel, go back to login
              </button>
            </form>
          </>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>,
    document.body
  )
}
