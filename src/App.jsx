import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/useAuthStore'
import { ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/ConfirmDialog'

// Pages
import Login from './pages/Auth/Login'
import ChangePassword from './pages/Auth/ChangePassword'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Incidents from './pages/Incidents'
import Vouchers from './pages/Vouchers'
import Inventory from './pages/Inventory'
import Vehicles from './pages/Vehicles'
import Drivers from './pages/Drivers'
import Transport from './pages/Transport'
import Venues from './pages/Venues'
import Activities from './pages/Activities'
import EventsAssistance from './pages/EventsAssistance'
import TrainingAttended from './pages/TrainingAttended'
import TrainingConducted from './pages/TrainingConducted'
import Volunteers from './pages/Volunteers'
import CdrrmcReso from './pages/CdrrmcReso'
import CdrrmcMeeting from './pages/CdrrmcMeeting'
import Maps from './pages/Maps'
import Pruning from './pages/Pruning'
import History from './pages/History'
import Documentation from './pages/Documentation'
import CalendarEvents from './pages/CalendarEvents'
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

  // Check if logged-in user must change their password
  const needsPasswordChange = user?.user_metadata?.needs_password_change === true

  return (
    <ToastProvider>
      <ConfirmProvider>
        <BrowserRouter>
          <Routes>
            {/* Public: Login */}
            <Route path="/login" element={
              user ? <Navigate to="/" replace /> : <Login />
            } />

            {/* Force password change — accessible when logged in but password not yet changed */}
            <Route path="/change-password" element={
              !user
                ? <Navigate to="/login" replace />
                : <ChangePassword />
            } />

            {/* Protected routes — blocked if password change is still required */}
            <Route path="/" element={
              !user
                ? <Navigate to="/login" replace />
                : needsPasswordChange
                  ? <Navigate to="/change-password" replace />
                  : <Layout />
            }>
              <Route index element={<Dashboard />} />
              <Route path="employees" element={<Employees />} />
              <Route path="incidents" element={<Incidents />} />
              <Route path="vouchers" element={<Vouchers />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="vehicles" element={<Vehicles />} />
              <Route path="drivers" element={<Drivers />} />
              <Route path="transport" element={<Transport />} />
              <Route path="venues" element={<Venues />} />
              <Route path="activities" element={<Activities />} />
              <Route path="events-assistance" element={<EventsAssistance />} />
              <Route path="training-attended" element={<TrainingAttended />} />
              <Route path="training-conducted" element={<TrainingConducted />} />
              <Route path="volunteers" element={<Volunteers />} />
              <Route path="cdrrmc-reso" element={<CdrrmcReso />} />
              <Route path="cdrrmc-meeting" element={<CdrrmcMeeting />} />
              <Route path="maps" element={<Maps />} />
              <Route path="pruning" element={<Pruning />} />
              <Route path="history" element={<History />} />
              <Route path="documentation" element={<Documentation />} />
              <Route path="calendar" element={<CalendarEvents />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ConfirmProvider>
    </ToastProvider>
  )
}

export default App
