export default function SidebarLogin() {
  return (
    <div className="sidebar" style={{ width: '380px', padding: '20px', overflowY: 'auto', background: 'var(--primary-dark)', color: '#fff', borderRight: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {/* Branding */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '30px', padding: '15px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
            <img
              src="https://lh3.googleusercontent.com/d/1-26zjRFIZWYnFHm-nUcrdue8wIx_rErz"
              alt="Palayan City Logo"
              style={{ height: '50px' }}
              onError={(e) => { e.target.style.display = 'none' }}
            />
            <img
              src="https://lh3.googleusercontent.com/d/1H0xg8TFCBl6A2jPycEZNI6dxyX-HmWZ8"
              alt="CDRRMO Logo"
              style={{ height: '64px' }}
              onError={(e) => { e.target.style.display = 'none' }}
            />
            <img
              src="https://lh3.googleusercontent.com/d/1uY1Kn77Az5a25LLo23oo3uDk8ZOv8_so"
              alt="Rescue Logo"
              style={{ height: '50px' }}
              onError={(e) => { e.target.style.display = 'none' }}
            />
          </div>
          <div style={{ fontSize: '18px', fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            City of Palayan
            <br />
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', letterSpacing: '2px', textTransform: 'uppercase' }}>Capital of Nueva Ecija</span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff', marginTop: '12px' }}>
            City Disaster Risk Reduction and Management Office
          </div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: '#fca5a5', marginTop: '4px' }}>
            Palayan City Rescue
          </div>
        </div>

        <div style={{ margin: '10px 0', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '15px', fontWeight: '800', color: '#fca5a5', textTransform: 'uppercase' }}>One Heart, One Mind, One Mission</div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginTop: '6px' }}>“We Save Lives”</div>
        </div>

        {/* MVV Block */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', background: 'rgba(0,0,0,0.15)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#fca5a5', textTransform: 'uppercase', marginBottom: '4px' }}>Mission</div>
            <div style={{ fontSize: '15px', color: '#fff', lineHeight: '1.4' }}>Deliver prompt and effective disaster response for Palayan City</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#fca5a5', textTransform: 'uppercase', marginBottom: '4px' }}>Vision</div>
            <div style={{ fontSize: '15px', color: '#fff', lineHeight: '1.4' }}>A resilient community prepared for all hazards and disasters</div>
          </div>
          <div style={{ textAlign: 'center', marginTop: '4px' }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#fca5a5', textTransform: 'uppercase', marginBottom: '6px' }}>Core Values</div>
            <div style={{ fontSize: '15px', color: '#fff', lineHeight: '1.6', fontWeight: '600' }}>
              <div>Service</div>
              <div>Integrity</div>
              <div>Excellence</div>
              <div>Dedication</div>
            </div>
          </div>
        </div>

        {/* Hotlines Block */}
        <div style={{ marginTop: '4px', padding: '16px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#fca5a5', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="ri-phone-fill"></i> EMERGENCY HOTLINES
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>CDRRMO Rescue</span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#fff', textAlign: 'right' }}>0920-574-1581<br/>0966-910-9674</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>Health Office</span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#fff', textAlign: 'right' }}>0920-947-2735<br/>0917-107-3808</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>PNP Station</span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#fff', textAlign: 'right' }}>0998-598-5430<br/>0955-683-2498</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>BFP Station</span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#fff' }}>0943-066-9962</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
