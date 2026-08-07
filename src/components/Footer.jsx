export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="app-footer">
      {/* Top gradient divider */}
      <div className="footer-gradient-bar" />

      <div className="footer-inner">

        {/* ── Column 1: Office Identity & NPC Certification (2x2 Grid Aligned) ── */}
        <div className="footer-col footer-col-brand">
          <div className="footer-brand-container">
            {/* Row 1: Office Identity */}
            <div className="footer-brand-row">
              <div className="footer-brand-logos-col">
                <img
                  src="https://bakohorlnjuvqgwslzfm.supabase.co/storage/v1/object/public/Logos/Palayan%20city%20logo.png"
                  alt="Palayan City Logo"
                  className="footer-logo-img footer-logo-main"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
                <img
                  src="https://bakohorlnjuvqgwslzfm.supabase.co/storage/v1/object/public/Logos/CDRRMO%20logo.png"
                  alt="CDRRMO Logo"
                  className="footer-logo-img footer-logo-main"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
                <img
                  src="https://bakohorlnjuvqgwslzfm.supabase.co/storage/v1/object/public/Logos/Rescue%20Logo.png"
                  alt="Rescue Logo"
                  className="footer-logo-img"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
              </div>
              
              <div className="footer-brand-text-col">
                <span className="footer-city">City of Palayan</span>
                <span className="footer-city-sub">Capital of Nueva Ecija</span>
                <span className="footer-office">City Disaster Risk Reduction and Management Office</span>
                <span className="footer-rescue">Palayan City Rescue</span>
              </div>
            </div>

            {/* Row 2: NPC Certification */}
            <div className="footer-brand-row footer-npc-row">
              <div className="footer-brand-logos-col footer-npc-logo-col">
                <img
                  src="https://bakohorlnjuvqgwslzfm.supabase.co/storage/v1/object/public/Logos/NPC%20Logo.png"
                  alt="National Privacy Commission Seal"
                  className="footer-npc-seal"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
              </div>

              <div className="footer-brand-text-col footer-npc-text-col">
                <div className="footer-npc-badge-tag">
                  <i className="ri-shield-check-fill" /> DPO / DPS REGISTERED
                </div>
                <div className="footer-npc-cert-title">
                  National Privacy Commission
                </div>
                <div className="footer-npc-cert-sub">
                  Data Privacy Act of 2012 Compliant System
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Column 2: Contact Info ── */}
        <div className="footer-col">
          <div className="footer-section-title">
            <i className="ri-contacts-line" /> Contact Us
          </div>

          <div className="footer-contact-list">
            {/* Address */}
            <div className="footer-contact-item">
              <i className="ri-map-pin-2-line footer-contact-icon" />
              <div>
                <div className="footer-contact-label">Address</div>
                <div className="footer-contact-value">
                  City Disaster Risk Reduction and Management Office<br />
                  Palayan City, Capital of Nueva Ecija<br />
                  Palayan City Rescue
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="footer-contact-item">
              <i className="ri-mail-line footer-contact-icon" />
              <div>
                <div className="footer-contact-label">Email</div>
                <a
                  href="mailto:r3.ne.cdrrm.palayan.official@gmail.com"
                  className="footer-contact-link"
                >
                  r3.ne.cdrrm.palayan.official@gmail.com
                </a>
              </div>
            </div>

            {/* Website */}
            <div className="footer-contact-item">
              <i className="ri-global-line footer-contact-icon" />
              <div>
                <div className="footer-contact-label">Website</div>
                <a
                  href="https://cityofpalayan.gov.ph/cdrrmo/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-contact-link"
                >
                  cityofpalayan.gov.ph/cdrrmo
                </a>
              </div>
            </div>

            {/* Facebook */}
            <div className="footer-contact-item">
              <i className="ri-facebook-circle-line footer-contact-icon" />
              <div>
                <div className="footer-contact-label">Facebook</div>
                <a
                  href="https://www.facebook.com/profile.php?id=100069234188943"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-contact-link"
                >
                  CDRRMO Palayan City
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* ── Column 3: Hotlines ── */}
        <div className="footer-col">
          <div className="footer-section-title">
            <i className="ri-phone-fill" /> Emergency Hotlines
          </div>

          <div className="footer-hotlines">
            <div className="footer-hotline-badge">
              <i className="ri-alarm-warning-line" />
              <span>24 / 7 Emergency Response</span>
            </div>

            <div className="footer-hotline-group">
              <div className="footer-hotline-label">
                <span className="network-dot globe" /> Globe
              </div>
              <a href="tel:09669109674" className="footer-hotline-number">0966 910 9674</a>
            </div>

            <div className="footer-hotline-group">
              <div className="footer-hotline-label">
                <span className="network-dot smart" /> Smart
              </div>
              <a href="tel:09205741581" className="footer-hotline-number">0920 574 1581</a>
            </div>
          </div>
        </div>

      </div>

      {/* ── Bottom Bar ── */}
      <div className="footer-bottom">
        <div className="footer-bottom-inner">

          {/* Copyright */}
          <div className="footer-copyright">
            © {currentYear} CDRRMO Palayan City. All rights reserved.
          </div>

          {/* Powered by ICT Division */}
          <div className="footer-badges">
            <div className="footer-badge footer-badge-ict" title="Powered by ICT Division">
              <img
                src="https://bakohorlnjuvqgwslzfm.supabase.co/storage/v1/object/public/Logos/ICT%20Logo.png"
                alt="ICT Division Logo"
                className="footer-badge-img"
                onError={(e) => { e.target.style.display = 'none' }}
              />
              <div className="footer-badge-text">
                <span className="footer-badge-sub">Powered by</span>
                <span className="footer-badge-main">ICT Division</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </footer>
  )
}
