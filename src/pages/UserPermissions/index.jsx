import { useState, useEffect, useCallback } from 'react'
import { supabase, supabaseAdmin } from '../../services/supabase'
import { useIsAdmin } from '../../hooks/useIsAdmin'
import { useToast } from '../../components/Toast'
import { useNavigate } from 'react-router-dom'

// ── All modules the system has ────────────────────────────────────────────────
const MODULES = [
  { key: 'dashboard',           label: 'Dashboard',              section: 'General' },
  { key: 'employees',           label: 'Employees',              section: 'Personnel' },
  { key: 'attendance',          label: 'Attendance',             section: 'Personnel' },
  { key: 'incidents',           label: 'Incidents',              section: 'Operations' },
  { key: 'cctv',                label: 'Command Center CCTV',    section: 'Operations' },
  { key: 'vouchers',            label: 'Vouchers',               section: 'Operations' },
  { key: 'inventory',           label: 'Inventory',              section: 'Operations' },
  { key: 'transport',           label: 'Transport',              section: 'Operations' },
  { key: 'logistic',            label: 'Logistic (Borrowed Items)', section: 'Operations' },
  { key: 'venues',              label: 'Venues',                 section: 'Facilities' },
  { key: 'vehicles',            label: 'Vehicles',               section: 'Fleet' },
  { key: 'drivers',             label: 'Drivers',                section: 'Fleet' },
  { key: 'activities',          label: 'Activities',             section: 'Programs' },
  { key: 'events-assistance',   label: 'Events Assistance',      section: 'Programs' },
  { key: 'training-attended',   label: 'Training Attended',      section: 'Programs' },
  { key: 'training-conducted',  label: 'Training Conducted',     section: 'Programs' },
  { key: 'volunteers',          label: 'Volunteers',             section: 'Programs' },
  { key: 'cdrrmc-reso',         label: 'CDRRMC Resolutions',     section: 'Governance' },
  { key: 'cdrrmc-meeting',      label: 'CDRRMC Meetings',        section: 'Governance' },
  { key: 'maps',                label: 'Maps Available',         section: 'Resources' },
  { key: 'pruning',             label: 'Pruning & Trimming',     section: 'Resources' },
  { key: 'client-satisfaction', label: 'Client Satisfaction',    section: 'Records' },
  { key: 'history',             label: 'History',                section: 'Records' },
  { key: 'documentation',       label: 'Documentation',          section: 'Records' },
  { key: 'calendar',            label: 'Calendar Events',        section: 'Records' },
]

const CRUD = ['can_create', 'can_read', 'can_update', 'can_delete']
const CRUD_LABELS = { can_create: 'Create', can_read: 'Read', can_update: 'Update', can_delete: 'Delete' }
const CRUD_COLORS = { can_create: '#16a34a', can_read: '#2563eb', can_update: '#d97706', can_delete: '#dc2626' }

export default function UserPermissions() {
  const isAdmin = useIsAdmin()
  const navigate = useNavigate()
  const toast = useToast()

  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [permissions, setPermissions] = useState({}) // { moduleKey: { can_create, can_read, can_update, can_delete } }
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingPerms, setLoadingPerms] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchUser, setSearchUser] = useState('')
  const [dirty, setDirty] = useState(false)

  // Redirect non-admins
  useEffect(() => {
    if (!isAdmin) navigate('/', { replace: true })
  }, [isAdmin, navigate])

  // Load all auth users via admin client
  useEffect(() => {
    const load = async () => {
      setLoadingUsers(true)
      try {
        if (!supabaseAdmin) {
          toast.error('Admin client not available. Check VITE_SUPABASE_SERVICE_KEY.')
          return
        }

        // Paginate through all users — listUsers defaults to 50 per page
        let allUsers = []
        let page = 1
        const perPage = 50
        while (true) {
          const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
          if (error) throw error
          const batch = data?.users || []
          allUsers = allUsers.concat(batch)
          if (batch.length < perPage) break // last page
          page++
        }

        // Show all non-admin users (admins manage themselves)
        const nonAdmins = allUsers.filter(u => u.user_metadata?.role !== 'admin')
        setUsers(nonAdmins)
      } catch (err) {
        toast.error('Failed to load users: ' + err.message)
      } finally {
        setLoadingUsers(false)
      }
    }
    load()
  }, [])

  // Load permissions for selected user
  const loadPermissions = useCallback(async (userId) => {
    setLoadingPerms(true)
    try {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', userId)
      if (error) throw error

      // Build a map from module key → perms, filling defaults for missing modules
      const map = {}
      MODULES.forEach(m => {
        map[m.key] = { can_create: false, can_read: true, can_update: false, can_delete: false }
      })
      ;(data || []).forEach(row => {
        if (map[row.module] !== undefined) {
          map[row.module] = {
            can_create: row.can_create,
            can_read:   row.can_read,
            can_update: row.can_update,
            can_delete: row.can_delete,
          }
        }
      })
      setPermissions(map)
      setDirty(false)
    } catch (err) {
      toast.error('Failed to load permissions: ' + err.message)
    } finally {
      setLoadingPerms(false)
    }
  }, [])

  const handleSelectUser = (user) => {
    setSelectedUser(user)
    loadPermissions(user.id)
  }

  const togglePerm = (moduleKey, field) => {
    setPermissions(prev => ({
      ...prev,
      [moduleKey]: { ...prev[moduleKey], [field]: !prev[moduleKey][field] }
    }))
    setDirty(true)
  }

  const setAllForModule = (moduleKey, value) => {
    setPermissions(prev => ({
      ...prev,
      [moduleKey]: { can_create: value, can_read: value, can_update: value, can_delete: value }
    }))
    setDirty(true)
  }

  const setAllForPermission = (field) => {
    // If all are checked, uncheck all. Otherwise check all.
    const allChecked = MODULES.every(m => permissions[m.key]?.[field])
    setPermissions(prev => {
      const next = { ...prev }
      MODULES.forEach(m => { next[m.key] = { ...next[m.key], [field]: !allChecked } })
      return next
    })
    setDirty(true)
  }

  const handleSave = async () => {
    if (!selectedUser) return
    setSaving(true)
    try {
      // Upsert all module rows at once
      const rows = MODULES.map(m => ({
        user_id:    selectedUser.id,
        module:     m.key,
        can_create: permissions[m.key]?.can_create ?? false,
        can_read:   permissions[m.key]?.can_read   ?? true,
        can_update: permissions[m.key]?.can_update ?? false,
        can_delete: permissions[m.key]?.can_delete ?? false,
      }))

      const { error } = await supabase
        .from('user_permissions')
        .upsert(rows, { onConflict: 'user_id,module' })

      if (error) throw error
      setDirty(false)
      toast.success(`Permissions saved for ${selectedUser.email}`)
    } catch (err) {
      toast.error('Failed to save permissions: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleGrantAll = () => {
    MODULES.forEach(m => setAllForModule(m.key, true))
    setDirty(true)
  }

  const handleRevokeAll = () => {
    MODULES.forEach(m => {
      setPermissions(prev => ({
        ...prev,
        [m.key]: { can_create: false, can_read: true, can_update: false, can_delete: false }
      }))
    })
    setDirty(true)
  }

  const filteredUsers = users.filter(u =>
    !searchUser ||
    (u.email || '').toLowerCase().includes(searchUser.toLowerCase()) ||
    ((u.user_metadata?.full_name || u.user_metadata?.name || '')).toLowerCase().includes(searchUser.toLowerCase())
  )

  // Group modules by section for display
  const sections = [...new Set(MODULES.map(m => m.section))]

  if (!isAdmin) return null

  return (
    <div>
      <div className="page-header">
        <h2><i className="ri-shield-user-line" style={{ marginRight: '10px' }} />User Permissions</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'start' }}>

        {/* ── Left: User list ── */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ fontWeight: '800', fontSize: '14px', marginBottom: '10px' }}>Users</div>
            <div style={{ position: 'relative' }}>
              <i className="ri-search-line" style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search users…"
                value={searchUser}
                onChange={e => setSearchUser(e.target.value)}
                style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: '7px', border: '1px solid var(--border-light)', background: 'var(--bg-app)', fontSize: '13px', color: 'var(--text)', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div style={{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }}>
            {loadingUsers ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                <i className="ri-loader-4-line" style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }} />Loading users…
              </div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No users found.</div>
            ) : filteredUsers.map(u => {
              const name = u.user_metadata?.full_name || u.user_metadata?.name || ''
              const isSelected = selectedUser?.id === u.id
              return (
                <div
                  key={u.id}
                  onClick={() => handleSelectUser(u)}
                  style={{
                    padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)',
                    background: isSelected ? 'var(--primary)' : 'transparent',
                    transition: 'background 0.15s'
                  }}
                >
                  <div style={{ fontWeight: '700', fontSize: '13px', color: isSelected ? '#fff' : 'var(--text)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name || u.email}
                  </div>
                  <div style={{ fontSize: '12px', color: isSelected ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name ? u.email : <span style={{ fontStyle: 'italic' }}>no display name</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Right: Permissions matrix ── */}
        <div>
          {!selectedUser ? (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)', boxShadow: 'var(--shadow-sm)' }}>
              <i className="ri-user-settings-line" style={{ fontSize: '48px', display: 'block', marginBottom: '12px', opacity: 0.4 }} />
              <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>Select a user</div>
              <div style={{ fontSize: '13px' }}>Choose a user from the list to manage their module permissions.</div>
            </div>
          ) : loadingPerms ? (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '60px 24px', textAlign: 'center', color: 'var(--text-muted)', boxShadow: 'var(--shadow-sm)' }}>
              <i className="ri-loader-4-line" style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }} />Loading permissions…
            </div>
          ) : (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>

              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '15px' }}>
                    {selectedUser.user_metadata?.full_name || selectedUser.user_metadata?.name || selectedUser.email}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{selectedUser.email}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button onClick={handleGrantAll} style={{ padding: '7px 14px', borderRadius: '7px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                    <i className="ri-checkbox-multiple-line" style={{ marginRight: '5px' }} />Grant All
                  </button>
                  <button onClick={handleRevokeAll} style={{ padding: '7px 14px', borderRadius: '7px', border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>
                    <i className="ri-close-circle-line" style={{ marginRight: '5px' }} />Reset All
                  </button>
                  <button onClick={handleSave} disabled={saving || !dirty} style={{
                    padding: '7px 20px', borderRadius: '7px', border: 'none',
                    background: dirty ? 'var(--primary)' : '#9ca3af',
                    color: '#fff', fontSize: '13px', fontWeight: '700',
                    cursor: dirty ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px'
                  }}>
                    {saving ? <i className="ri-loader-4-line ri-spin" /> : <i className="ri-save-line" />}
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>

              {/* Column-level bulk toggles */}
              <div style={{ padding: '10px 20px', background: 'var(--bg-app)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700', marginRight: '4px' }}>Toggle column:</span>
                {CRUD.map(field => {
                  const allChecked = MODULES.every(m => permissions[m.key]?.[field])
                  return (
                    <button key={field} onClick={() => setAllForPermission(field)} style={{
                      padding: '3px 12px', borderRadius: '5px', fontSize: '11px', fontWeight: '700', cursor: 'pointer',
                      border: `1px solid ${allChecked ? CRUD_COLORS[field] : CRUD_COLORS[field] + '40'}`,
                      background: allChecked ? CRUD_COLORS[field] : `${CRUD_COLORS[field]}12`,
                      color: allChecked ? '#fff' : CRUD_COLORS[field],
                      transition: 'all 0.15s'
                    }}>
                      All {CRUD_LABELS[field]}
                    </button>
                  )
                })}
              </div>

              {/* Permissions table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-app)' }}>
                      <th style={{ textAlign: 'left', padding: '10px 20px', fontWeight: '700', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px', width: '220px' }}>Module</th>
                      {CRUD.map(f => (
                        <th key={f} style={{ textAlign: 'center', padding: '10px 16px', fontWeight: '800', fontSize: '12px', color: CRUD_COLORS[f], textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>
                          {CRUD_LABELS[f]}
                        </th>
                      ))}
                      <th style={{ textAlign: 'center', padding: '10px 16px', fontWeight: '700', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>All / None</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.map(section => (
                      <>
                        <tr key={`sec-${section}`}>
                          <td colSpan={6} style={{ padding: '8px 20px 4px', background: 'var(--bg-app)', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', borderTop: '1px solid var(--border-light)' }}>
                            {section}
                          </td>
                        </tr>
                        {MODULES.filter(m => m.section === section).map((mod, idx) => {
                          const p = permissions[mod.key] || {}
                          const allOn = CRUD.every(f => p[f])
                          return (
                            <tr key={mod.key} style={{ borderBottom: '1px solid var(--border-light)', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-app)' }}>
                              <td style={{ padding: '11px 20px', fontWeight: '600', color: 'var(--text)' }}>{mod.label}</td>
                              {CRUD.map(field => (
                                <td key={field} style={{ textAlign: 'center', padding: '11px 16px' }}>
                                  <button
                                    type="button"
                                    onClick={() => togglePerm(mod.key, field)}
                                    style={{
                                      width: '26px', height: '26px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                                      background: p[field] ? CRUD_COLORS[field] : 'var(--border-light)',
                                      color: p[field] ? '#fff' : 'var(--text-muted)',
                                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                      fontSize: '14px', transition: 'all 0.15s', flexShrink: 0
                                    }}
                                    title={`${p[field] ? 'Revoke' : 'Grant'} ${CRUD_LABELS[field]} on ${mod.label}`}
                                  >
                                    <i className={p[field] ? 'ri-check-line' : 'ri-close-line'} />
                                  </button>
                                </td>
                              ))}
                              <td style={{ textAlign: 'center', padding: '11px 16px' }}>
                                <button
                                  type="button"
                                  onClick={() => setAllForModule(mod.key, !allOn)}
                                  style={{
                                    padding: '3px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700',
                                    border: `1px solid ${allOn ? '#fecaca' : '#bbf7d0'}`,
                                    background: allOn ? '#fef2f2' : '#f0fdf4',
                                    color: allOn ? '#b91c1c' : '#15803d',
                                    cursor: 'pointer', whiteSpace: 'nowrap'
                                  }}
                                >
                                  {allOn ? 'None' : 'All'}
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
