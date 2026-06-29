import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useIsAdmin } from '../hooks/useIsAdmin'

export default function Sidebar() {
  const isAdmin = useIsAdmin()
  const location = useLocation()

  const [expandedGroups, setExpandedGroups] = useState({
    'Personnel': true,
    'Operations': true,
    'Facilities': false,
    'Fleet': false,
    'Programs': false,
    'Governance': false,
    'Resources': false,
    'Records': false,
    'System Logs': false
  })

  const toggleGroup = (groupTitle, hasActiveChild) => {
    // Don't allow collapsing a group that contains the currently active page
    if (hasActiveChild) return
    setExpandedGroups(prev => ({ ...prev, [groupTitle]: !prev[groupTitle] }))
  }

  // Pre-expand group if active route is inside it
  const isPathActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/')

  const navGroups = [
    { type: 'link', label: 'Dashboard', icon: 'ri-dashboard-line', path: '/' },
    { type: 'link', label: 'Kloudtrack', icon: 'ri-cloud-windy-line', path: '/kloudtrack' },
    
    {
      type: 'group',
      title: 'Personnel',
      icon: 'ri-user-line',
      items: [
        { label: 'Employees', icon: 'ri-team-line', path: '/employees' },
      ]
    },
    {
      type: 'group',
      title: 'Operations',
      icon: 'ri-alert-line',
      items: [
        { label: 'Incidents', icon: 'ri-alarm-warning-line', path: '/incidents' },
        { label: 'Drowning Incidents', icon: 'ri-water-flash-line', path: '/drowning-incidents' },
        { label: 'Command Center CCTV', icon: 'ri-vidicon-line', path: '/cctv' },
        { label: 'Vouchers', icon: 'ri-file-text-line', path: '/vouchers' },
        { label: 'Inventory', icon: 'ri-archive-line', path: '/inventory' },
        { label: 'Transport', icon: 'ri-taxi-line', path: '/transport' },
      ]
    },
    {
      type: 'group',
      title: 'Facilities',
      icon: 'ri-building-4-line',
      items: [
        { label: 'Venues', icon: 'ri-building-line', path: '/venues' },
      ]
    },
    {
      type: 'group',
      title: 'Fleet',
      icon: 'ri-steering-2-line',
      items: [
        { label: 'Vehicles', icon: 'ri-truck-line', path: '/vehicles' },
        { label: 'Drivers', icon: 'ri-steering-2-line', path: '/drivers' },
      ]
    },
    {
      type: 'group',
      title: 'Programs',
      icon: 'ri-rocket-line',
      items: [
        { label: 'Activities', icon: 'ri-rocket-line', path: '/activities' },
        { label: 'Events Assistance', icon: 'ri-calendar-event-line', path: '/events-assistance' },
        { label: 'Training Attended', icon: 'ri-book-read-line', path: '/training-attended' },
        { label: 'Training Conducted', icon: 'ri-presentation-line', path: '/training-conducted' },
        { label: 'Volunteers', icon: 'ri-user-star-line', path: '/volunteers' },
      ]
    },
    {
      type: 'group',
      title: 'Governance',
      icon: 'ri-government-line',
      items: [
        { label: 'CDRRMC Resolutions', icon: 'ri-file-list-3-line', path: '/cdrrmc-reso' },
        { label: 'CDRRMC Meetings', icon: 'ri-group-line', path: '/cdrrmc-meeting' },
      ]
    },
    {
      type: 'group',
      title: 'Resources',
      icon: 'ri-tools-fill',
      items: [
        { label: 'Maps Available', icon: 'ri-map-2-line', path: '/maps' },
        { label: 'Pruning & Trimming', icon: 'ri-scissors-line', path: '/pruning' },
      ]
    },
    {
      type: 'group',
      title: 'Records',
      icon: 'ri-folder-info-line',
      items: [
        { label: 'Client Satisfaction', icon: 'ri-emotion-happy-line', path: '/client-satisfaction' },
        { label: 'History', icon: 'ri-history-line', path: '/history' },
        { label: 'Documentation', icon: 'ri-folder-line', path: '/documentation' },
        { label: 'Calendar Events', icon: 'ri-calendar-line', path: '/calendar' },
      ]
    },
    ...(isAdmin ? [{
      type: 'group',
      title: 'System Logs',
      icon: 'ri-settings-4-line',
      items: [
        { label: 'Audit Trail',        icon: 'ri-shield-keyhole-line', path: '/audit-trail' },
        { label: 'User Permissions',   icon: 'ri-shield-user-line',    path: '/user-permissions' },
        { label: 'Password Resets',    icon: 'ri-lock-password-line',  path: '/password-reset-requests' },
      ]
    }] : [])
  ]

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <i className="ri-shield-flash-line"></i>
        </div>
        <div className="sidebar-brand">CDRRMO</div>
      </div>

      <div className="sidebar-nav">
        {navGroups.map((group, index) => {
          if (group.type === 'link') {
            return (
              <NavLink
                key={index}
                to={group.path}
                className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
                end={group.path === '/'}
              >
                <span className="nav-icon"><i className={group.icon}></i></span>
                {group.label}
              </NavLink>
            )
          }

          if (group.type === 'group') {
            const hasActiveChild = group.items.some(item => isPathActive(item.path))
            // Force open if active child, otherwise use user's toggle state
            const isExpanded = hasActiveChild || expandedGroups[group.title]
            
            return (
              <div key={index} style={{ marginBottom: '4px' }}>
                <div 
                  onClick={() => toggleGroup(group.title, hasActiveChild)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    color: hasActiveChild ? 'var(--text-main)' : 'var(--text-muted)',
                    cursor: hasActiveChild ? 'default' : 'pointer',
                    fontWeight: 800,
                    fontSize: '11px',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    transition: 'all 0.2s',
                    background: isExpanded ? 'rgba(220, 38, 38, 0.08)' : 'transparent',
                    marginBottom: isExpanded ? '4px' : '0'
                  }}
                  onMouseEnter={(e) => { if (!hasActiveChild) e.currentTarget.style.background = isExpanded ? 'rgba(220, 38, 38, 0.12)' : 'var(--bg-surface)' }}
                  onMouseLeave={(e) => { if (!hasActiveChild) e.currentTarget.style.background = isExpanded ? 'rgba(220, 38, 38, 0.08)' : 'transparent' }}
                >
                  <i className={group.icon} style={{ marginRight: '12px', fontSize: '16px', color: hasActiveChild ? 'var(--primary)' : 'inherit' }}></i>
                  <span style={{ flex: 1 }}>{group.title}</span>
                  {/* Only show arrow when group is collapsible (no active child) */}
                  {!hasActiveChild && (
                    <i className={`ri-arrow-${isExpanded ? 'down' : 'right'}-s-line`} style={{ opacity: 0.7, fontSize: '18px' }}></i>
                  )}
                </div>
                
                {isExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '32px' }}>
                    {group.items.map((item, iIdx) => (
                      <NavLink
                        key={iIdx}
                        to={item.path}
                        className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
                        style={{ padding: '8px 12px', fontSize: '13px' }}
                      >
                        <span className="nav-icon" style={{ fontSize: '16px', marginRight: '8px' }}><i className={item.icon}></i></span>
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          }
          
          return null
        })}
      </div>
    </div>
  )
}
