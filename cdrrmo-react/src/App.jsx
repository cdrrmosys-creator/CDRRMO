import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/useAuthStore'

// Pages
import Login from './pages/Auth/Login'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Incidents from './pages/Incidents'
import Vouchers from './pages/Vouchers'
import Inventory from './pages/Inventory'
import Vehicles from './pages/Vehicles'
import Drivers from './pages/Drivers'
import Layout from './components/Layout'

function App() {
  const { user, loading, initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  if (loading) {
    return (
      <div className="loading-container">
        <i className="ri-loader-4-line loading-spinner"></i>
        <p>Loading CDRRMO System...</p>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          user ? <Navigate to="/" replace /> : <Login />
        } />
        
        <Route path="/" element={
          user ? <Layout /> : <Navigate to="/login" replace />
        }>
          <Route index element={<Dashboard />} />
          <Route path="employees" element={<Employees />} />
          <Route path="incidents" element={<Incidents />} />
          <Route path="vouchers" element={<Vouchers />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="vehicles" element={<Vehicles />} />
          <Route path="drivers" element={<Drivers />} />
          
          {/* Placeholder routes - to be implemented */}
          <Route path="transport" element={<PlaceholderPage title="Transport" icon="ri-taxi-line" table="transport" />} />
          <Route path="venues" element={<PlaceholderPage title="Venues" icon="ri-building-line" table="venues" />} />
          <Route path="activities" element={<PlaceholderPage title="Activities" icon="ri-rocket-line" table="activities" />} />
          <Route path="events-assistance" element={<PlaceholderPage title="Events Assistance" icon="ri-calendar-event-line" table="events_assistance" />} />
          <Route path="training-attended" element={<PlaceholderPage title="Training Attended" icon="ri-book-read-line" table="training_attended" />} />
          <Route path="training-conducted" element={<PlaceholderPage title="Training Conducted" icon="ri-presentation-line" table="training_conducted" />} />
          <Route path="volunteers" element={<PlaceholderPage title="Volunteers" icon="ri-user-star-line" table="volunteers" />} />
          <Route path="cdrrmc-reso" element={<PlaceholderPage title="CDRRMC Resolutions" icon="ri-file-list-3-line" table="cdrrmc_reso" />} />
          <Route path="cdrrmc-meeting" element={<PlaceholderPage title="CDRRMC Meetings" icon="ri-group-line" table="cdrrmc_meeting" />} />
          <Route path="maps" element={<PlaceholderPage title="Maps Available" icon="ri-map-2-line" table="maps_available" />} />
          <Route path="pruning" element={<PlaceholderPage title="Pruning & Trimming" icon="ri-scissors-line" table="pruning_trimming" />} />
          <Route path="history" element={<PlaceholderPage title="History" icon="ri-history-line" table="history" />} />
          <Route path="documentation" element={<PlaceholderPage title="Documentation" icon="ri-folder-line" table="documentations" />} />
          <Route path="calendar" element={<PlaceholderPage title="Calendar Events" icon="ri-calendar-line" table="calendar_events" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

// Placeholder component for unimplemented pages
function PlaceholderPage({ title, icon, table }) {
  return (
    <div>
      <div className="page-header">
        <h2>
          <i className={icon} style={{ marginRight: '12px' }}></i>
          {title}
        </h2>
      </div>
      <div className="empty-state" style={{ padding: '120px 32px' }}>
        <i className={icon} style={{ fontSize: '96px', color: 'var(--border-light)', marginBottom: '24px' }}></i>
        <h3>{title} Module</h3>
        <p>This module is ready to be implemented following the same pattern as Employees, Vehicles, Incidents, etc.</p>
        <div style={{
          marginTop: '24px',
          padding: '16px',
          background: '#dbeafe',
          border: '1px solid #bfdbfe',
          borderRadius: 'var(--radius-md)',
          fontSize: '14px',
          color: '#1e40af',
          maxWidth: '600px',
          margin: '24px auto 0',
          textAlign: 'left'
        }}>
          <strong>💡 Implementation Tip:</strong> Copy the structure from Employees, Vehicles, or Incidents page, 
          update the Supabase table name to <code style={{
            background: '#1e40af',
            color: '#fff',
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: '700'
          }}>'{table}'</code>, and customize the table columns based on the schema.
          
          <div style={{ marginTop: '12px', fontSize: '13px' }}>
            <strong>Quick Steps:</strong>
            <ol style={{ marginTop: '8px', paddingLeft: '20px' }}>
              <li>Copy <code>src/pages/Incidents/index.jsx</code></li>
              <li>Create <code>src/pages/{title.replace(/\s+/g, '')}/index.jsx</code></li>
              <li>Change table: <code>.from('incidents')</code> → <code>.from('{table}')</code></li>
              <li>Update columns in the &lt;table&gt;</li>
              <li>Import in App.jsx</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
