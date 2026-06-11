import pptxgen from 'pptxgenjs';

const prs = new pptxgen();

// ── Design Tokens ────────────────────────────────────────────────
const BRAND   = { r: 233, g: 78,  b: 27  };   // #E94E1B – CDRRMO red-orange
const DARK    = { r: 30,  g: 41,  b: 59  };   // #1E293B – text dark
const SLATE   = { r: 100, g: 116, b: 139 };   // #64748B – muted text
const WHITE   = { r: 255, g: 255, b: 255 };
const LIGHT   = { r: 248, g: 250, b: 252 };   // #F8FAFC – page bg
const ACCENT1 = { r: 8,   g: 145, b: 178 };   // cyan  – vehicles
const ACCENT2 = { r: 22,  g: 163, b: 74  };   // green – volunteers
const ACCENT3 = { r: 234, g: 88,  b: 12  };   // orange – incidents
const ACCENT4 = { r: 139, g: 92,  b: 246 };   // purple – governance

// ── Colour helpers ───────────────────────────────────────────────
const hex = (c) => `${c.r.toString(16).padStart(2,'0')}${c.g.toString(16).padStart(2,'0')}${c.b.toString(16).padStart(2,'0')}`;

// ── Presentation metadata ────────────────────────────────────────
prs.layout  = 'LAYOUT_WIDE';   // 13.33 × 7.5 inches
prs.author  = 'CDRRMO System';
prs.subject = 'CDRRMO Recording System – User & Admin Guide';
prs.title   = 'CDRRMO Recording System';

// ═════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════════

/** Full slide dark bg with accent stripe on left */
function addDarkBg(slide) {
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: '100%',
    fill: { color: hex(DARK) },
  });
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: 0.06, h: '100%',
    fill: { color: hex(BRAND) },
  });
}

/** Light bg with colored top bar */
function addLightBg(slide, barColor = BRAND) {
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: '100%',
    fill: { color: hex(LIGHT) },
  });
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.08,
    fill: { color: hex(barColor) },
  });
}

/** Section header text block */
function sectionLabel(slide, text, color = BRAND) {
  slide.addText(text.toUpperCase(), {
    x: 0.55, y: 0.12, w: 12, h: 0.32,
    fontSize: 9, bold: true, color: hex(color),
    charSpacing: 2, fontFace: 'Calibri',
  });
}

/** Card / info box */
function addCard(slide, x, y, w, h, fillColor = WHITE, borderColor = null) {
  slide.addShape(prs.ShapeType.rect, {
    x, y, w, h,
    fill: { color: hex(fillColor) },
    line: borderColor ? { color: hex(borderColor), width: 1 } : { color: 'E2E8F0', width: 1 },
    shadow: { type: 'outer', color: '00000015', blur: 6, offset: 3, angle: 90 },
  });
}

// ═════════════════════════════════════════════════════════════════
// SLIDE 1 – COVER
// ═════════════════════════════════════════════════════════════════
{
  const slide = prs.addSlide();

  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: '100%',
    fill: { color: '0F172A' },
  });

  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 6.8, w: '100%', h: 0.7,
    fill: { color: hex(BRAND) },
  });

  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: 0.08, h: '100%',
    fill: { color: hex(BRAND) },
  });

  slide.addShape(prs.ShapeType.ellipse, {
    x: 0.6, y: 1.0, w: 1.0, h: 1.0,
    fill: { color: hex(BRAND) },
    line: { color: 'FFFFFF', width: 2 },
  });
  slide.addText('🛡', {
    x: 0.6, y: 1.0, w: 1.0, h: 1.0,
    fontSize: 24, align: 'center', valign: 'middle',
  });

  slide.addText('CDRRMO', {
    x: 1.8, y: 1.0, w: 5, h: 0.5,
    fontSize: 14, bold: true, color: hex(BRAND),
    fontFace: 'Calibri',
  });
  slide.addText('City Disaster Risk Reduction and Management Office', {
    x: 1.8, y: 1.45, w: 7, h: 0.35,
    fontSize: 9, color: 'A0AEC0',
    fontFace: 'Calibri',
  });

  slide.addText('CDRRMO Recording System', {
    x: 0.6, y: 2.3, w: 12, h: 0.85,
    fontSize: 36, bold: true, color: 'FFFFFF',
    fontFace: 'Calibri',
  });
  slide.addText('User & Administrator Guide', {
    x: 0.6, y: 3.1, w: 12, h: 0.5,
    fontSize: 20, color: hex(BRAND),
    fontFace: 'Calibri', italic: true,
  });

  slide.addText('A comprehensive web-based platform for disaster risk reduction,\npersonnel management, operations monitoring, and governance record-keeping.', {
    x: 0.6, y: 3.8, w: 10, h: 0.7,
    fontSize: 11, color: 'A0AEC0',
    fontFace: 'Calibri',
  });

  slide.addText('Palayan City  •  Internal Use Only', {
    x: 0.6, y: 6.85, w: 12, h: 0.5,
    fontSize: 9, color: 'FFFFFF',
    fontFace: 'Calibri',
  });
}

// ═════════════════════════════════════════════════════════════════
// SLIDE 2 – TABLE OF CONTENTS
// ═════════════════════════════════════════════════════════════════
{
  const slide = prs.addSlide();
  addLightBg(slide);
  sectionLabel(slide, 'Table of Contents');

  slide.addText("What's Inside This Guide", {
    x: 0.55, y: 0.5, w: 12, h: 0.6,
    fontSize: 26, bold: true, color: hex(DARK), fontFace: 'Calibri',
  });

  const sections = [
    { num: '01', title: 'System Overview',          sub: 'Architecture and Google Apps Script integration',             color: BRAND   },
    { num: '02', title: 'Getting Started',           sub: 'Logging in, navigation, and the dashboard',              color: ACCENT1 },
    { num: '03', title: 'User Guide',                sub: 'Viewing, searching, and working with records',            color: ACCENT2 },
    { num: '04', title: 'Module Reference',          sub: 'All modules – what each one does',                    color: ACCENT3 },
    { num: '05', title: 'Admin Guide',               sub: 'Employee management, data entry, and system settings',    color: ACCENT4 },
    { num: '06', title: 'Data & Security',           sub: 'Google Sheets database and security practices',              color: BRAND   },
    { num: '07', title: 'Troubleshooting & Tips',    sub: 'Common issues and how to resolve them',                  color: ACCENT1 },
  ];

  sections.forEach((s, i) => {
    const x = i < 4 ? 0.55 : 6.9;
    const y = 1.4 + (i < 4 ? i : i - 4) * 0.9;

    addCard(slide, x, y, 5.9, 0.75, WHITE);

    slide.addShape(prs.ShapeType.rect, {
      x, y, w: 0.08, h: 0.75,
      fill: { color: hex(s.color) },
    });

    slide.addText(s.num, {
      x: x + 0.18, y: y + 0.08, w: 0.55, h: 0.3,
      fontSize: 18, bold: true, color: hex(s.color), fontFace: 'Calibri',
    });
    slide.addText(s.title, {
      x: x + 0.75, y: y + 0.08, w: 5, h: 0.28,
      fontSize: 11, bold: true, color: hex(DARK), fontFace: 'Calibri',
    });
    slide.addText(s.sub, {
      x: x + 0.75, y: y + 0.38, w: 5, h: 0.22,
      fontSize: 8.5, color: hex(SLATE), fontFace: 'Calibri',
    });
  });
}

// ═════════════════════════════════════════════════════════════════
// SLIDE 3 – SYSTEM OVERVIEW
// ═════════════════════════════════════════════════════════════════
{
  const slide = prs.addSlide();
  addLightBg(slide);
  sectionLabel(slide, '01 · System Overview');

  slide.addText('What is the CDRRMO Recording System?', {
    x: 0.55, y: 0.5, w: 12, h: 0.6,
    fontSize: 24, bold: true, color: hex(DARK), fontFace: 'Calibri',
  });

  slide.addText(
    'A powerful records management platform built on Google Apps Script and Google Sheets. ' +
    'The system follows a thin-client architecture, providing a fast single-page application experience directly within your web browser while securely storing data in a centralized Google Spreadsheet.',
    {
      x: 0.55, y: 1.15, w: 12, h: 0.7,
      fontSize: 10.5, color: hex(SLATE), fontFace: 'Calibri',
    }
  );

  const stack = [
    { title: 'Frontend UI',  body: 'Single Page Web App\nBuilt with HTML, CSS, & JavaScript\nInteractive and responsive design',   color: ACCENT1 },
    { title: 'Backend Logic',   body: 'Google Apps Script (Code.gs)\nProcesses requests securely\nHandles business rules & routing',                    color: ACCENT2 },
    { title: 'Database',      body: 'Google Spreadsheet\nCentralized data storage\nEach module has its own sheet tab',                  color: BRAND   },
    { title: 'Integration',   body: 'google.script.run API\nAsynchronous background updates\nFast real-time data fetching',                       color: ACCENT3 },
  ];

  stack.forEach((s, i) => {
    const x = 0.55 + i * 3.15;
    addCard(slide, x, 2.05, 2.95, 2.0, WHITE);
    slide.addShape(prs.ShapeType.rect, {
      x, y: 2.05, w: 2.95, h: 0.32,
      fill: { color: hex(s.color) },
    });
    slide.addText(s.title, {
      x, y: 2.05, w: 2.95, h: 0.32,
      fontSize: 11, bold: true, color: 'FFFFFF', align: 'center', fontFace: 'Calibri',
    });
    slide.addText(s.body, {
      x: x + 0.15, y: 2.45, w: 2.65, h: 1.5,
      fontSize: 9.5, color: hex(DARK), fontFace: 'Calibri',
    });
  });

  const stats = [
    { label: 'Cloud', sub: 'Fully Hosted on Google' },
    { label: 'Secure', sub: 'Authentication Required' },
    { label: 'Exportable', sub: 'Easy CSV Downloads' },
    { label: 'Instant', sub: 'Real-time Search' },
  ];

  stats.forEach((s, i) => {
    const x = 0.55 + i * 3.15;
    addCard(slide, x, 4.25, 2.95, 0.95, WHITE);
    slide.addText(s.label, {
      x, y: 4.28, w: 2.95, h: 0.45,
      fontSize: 22, bold: true, color: hex(BRAND), align: 'center', fontFace: 'Calibri',
    });
    slide.addText(s.sub, {
      x, y: 4.72, w: 2.95, h: 0.28,
      fontSize: 9, color: hex(SLATE), align: 'center', fontFace: 'Calibri',
    });
  });

  slide.addText('Accessible from any device with a modern web browser and an internet connection.', {
    x: 0.55, y: 5.55, w: 12, h: 0.3,
    fontSize: 8.5, color: hex(SLATE), italic: true, fontFace: 'Calibri',
  });
}

// ═════════════════════════════════════════════════════════════════
// SLIDE 4 – GETTING STARTED: LOGIN
// ═════════════════════════════════════════════════════════════════
{
  const slide = prs.addSlide();
  addLightBg(slide, ACCENT1);
  sectionLabel(slide, '02 · Getting Started', ACCENT1);

  slide.addText('Logging In to the System', {
    x: 0.55, y: 0.5, w: 12, h: 0.55,
    fontSize: 24, bold: true, color: hex(DARK), fontFace: 'Calibri',
  });

  const steps = [
    { step: '1', title: 'Open the Web App URL', body: 'Navigate to the provided Google Apps Script URL in your web browser (Chrome or Edge recommended).' },
    { step: '2', title: 'Enter Your Credentials', body: 'Type your registered username and password in the login form fields.' },
    { step: '3', title: 'Click Login', body: 'Press the Login button. The system securely verifies your account against the database.' },
    { step: '4', title: 'Access the System', body: 'Upon successful login, you are redirected to the Home screen and the main menu becomes available.' },
  ];

  steps.forEach((s, i) => {
    const x = i < 2 ? 0.55 : 6.9;
    const y = 1.3 + (i < 2 ? i : i - 2) * 1.55;

    addCard(slide, x, y, 5.9, 1.4, WHITE);

    slide.addShape(prs.ShapeType.ellipse, {
      x: x + 0.2, y: y + 0.45, w: 0.55, h: 0.55,
      fill: { color: hex(ACCENT1) },
      line: { color: hex(ACCENT1), width: 0 },
    });
    slide.addText(s.step, {
      x: x + 0.2, y: y + 0.45, w: 0.55, h: 0.55,
      fontSize: 14, bold: true, color: 'FFFFFF', align: 'center', fontFace: 'Calibri',
    });

    slide.addText(s.title, {
      x: x + 0.9, y: y + 0.18, w: 4.8, h: 0.3,
      fontSize: 11.5, bold: true, color: hex(DARK), fontFace: 'Calibri',
    });
    slide.addText(s.body, {
      x: x + 0.9, y: y + 0.52, w: 4.8, h: 0.6,
      fontSize: 9.5, color: hex(SLATE), fontFace: 'Calibri',
    });
  });

  addCard(slide, 0.55, 4.65, 12.2, 0.5, { r: 239, g: 246, b: 255 }, ACCENT1);
  slide.addText('🔒  Security:  Your credentials are checked directly against the server. State is managed locally during your session.', {
    x: 0.75, y: 4.7, w: 12, h: 0.4,
    fontSize: 9.5, color: hex(ACCENT1), fontFace: 'Calibri',
  });

  slide.addText('To log out: Open the top-right Settings Dropdown and select Logout. Your session state will be immediately cleared.', {
    x: 0.55, y: 5.35, w: 12, h: 0.3,
    fontSize: 9, color: hex(SLATE), italic: true, fontFace: 'Calibri',
  });
}

// ═════════════════════════════════════════════════════════════════
// SLIDE 5 – NAVIGATION & DASHBOARD
// ═════════════════════════════════════════════════════════════════
{
  const slide = prs.addSlide();
  addLightBg(slide);
  sectionLabel(slide, '02 · Getting Started');

  slide.addText('Dashboard & Navigation', {
    x: 0.55, y: 0.5, w: 12, h: 0.55,
    fontSize: 24, bold: true, color: hex(DARK), fontFace: 'Calibri',
  });

  // --- Sidebar panel ---
  addCard(slide, 0.55, 1.2, 3.8, 4.9, { r: 30, g: 41, b: 59 }, { r: 30, g: 41, b: 59 });

  slide.addText('⚡  CDRRMO', {
    x: 0.75, y: 1.35, w: 3.4, h: 0.4,
    fontSize: 14, bold: true, color: hex(BRAND), fontFace: 'Calibri',
  });
  slide.addText('NAVIGATION SIDEBAR', {
    x: 0.75, y: 1.75, w: 3.4, h: 0.25,
    fontSize: 7.5, bold: true, color: 'A0AEC0', charSpacing: 1.5, fontFace: 'Calibri',
  });

  const navGroups = [
    { section: 'MAIN', items: ['Home Dashboard'] },
    { section: 'PERSONNEL', items: ['Employees'] },
    { section: 'OPERATIONS', items: ['Incidents', 'Vouchers', 'Inventory', 'Transport'] },
    { section: 'FLEET & FACILITIES', items: ['Vehicles', 'Drivers', 'Venues'] },
    { section: 'PROGRAMS & GOVERNANCE', items: ['Activities', 'CDRRMC Resolutions', '…and more'] },
  ];

  let ny = 2.1;
  navGroups.forEach(g => {
    slide.addText(g.section, {
      x: 0.75, y: ny, w: 3.4, h: 0.2,
      fontSize: 6.5, bold: true, color: '64748B', charSpacing: 1.5, fontFace: 'Calibri',
    });
    ny += 0.22;
    g.items.forEach(item => {
      slide.addText(`  › ${item}`, {
        x: 0.75, y: ny, w: 3.4, h: 0.22,
        fontSize: 9, color: 'CBD5E1', fontFace: 'Calibri',
      });
      ny += 0.23;
    });
    ny += 0.05;
  });

  addCard(slide, 4.6, 1.2, 8.1, 4.9, WHITE);
  slide.addShape(prs.ShapeType.rect, {
    x: 4.6, y: 1.2, w: 8.1, h: 0.06,
    fill: { color: hex(BRAND) },
  });
  
  slide.addText('Welcome to the CDRRMO Web Application', {
    x: 4.8, y: 1.5, w: 7.8, h: 0.4,
    fontSize: 16, bold: true, color: hex(DARK), fontFace: 'Calibri',
  });
  
  slide.addText('The application uses a Single Page App (SPA) design. This means clicking the sidebar instantly changes the screen without reloading the entire page. Data is fetched automatically from Google Sheets behind the scenes.', {
    x: 4.8, y: 2.0, w: 7.5, h: 0.8,
    fontSize: 11, color: hex(SLATE), fontFace: 'Calibri',
  });

  slide.addText('The Topbar features include:', {
    x: 4.8, y: 3.0, w: 7.5, h: 0.3,
    fontSize: 11, bold: true, color: hex(DARK), fontFace: 'Calibri',
  });

  const topbarFeatures = [
    '🔍 Global Search: Filter rows on any active module page instantly.',
    '🔔 Notification Bell: Shows the 5 most recently saved records system-wide.',
    '⚙️ Settings Menu: Access "Change Password" and "About System".'
  ];

  topbarFeatures.forEach((feat, index) => {
    slide.addText(feat, {
      x: 5.0, y: 3.4 + (index * 0.4), w: 7.0, h: 0.3,
      fontSize: 10.5, color: hex(SLATE), fontFace: 'Calibri',
    });
  });
}

// ═════════════════════════════════════════════════════════════════
// SLIDE 6 – USER GUIDE: CORE ACTIONS
// ═════════════════════════════════════════════════════════════════
{
  const slide = prs.addSlide();
  addLightBg(slide, ACCENT2);
  sectionLabel(slide, '03 · User Guide', ACCENT2);

  slide.addText('What Can a Regular User Do?', {
    x: 0.55, y: 0.5, w: 12, h: 0.55,
    fontSize: 24, bold: true, color: hex(DARK), fontFace: 'Calibri',
  });

  slide.addText('Every authenticated user can perform the following actions across all modules:', {
    x: 0.55, y: 1.1, w: 12, h: 0.3,
    fontSize: 10.5, color: hex(SLATE), fontFace: 'Calibri',
  });

  const actions = [
    {
      icon: '👁', title: 'View Records',
      body: 'Browse any module\'s full list of records in a structured data table. The system loads records directly from Google Sheets.',
      color: ACCENT1,
    },
    {
      icon: '🔍', title: 'Search & Filter',
      body: 'Use the topbar search to instantly filter visible rows across the active module. Emptying the search box restores the table.',
      color: ACCENT2,
    },
    {
      icon: '📋', title: 'View Record Details',
      body: 'Click any table row to open a modal dialog with full, read-only details of the record.',
      color: BRAND,
    },
    {
      icon: '📤', title: 'Export Data',
      body: 'In supported modules (e.g., Inventory), use the Export Sheet button to download the entire module dataset as a CSV file.',
      color: ACCENT3,
    },
    {
      icon: '🔔', title: 'Notifications',
      body: 'Click the bell icon in the topbar to see the 5 most recently saved records across all modules.',
      color: ACCENT4,
    },
    {
      icon: '🗓', title: 'Calendar View',
      body: 'Transport and Training Venues include interactive calendars. Clicking a day cell pre-fills dates for new records.',
      color: ACCENT1,
    },
  ];

  actions.forEach((a, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.55 + col * 4.2;
    const y = 1.55 + row * 2.1;

    addCard(slide, x, y, 3.95, 1.9, WHITE);
    slide.addShape(prs.ShapeType.rect, {
      x, y, w: 3.95, h: 0.06,
      fill: { color: hex(a.color) },
    });

    slide.addText(a.icon, {
      x: x + 0.18, y: y + 0.18, w: 0.5, h: 0.5,
      fontSize: 20, fontFace: 'Segoe UI Emoji',
    });
    slide.addText(a.title, {
      x: x + 0.72, y: y + 0.2, w: 3.1, h: 0.32,
      fontSize: 11.5, bold: true, color: hex(DARK), fontFace: 'Calibri',
    });
    slide.addText(a.body, {
      x: x + 0.18, y: y + 0.68, w: 3.65, h: 1.1,
      fontSize: 9.5, color: hex(SLATE), fontFace: 'Calibri',
    });
  });
}

// ═════════════════════════════════════════════════════════════════
// SLIDE 7 – MODULE REFERENCE (overview grid)
// ═════════════════════════════════════════════════════════════════
{
  const slide = prs.addSlide();
  addLightBg(slide);
  sectionLabel(slide, '04 · Module Reference');

  slide.addText('Core Modules at a Glance', {
    x: 0.55, y: 0.5, w: 12, h: 0.55,
    fontSize: 24, bold: true, color: hex(DARK), fontFace: 'Calibri',
  });

  const modules = [
    { name: 'Employees',            cat: 'Personnel',  color: BRAND   },
    { name: 'Incidents',            cat: 'Operations', color: ACCENT3 },
    { name: 'Vouchers',             cat: 'Operations', color: ACCENT3 },
    { name: 'Inventory',            cat: 'Operations', color: ACCENT3 },
    { name: 'Transport',            cat: 'Operations', color: ACCENT3 },
    { name: 'Venues',               cat: 'Facilities', color: ACCENT4 },
    { name: 'Vehicles',             cat: 'Fleet',      color: ACCENT1 },
    { name: 'Drivers',              cat: 'Fleet',      color: ACCENT1 },
    { name: 'Activities',           cat: 'Programs',   color: ACCENT2 },
    { name: 'Events Assistance',    cat: 'Programs',   color: ACCENT2 },
    { name: 'Training Attended',    cat: 'Programs',   color: ACCENT2 },
    { name: 'Training Conducted',   cat: 'Programs',   color: ACCENT2 },
    { name: 'Volunteers',           cat: 'Programs',   color: ACCENT2 },
    { name: 'CDRRMC Resolutions',   cat: 'Governance', color: ACCENT4 },
    { name: 'CDRRMC Meetings',      cat: 'Governance', color: ACCENT4 },
    { name: 'Maps Available',       cat: 'Resources',  color: ACCENT1 },
    { name: 'Pruning & Trimming',   cat: 'Resources',  color: ACCENT1 },
    { name: 'History',              cat: 'Records',    color: SLATE   },
    { name: 'Documentation',        cat: 'Records',    color: SLATE   },
    { name: 'Calendar Events',      cat: 'Records',    color: SLATE   },
  ];

  const cols = 5;
  const cellW = 2.48;
  const cellH = 0.88;
  const startX = 0.55;
  const startY = 1.2;

  modules.forEach((m, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (cellW + 0.05);
    const y = startY + row * (cellH + 0.08);

    addCard(slide, x, y, cellW, cellH, WHITE);
    slide.addShape(prs.ShapeType.rect, {
      x, y, w: cellW, h: 0.05,
      fill: { color: hex(m.color) },
    });

    slide.addText(m.name, {
      x: x + 0.12, y: y + 0.15, w: cellW - 0.2, h: 0.35,
      fontSize: 9.5, bold: true, color: hex(DARK), fontFace: 'Calibri',
    });
    slide.addText(m.cat, {
      x: x + 0.12, y: y + 0.52, w: cellW - 0.2, h: 0.22,
      fontSize: 7.5, color: hex(SLATE), fontFace: 'Calibri',
    });
  });
}

// ═════════════════════════════════════════════════════════════════
// SLIDE 8 – ADMIN GUIDE: OVERVIEW
// ═════════════════════════════════════════════════════════════════
{
  const slide = prs.addSlide();

  // Dark admin theme
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: '100%',
    fill: { color: '0F172A' },
  });
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: 0.08, h: '100%',
    fill: { color: hex(ACCENT4) },
  });
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 6.8, w: '100%', h: 0.7,
    fill: { color: hex(ACCENT4) + 'AA' },
  });

  slide.addText('ADMIN GUIDE', {
    x: 0.55, y: 0.18, w: 12, h: 0.28,
    fontSize: 9, bold: true, color: hex(ACCENT4), charSpacing: 2, fontFace: 'Calibri',
  });

  slide.addText('05', {
    x: 0.55, y: 0.6, w: 2, h: 1.4,
    fontSize: 100, bold: true, color: '2E1065', fontFace: 'Calibri',
  });

  slide.addText('Administrator\nCapabilities', {
    x: 0.55, y: 0.6, w: 12, h: 1.4,
    fontSize: 36, bold: true, color: 'FFFFFF', fontFace: 'Calibri',
  });

  slide.addText('Full access to all records — create, edit, delete, and manage the entire system securely backed by Google Sheets.', {
    x: 0.55, y: 2.1, w: 10, h: 0.4,
    fontSize: 12, color: 'A0AEC0', fontFace: 'Calibri',
  });

  const caps = [
    { icon: '➕', title: 'Create Records',    body: 'Add new entries to any module. The Generic Modal automatically handles all module-specific fields.' },
    { icon: '✏️', title: 'Edit Records',      body: 'Modify existing records by entering Edit mode on a record\'s detail modal view.' },
    { icon: '🗑', title: 'Delete Records',    body: 'Remove any record. Confirmed deletions update Google Sheets and instantly remove the table row.' },
    { icon: '👤', title: 'Manage Employees',  body: 'Add and edit full employee profiles with 35+ fields, dynamic children lists, and seminar tables.' },
    { icon: '🔑', title: 'Change Password',   body: 'Securely update user passwords inside the Settings dropdown. Validated server-side.' },
    { icon: '📊', title: 'Manage Sheets',    body: 'The backend automatically maps all data structures into clean columns in the Google Spreadsheet.' },
  ];

  caps.forEach((c, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.55 + col * 4.25;
    const y = 2.8 + row * 1.7;

    slide.addShape(prs.ShapeType.rect, {
      x, y, w: 4.05, h: 1.5,
      fill: { color: '1E293B' },
    });
    slide.addShape(prs.ShapeType.rect, {
      x, y, w: 4.05, h: 0.05,
      fill: { color: hex(ACCENT4) },
    });

    slide.addText(c.icon, {
      x: x + 0.15, y: y + 0.2, w: 0.5, h: 0.5,
      fontSize: 18, fontFace: 'Segoe UI Emoji',
    });
    slide.addText(c.title, {
      x: x + 0.7, y: y + 0.22, w: 3.2, h: 0.3,
      fontSize: 11, bold: true, color: 'FFFFFF', fontFace: 'Calibri',
    });
    slide.addText(c.body, {
      x: x + 0.15, y: y + 0.65, w: 3.75, h: 0.65,
      fontSize: 9.5, color: 'A0AEC0', fontFace: 'Calibri',
    });
  });
}

// ═════════════════════════════════════════════════════════════════
// SLIDE 9 – ADMIN: ADDING RECORDS
// ═════════════════════════════════════════════════════════════════
{
  const slide = prs.addSlide();
  addLightBg(slide, ACCENT4);
  sectionLabel(slide, '05 · Admin Guide', ACCENT4);

  slide.addText('Adding & Validating Records', {
    x: 0.55, y: 0.5, w: 12, h: 0.55,
    fontSize: 24, bold: true, color: hex(DARK), fontFace: 'Calibri',
  });

  // Generic module flow
  const genSteps = [
    { title: 'Click "Add" Button',    body: 'Locate the Add Record button on the active module page and click it to open the Generic Modal.' },
    { title: 'Fill the Form',         body: 'Fill in all fields. The form automatically adapts to the required inputs (Text, Select, DateTime, etc.) based on the module.' },
    { title: 'System Validation',     body: 'The client-side scripts validate your inputs. Required fields must not be empty. Numbers must be valid.' },
    { title: 'Server Processing',     body: 'Upon saving, data is sent to Code.gs via google.script.run for saving to the correct Google Sheet tab.' },
    { title: 'Dynamic Prepending',    body: 'Once success is confirmed by the server, the new record is instantly prepended to the top of your current table.' },
    { title: 'Notification Hub',      body: 'A notification is added to the bell dropdown informing you the record was saved successfully.' },
  ];

  genSteps.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.55 + col * 6.45;
    const y = 1.25 + row * 1.5;

    addCard(slide, x, y, 6.1, 1.3, WHITE);
    slide.addShape(prs.ShapeType.rect, {
      x, y, w: 0.06, h: 1.3,
      fill: { color: hex(ACCENT4) },
    });

    slide.addShape(prs.ShapeType.ellipse, {
      x: x + 0.2, y: y + 0.38, w: 0.52, h: 0.52,
      fill: { color: hex(ACCENT4) },
      line: { color: hex(ACCENT4), width: 0 },
    });
    slide.addText(`${i + 1}`, {
      x: x + 0.2, y: y + 0.38, w: 0.52, h: 0.52,
      fontSize: 13, bold: true, color: 'FFFFFF', align: 'center', fontFace: 'Calibri',
    });

    slide.addText(s.title, {
      x: x + 0.88, y: y + 0.15, w: 5.1, h: 0.3,
      fontSize: 11, bold: true, color: hex(DARK), fontFace: 'Calibri',
    });
    slide.addText(s.body, {
      x: x + 0.88, y: y + 0.5, w: 5.1, h: 0.68,
      fontSize: 9.5, color: hex(SLATE), fontFace: 'Calibri',
    });
  });

  addCard(slide, 0.55, 5.85, 12.2, 0.4, { r: 245, g: 243, b: 255 }, ACCENT4);
  slide.addText('⚠  The UI protects against race conditions — double submissions are prevented while a server save is in progress.', {
    x: 0.75, y: 5.88, w: 12, h: 0.34,
    fontSize: 9, color: hex(ACCENT4), fontFace: 'Calibri',
  });
}

// ═════════════════════════════════════════════════════════════════
// SLIDE 10 – DATA & SECURITY (GOOGLE SHEETS)
// ═════════════════════════════════════════════════════════════════
{
  const slide = prs.addSlide();
  addLightBg(slide, ACCENT2);
  sectionLabel(slide, '06 · Data & Security', ACCENT2);

  slide.addText('Data Storage via Google Sheets', {
    x: 0.55, y: 0.5, w: 12, h: 0.55,
    fontSize: 24, bold: true, color: hex(DARK), fontFace: 'Calibri',
  });

  const secCards = [
    {
      icon: '🗄',
      title: 'Spreadsheet Database',
      color: ACCENT2,
      body: 'All data is securely persisted in a central Google Spreadsheet. Every module corresponds to a specific Sheet Tab.',
    },
    {
      icon: '🔒',
      title: 'Thin-Client Architecture',
      color: ACCENT1,
      body: 'The frontend (Index.html) has no direct access to the Spreadsheet ID. All reads and writes happen through Code.gs API functions.',
    },
    {
      icon: '🆔',
      title: 'Auto-Generated UUIDs',
      color: ACCENT3,
      body: 'Every record receives a unique timestamp-prefixed ID (e.g., REC-171800000) ensuring distinct rows and reliable data retrieval.',
    },
    {
      icon: '⚙️',
      title: 'Dynamic Schema',
      color: BRAND,
      body: 'When saving a module record for the first time, the Code.gs script automatically generates the sheet and writes header rows mapped to data keys.',
    },
  ];

  secCards.forEach((c, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.55 + col * 6.45;
    const y = 1.35 + row * 2.2;

    addCard(slide, x, y, 6.1, 2.0, WHITE);
    slide.addShape(prs.ShapeType.rect, {
      x, y, w: 6.1, h: 0.06,
      fill: { color: hex(c.color) },
    });
    slide.addText(c.icon, {
      x: x + 0.18, y: y + 0.18, w: 0.5, h: 0.5,
      fontSize: 22, fontFace: 'Segoe UI Emoji',
    });
    slide.addText(c.title, {
      x: x + 0.72, y: y + 0.18, w: 5.2, h: 0.32,
      fontSize: 12, bold: true, color: hex(DARK), fontFace: 'Calibri',
    });
    slide.addText(c.body, {
      x: x + 0.18, y: y + 0.68, w: 5.7, h: 1.15,
      fontSize: 10, color: hex(SLATE), fontFace: 'Calibri',
    });
  });
}

// ═════════════════════════════════════════════════════════════════
// SLIDE 11 – CLOSING / THANK YOU
// ═════════════════════════════════════════════════════════════════
{
  const slide = prs.addSlide();

  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: '100%',
    fill: { color: '0F172A' },
  });

  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 0, w: 0.08, h: '100%',
    fill: { color: hex(BRAND) },
  });
  slide.addShape(prs.ShapeType.rect, {
    x: 0, y: 6.8, w: '100%', h: 0.7,
    fill: { color: hex(BRAND) },
  });

  slide.addText('🛡', {
    x: 5.5, y: 0.8, w: 1.5, h: 1.5,
    fontSize: 60, align: 'center', fontFace: 'Segoe UI Emoji',
  });

  slide.addText('Thank You!', {
    x: 0.55, y: 2.4, w: 12.2, h: 0.9,
    fontSize: 42, bold: true, color: 'FFFFFF', align: 'center', fontFace: 'Calibri',
  });

  slide.addText('CDRRMO Recording System (Google Apps Script Version)', {
    x: 0.55, y: 3.35, w: 12.2, h: 0.5,
    fontSize: 18, color: hex(BRAND), align: 'center', fontFace: 'Calibri',
  });

  slide.addText('Protecting communities through better data management.', {
    x: 0.55, y: 3.92, w: 12.2, h: 0.4,
    fontSize: 12, color: 'A0AEC0', align: 'center', fontFace: 'Calibri', italic: true,
  });

  slide.addText('Palayan City  •  CDRRMO  •  2026  •  Internal Use Only', {
    x: 0.55, y: 6.85, w: 12.2, h: 0.5,
    fontSize: 9, color: 'FFFFFF', align: 'center', fontFace: 'Calibri',
  });
}

// ═════════════════════════════════════════════════════════════════
// SAVE
// ═════════════════════════════════════════════════════════════════
const outputPath = 'CDRRMO_System_Guide.pptx';
prs.writeFile({ fileName: outputPath })
  .then(() => console.log(`✅  Presentation saved: ${outputPath}`))
  .catch(err => { console.error('❌  Error:', err); process.exit(1); });
