export default function Kloudtrack() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <h2>
          <i className="ri-cloud-windy-line" style={{ marginRight: '12px', color: 'var(--primary)' }}></i>
          KloudTrack Live Status
        </h2>
      </div>
      <div style={{ flex: 1, borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-light)', background: 'var(--bg-surface)' }}>
        <iframe 
          src="https://kloudtrack-dashboard.vercel.app/" 
          width="100%" 
          height="100%" 
          style={{ border: 'none', display: 'block', minHeight: 'calc(100vh - 140px)' }}
          title="Kloudtrack Dashboard"
        />
      </div>
    </div>
  )
}
