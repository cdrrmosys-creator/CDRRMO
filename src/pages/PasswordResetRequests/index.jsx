import { useState, useEffect, useCallback } from 'react'
import { supabase, supabaseAdmin } from '../../services/supabase'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useAuthStore } from '../../stores/useAuthStore'
import { useToast } from '../../components/Toast'
import { useNavigate } from 'react-router-dom'

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: '#d97706', bg: 'rgba(217,119,6,0.12)',  border: 'rgba(217,119,6,0.3)',  icon: 'ri-time-line' },
  approved: { label: 'Approved', color: '#16a34a', bg: 'rgba(22,163,74,0.12)',  border: 'rgba(22,163,74,0.3)',  icon: 'ri-checkbox-circle-line' },
  rejected: { label: 'Rejected', color: '#dc2626', bg: 'rgba(220,38,38,0.12)',  border: 'rgba(220,38,38,0.3)',  icon: 'ri-close-circle-line' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`
    }}>
      <i className={cfg.icon} style={{ fontSize: '13px' }} />
      {cfg.label}
    </span>
  )
}

export default function PasswordResetRequests() {
  const isAdmin = useIsAdmin()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useAuthStore()

  const [requests, setRequests]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('all')
  const [actionId, setActionId]   = useState(null) // id of row being processed
  const [rejectModal, setRejectModal] = useState(null) // { id, email }
  const [rejectNote, setRejectNote]   = useState('')
  const [confirmApprove, setConfirmApprove] = useState(null) // { id, email }

  // Redirect non-admins
  useEffect(() => {
    if (!isAdmin) navigate('/', { replace: true })
  }, [isAdmin, navigate])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('password_reset_requests')
        .select('*')
        .order('requested_at', { ascending: false })
      if (error) throw error
      setRequests(data || [])
    } catch (err) {
      toast.error('Failed to load reset requests: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  // ── Approve ─────────────────────────────────────────────────────────────────
  const handleApprove = async ({ id, email }) => {
    if (!supabaseAdmin) {
      toast.error('Admin client not available. Check VITE_SUPABASE_SERVICE_KEY.')
      return
    }
    setActionId(id)
    try {
      // 1. Verify the request still exists and is pending (security check)
      const { data: req, error: fetchErr } = await supabase
        .from('password_reset_requests')
        .select('id, status, security_token')
        .eq('id', id)
        .single()
      if (fetchErr) throw fetchErr
      if (req.status !== 'pending') {
        toast.error('This request has already been processed.')
        await load()
        return
      }

      // 2. Find the auth user by email
      const { data: usersPage, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      if (listErr) throw listErr
      const authUser = (usersPage?.users || []).find(u => u.email?.toLowerCase() === email.toLowerCase())
      if (!authUser) throw new Error(`No auth user found with email: ${email}`)

      // 3. Reset password to '123456' and flag needs_password_change
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        password: '123456',
        user_metadata: {
          ...authUser.user_metadata,
          needs_password_change: true,
        },
      })
      if (updateErr) throw updateErr

      // 4. Mark request as approved
      const { error: markErr } = await supabase
        .from('password_reset_requests')
        .update({
          status: 'approved',
          resolved_at: new Date().toISOString(),
          resolved_by: user?.email || 'admin',
        })
        .eq('id', id)
        .eq('security_token', req.security_token) // security: must match stored token
      if (markErr) throw markErr

      toast.success(`Password reset for ${email}. They will be prompted to change it on next login.`)
      await load()
    } catch (err) {
      console.error('Approve error:', err)
      toast.error('Failed to approve: ' + err.message)
    } finally {
      setActionId(null)
      setConfirmApprove(null)
    }
  }

  // ── Reject ───────────────────────────────────────────────────────────────────
  const handleReject = async () => {
    if (!rejectModal) return
    const { id } = rejectModal
    setActionId(id)
    try {
      const { error } = await supabase
        .from('password_reset_requests')
        .update({
          status: 'rejected',
          resolved_at: new Date().toISOString(),
          resolved_by: user?.email || 'admin',
          notes: rejectNote.trim() || null,
        })
        .eq('id', id)
      if (error) throw error
      toast.success('Request rejected.')
      setRejectModal(null)
      setRejectNote('')
      await load()
    } catch (err) {
      toast.error('Failed to reject: ' + err.message)
    } finally {
      setActionId(null)
    }
  }

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)
  const counts   = {
    all:      requests.length,
    pending:  requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  }

  const fmt = (ts) => ts ? new Date(ts).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

  return (
    <div className="page-container">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <i className="ri-lock-password-line" style={{ marginRight: '10px' }} />
            Password Reset Requests
          </h1>
          <p className="page-subtitle">
            Review and process user password reset requests
          </p>
        </div>
        <button className="btn-primary" onClick={load} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className={`ri-refresh-line ${loading ? 'ri-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Filter tabs ── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['all', 'pending', 'approved', 'rejected'].map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              padding: '8px 18px', borderRadius: '20px', border: 'none',
              fontWeight: '700', fontSize: '13px', cursor: 'pointer',
              transition: 'all 0.2s',
              background: filter === tab ? 'var(--primary)' : 'var(--bg-card)',
              color: filter === tab ? '#fff' : 'var(--text-muted)',
              boxShadow: filter === tab ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
              border: filter === tab ? 'none' : '1px solid var(--border-light)',
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            <span style={{
              marginLeft: '8px', background: filter === tab ? 'rgba(255,255,255,0.25)' : 'var(--bg-app)',
              padding: '1px 7px', borderRadius: '10px', fontSize: '11px'
            }}>
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="table-container">
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <span style={{
              width: '32px', height: '32px', borderRadius: '50%',
              border: '3px solid var(--border-light)', borderTopColor: 'var(--primary)',
              display: 'inline-block', animation: 'loginSpin 0.7s linear infinite'
            }} />
            <p style={{ marginTop: '16px' }}>Loading requests...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <i className="ri-inbox-line" style={{ fontSize: '40px', opacity: 0.4, display: 'block', marginBottom: '12px' }} />
            <p style={{ fontWeight: '600' }}>No {filter !== 'all' ? filter : ''} requests found.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Email / Username</th>
                <th>Status</th>
                <th>Requested At</th>
                <th>Resolved At</th>
                <th>Resolved By</th>
                <th>Notes</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(req => (
                <tr key={req.id}>
                  <td>
                    <div style={{ fontWeight: '600', color: 'var(--text-main)' }}>{req.email}</div>
                  </td>
                  <td><StatusBadge status={req.status} /></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{fmt(req.requested_at)}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{fmt(req.resolved_at)}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{req.resolved_by || '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px', maxWidth: '200px' }}>
                    {req.notes || '—'}
                  </td>
                  <td>
                    {req.status === 'pending' ? (
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => setConfirmApprove({ id: req.id, email: req.email })}
                          disabled={actionId === req.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '6px 14px', borderRadius: '8px', border: 'none',
                            background: 'rgba(22,163,74,0.12)', color: '#16a34a',
                            fontWeight: '700', fontSize: '12px', cursor: 'pointer',
                            border: '1px solid rgba(22,163,74,0.3)', transition: 'all 0.2s',
                            opacity: actionId === req.id ? 0.5 : 1
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(22,163,74,0.22)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(22,163,74,0.12)'}
                        >
                          {actionId === req.id ? (
                            <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid rgba(22,163,74,0.3)', borderTopColor: '#16a34a', display: 'inline-block', animation: 'loginSpin 0.7s linear infinite' }} />
                          ) : (
                            <i className="ri-checkbox-circle-line" />
                          )}
                          Approve
                        </button>
                        <button
                          onClick={() => { setRejectModal({ id: req.id, email: req.email }); setRejectNote('') }}
                          disabled={actionId === req.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '6px 14px', borderRadius: '8px',
                            background: 'rgba(220,38,38,0.10)', color: '#dc2626',
                            fontWeight: '700', fontSize: '12px', cursor: 'pointer',
                            border: '1px solid rgba(220,38,38,0.3)', transition: 'all 0.2s',
                            opacity: actionId === req.id ? 0.5 : 1
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(220,38,38,0.2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(220,38,38,0.10)'}
                        >
                          <i className="ri-close-circle-line" />
                          Reject
                        </button>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>—</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Approve Confirmation Modal ── */}
      {confirmApprove && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={() => setConfirmApprove(null)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '420px', border: '1px solid var(--border-light)', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(22,163,74,0.12)', border: '2px solid rgba(22,163,74,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '24px', color: '#16a34a' }}>
                <i className="ri-shield-check-line" />
              </div>
              <h3 style={{ fontWeight: '800', fontSize: '18px', color: 'var(--text-main)', marginBottom: '8px' }}>Approve Password Reset?</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6' }}>
                This will reset the password for <strong style={{ color: 'var(--text-main)' }}>{confirmApprove.email}</strong> to <code style={{ background: 'var(--bg-app)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>123456</code>.
                The user will be required to change it on next login.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setConfirmApprove(null)}
                style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid var(--border-light)', background: 'transparent', color: 'var(--text-muted)', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>
                Cancel
              </button>
              <button onClick={() => handleApprove(confirmApprove)} disabled={!!actionId}
                style={{ flex: 1, padding: '11px', borderRadius: '10px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: '700', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: actionId ? 0.6 : 1 }}>
                {actionId ? <span style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', display: 'inline-block', animation: 'loginSpin 0.7s linear infinite' }} /> : <i className="ri-checkbox-circle-line" />}
                Yes, Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ── */}
      {rejectModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={() => setRejectModal(null)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '420px', border: '1px solid var(--border-light)', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontWeight: '800', fontSize: '18px', color: 'var(--text-main)', marginBottom: '6px' }}>
                <i className="ri-close-circle-line" style={{ color: '#dc2626', marginRight: '8px' }} />
                Reject Request
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                Rejecting request for <strong style={{ color: 'var(--text-main)' }}>{rejectModal.email}</strong>
              </p>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: '700', fontSize: '13px', color: 'var(--text-main)', marginBottom: '8px' }}>
                Reason / Notes <span style={{ fontWeight: '400', color: 'var(--text-muted)' }}>(optional)</span>
              </label>
              <textarea
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                placeholder="e.g. Could not verify identity..."
                rows={3}
                style={{ width: '100%', resize: 'vertical', borderRadius: '8px', padding: '10px', border: '1px solid var(--border-light)', background: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setRejectModal(null)}
                style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid var(--border-light)', background: 'transparent', color: 'var(--text-muted)', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>
                Cancel
              </button>
              <button onClick={handleReject} disabled={!!actionId}
                style={{ flex: 1, padding: '11px', borderRadius: '10px', border: 'none', background: '#dc2626', color: '#fff', fontWeight: '700', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: actionId ? 0.6 : 1 }}>
                {actionId ? <span style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', display: 'inline-block', animation: 'loginSpin 0.7s linear infinite' }} /> : <i className="ri-close-circle-line" />}
                Reject Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
