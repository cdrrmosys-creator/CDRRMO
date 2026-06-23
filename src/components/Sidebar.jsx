import { NavLink } from 'react-router-dom'
import { useIsAdmin } from '../hooks/useIsAdmin'

export default function Sidebar() {
  const isAdmin = useIsAdmin()
  const navItems = [
    { label: 'Dashboard', icon: 'ri-dashboard-line', path: '/' },
    { label: 'Kloudtrack', icon: 'ri-cloud-windy-line', path: '/kloudtrack' },
    { section: 'Personnel' },
    { label: 'Employees', icon: 'ri-team-line', path: '/employees' },
    { section: 'Operations' },
    { label: 'Incidents', icon: 'ri-alarm-warning-line', path: '/incidents' },
    { label: 'Command Center CCTV', icon: 'ri-vidicon-line', path: '/cctv' },
    { label: 'Vouchers', icon: 'ri-file-text-line', path: '/vouchers' },
    { label: 'Inventory', icon: 'ri-archive-line', path: '/inventory' },
    { label: 'Transport', icon: 'ri-taxi-line', path: '/transport' },
    { section: 'Facilities' },
    { label: 'Venues', icon: 'ri-building-line', path: '/venues' },
    { section: 'Fleet' },
    { label: 'Vehicles', icon: 'ri-truck-line', path: '/vehicles' },
    { label: 'Drivers', icon: 'ri-steering-2-line', path: '/drivers' },
    { section: 'Programs' },
    { label: 'Activities', icon: 'ri-rocket-line', path: '/activities' },
    { label: 'Events Assistance', icon: 'ri-calendar-event-line', path: '/events-assistance' },
    { label: 'Training Attended', icon: 'ri-book-read-line', path: '/training-attended' },
    { label: 'Training Conducted', icon: 'ri-presentation-line', path: '/training-conducted' },
    { label: 'Volunteers', icon: 'ri-user-star-line', path: '/volunteers' },
    { section: 'Governance' },
    { label: 'CDRRMC Resolutions', icon: 'ri-file-list-3-line', path: '/cdrrmc-reso' },
    { label: 'CDRRMC Meetings', icon: 'ri-group-line', path: '/cdrrmc-meeting' },
    { section: 'Resources' },
    { label: 'Maps Available', icon: 'ri-map-2-line', path: '/maps' },
    { label: 'Pruning & Trimming', icon: 'ri-scissors-line', path: '/pruning' },
    { section: 'Records' },
    { label: 'Client Satisfaction', icon: 'ri-emotion-happy-line', path: '/client-satisfaction' },
    { label: 'History', icon: 'ri-history-line', path: '/history' },
    { label: 'Documentation', icon: 'ri-folder-line', path: '/documentation' },
    { label: 'Calendar Events', icon: 'ri-calendar-line', path: '/calendar' },
    ...(isAdmin ? [
      { section: 'System Logs' },
      { label: 'Audit Trail',       icon: 'ri-shield-keyhole-line', path: '/audit-trail' },
      { label: 'User Permissions',  icon: 'ri-shield-user-line',    path: '/user-permissions' },
    ] : [])
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
        {navItems.map((item, index) => {
          if (item.section) {
            return (
              <div key={index} className="nav-label">
                {item.section}
              </div>
            )
          }

          return (
            <NavLink
              key={index}
              to={item.path}
              className={({ isActive }) => 
                isActive ? 'nav-item active' : 'nav-item'
              }
              end={item.path === '/'}
            >
              <span className="nav-icon">
                <i className={item.icon}></i>
              </span>
              {item.label}
            </NavLink>
          )
        })}
      </div>
    </div>
  )
}
