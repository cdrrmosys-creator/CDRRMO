export default function Dashboard() {
  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
        {/* Stats Cards */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Total Employees
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: 'var(--primary)' }}>
            0
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            <i className="ri-team-line"></i> Active personnel
          </div>
        </div>

        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Total Incidents
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#ea580c' }}>
            0
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            <i className="ri-alarm-warning-line"></i> Reported incidents
          </div>
        </div>

        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Vehicles Available
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#0891b2' }}>
            0
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            <i className="ri-truck-line"></i> Ready to deploy
          </div>
        </div>

        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Volunteers
          </div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#16a34a' }}>
            0
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            <i className="ri-user-star-line"></i> Registered volunteers
          </div>
        </div>
      </div>

      {/* Welcome Message */}
      <div style={{
        marginTop: '32px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)',
        padding: '32px',
        boxShadow: 'var(--shadow-sm)',
        textAlign: 'center'
      }}>
        <i className="ri-shield-flash-line" style={{ fontSize: '64px', color: 'var(--primary)', marginBottom: '16px' }}></i>
        <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '12px' }}>
          Welcome to CDRRMO Recording System
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto' }}>
          Your comprehensive disaster risk reduction and management platform. Use the sidebar to navigate through different modules.
        </p>
      </div>
    </div>
  )
}
