import jsPDF from 'jspdf'

const na = (v) =>
  v === null || v === undefined || String(v).trim() === '' ? 'N/A' : String(v).trim()

const calcAge = (dob) => {
  if (!dob) return 'N/A'
  const b = new Date(dob); if (isNaN(b)) return 'N/A'
  const t = new Date()
  let a = t.getFullYear() - b.getFullYear()
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--
  return String(a)
}

// Load an image that's already trusted by the browser (blob: URL or cached public URL)
// Uses a hidden Image element + canvas — no CORS issue for blob: URLs
// Falls back to fetch for regular URLs
async function imgToBase64(src) {
  if (!src) return null

  // For blob: URLs — read directly via FileReader (no CORS, no fetch needed)
  if (src.startsWith('blob:')) {
    try {
      const res = await fetch(src)
      const blob = await res.blob()
      return await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('FileReader failed'))
        reader.readAsDataURL(blob)
      })
    } catch { return null }
  }

  // For public https: URLs — use fetch with cors mode (works if bucket is public)
  try {
    const res = await fetch(src, { mode: 'cors' })
    if (!res.ok) throw new Error(`${res.status}`)
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('FileReader failed'))
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

export async function exportEmployeeProfile(emp, avatarSrc) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const PW = 595.28   // A4 width in pt
  const PH = 841.89   // A4 height in pt
  const ML = 28       // left margin
  const MT = 28       // top margin
  const MB = 28       // bottom margin
  const W  = PW - ML * 2   // 539.28 usable width

  // ── Colours ──────────────────────────────────────────────────────────────────
  const SECT  = [100, 100, 100]
  const LBL   = [210, 210, 210]
  const WHITE = [255, 255, 255]
  const BLACK = [0, 0, 0]

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const box = (x, y, w, h, fill) => {
    doc.setFillColor(...fill)
    doc.setDrawColor(...BLACK)
    doc.rect(x, y, w, h, 'FD')
  }

  const sectHdr = (label, x, y, w, h) => {
    box(x, y, w, h, SECT)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...WHITE)
    doc.text(label, x + w / 2, y + h / 2 + 3, { align: 'center' })
    doc.setTextColor(...BLACK)
  }

  // Auto-shrink font so text fits in cell width
  const fitTxt = (txt, maxW, maxSz = 7) => {
    let sz = maxSz
    doc.setFontSize(sz)
    while (sz > 4 && doc.getTextWidth(txt) > maxW - 5) { sz -= 0.25; doc.setFontSize(sz) }
  }

  // Side-by-side: label (grey) | value (white)
  const rowLV = (label, value, x, y, lw, vw, h) => {
    box(x, y, lw, h, LBL)
    doc.setFont('helvetica', 'bold')
    fitTxt(label, lw, 7)
    doc.setTextColor(...BLACK)
    doc.text(label, x + 3, y + h / 2 + 2.5, { baseline: 'middle' })

    box(x + lw, y, vw, h, WHITE)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...BLACK)
    const val = na(value)
    fitTxt(val, vw, 7.5)
    doc.text(val, x + lw + 3, y + h / 2 + 2.5, { baseline: 'middle' })
  }

  // Stacked: label row (grey full width) + value row (white, centered)
  const rowStacked = (label, value, x, y, w, lh, vh) => {
    box(x, y, w, lh, LBL)
    doc.setFont('helvetica', 'bold')
    fitTxt(label, w, 7)
    doc.setTextColor(...BLACK)
    doc.text(label, x + 3, y + lh / 2 + 2.5, { baseline: 'middle' })

    box(x, y + lh, w, vh, WHITE)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...BLACK)
    const val = na(value)
    fitTxt(val, w, 7.5)
    doc.text(val, x + w / 2, y + lh + vh / 2 + 2.5, { align: 'center', baseline: 'middle' })
  }

  const emptyCell = (x, y, w, h) => box(x, y, w, h, WHITE)

  // ────────────────────────────────────────────────────────────────────────────
  // Calculate available height and distribute it proportionally
  // Sections:
  //   A) Top personal (photo + 8 rows)
  //   B) "EMPLOYEE PROFILE" header
  //   C) Profile grid (12 rows left, right side 5+work exp)
  //   D) "FAMILY BACKGROUND" header
  //   E) Family (3 stacked pairs)
  //   F) "SEMINAR/TRAINING ATTENDED" header
  //   G) Training table (8 rows)
  //
  // Total fixed headers: 4 × SH
  // Remaining height split between rows proportionally.
  // ────────────────────────────────────────────────────────────────────────────

  const availH = PH - MT - MB    // 785.89 pt
  const SH = 14                  // section header height

  // Row counts per zone
  const topRows   = 8
  const profRows  = 12           // left column (tallest)
  const fbPairs   = 3            // father/mother/spouse — each = 2 rows (label + value)
  const fbRows    = fbPairs * 2  // 6
  const trainRows = 8

  // Total row slots
  const totalRows = topRows + profRows + fbRows + trainRows
  const totalHdrs = 4 * SH

  // Each "row unit" height
  const RH = (availH - totalHdrs) / totalRows

  // ── Start drawing ────────────────────────────────────────────────────────────
  let y = MT

  // SECTION A dimensions — defined here so topH and photoW are in scope
  const topH   = topRows * RH   // total height of top section (8 rows)
  const photoW = topH           // square photo box

  // Photo box
  box(ML, y, photoW, topH, WHITE)
  const photoSrc = avatarSrc || emp.avatar_url
  if (photoSrc) {
    const imgData = await imgToBase64(photoSrc)
    if (imgData) {
      const ext = photoSrc.toLowerCase().includes('.png') ? 'PNG' : 'JPEG'
      doc.addImage(imgData, ext, ML + 1, y + 1, photoW - 2, topH - 2)
    } else {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(150, 150, 150)
      doc.text('Photo unavailable', ML + photoW / 2, y + topH / 2, { align: 'center', baseline: 'middle' })
      doc.setTextColor(...BLACK)
    }
  } else {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(150, 150, 150)
    doc.text('2x2 Photo', ML + photoW / 2, y + topH / 2, { align: 'center', baseline: 'middle' })
    doc.setTextColor(...BLACK)
  }

  const pX  = ML + photoW
  const pLW = 90
  const pVW = W - photoW - pLW
  ;[
    ['FULL NAME',        na(emp.name)],
    ['ADDRESS',          na(emp.address)],
    ['DATE OF BIRTH',    na(emp.dob)],
    ['AGE',              calcAge(emp.dob)],
    ['SEX',              na(emp.sex ?? emp.gender)],
    ['CIVIL STATUS',     na(emp.civil_status)],
    ['CONTACT NUMBER',   na(emp.contact)],
    ['CURRENT POSITION', na(emp.designation)],
  ].forEach(([lbl, val], i) => rowLV(lbl, val, pX, y + i * RH, pLW, pVW, RH))

  y += topH

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION B — EMPLOYEE PROFILE header
  // ═══════════════════════════════════════════════════════════════════════════
  sectHdr('EMPLOYEE PROFILE', ML, y, W, SH)
  y += SH

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION C — Profile grid (left 12 rows | right: 5 edu + work exp)
  // ═══════════════════════════════════════════════════════════════════════════
  const halfW = W / 2
  const lw2   = 90
  const vw2   = halfW - lw2
  const profY = y   // save start for right column alignment

  const leftF = [
    ['EMAIL ADDRESS',            na(emp.email)],
    ['BLOOD TYPE',               na(emp.blood_type)],
    ['PLACE OF BIRTH',           na(emp.pob)],
    ['HEIGHT',                   na(emp.height)],
    ['WEIGHT',                   na(emp.weight)],
    ['TIN NO.',                  na(emp.tin)],
    ['PAG IBIG NO.',             na(emp.pagibig)],
    ['GSIS NO.',                 na(emp.gsis)],
    ['SSS NO.',                  na(emp.sss)],
    ['PHILHEALTH NO.',           na(emp.philhealth)],
    ['EMERGENCY CONTACT PERSON', na(emp.emergency_contact_person)],
    ['EMERGENCY CONTACT NO.',    na(emp.emergency_contact_no)],
  ]
  leftF.forEach(([lbl, val], i) => rowLV(lbl, val, ML, profY + i * RH, lw2, vw2, RH))

  // Right: 5 education rows
  const rightEdu = [
    ['MEDICAL CONDITION', na(emp.medical_condition)],
    ['ELEMENTARY',        na(emp.elementary)],
    ['HIGHSCHOOL',        na(emp.highschool)],
    ['COLLEGE',           na(emp.college)],
    ['ELIGIBILITY',       na(emp.eligibility)],
  ]
  rightEdu.forEach(([lbl, val], i) => rowLV(lbl, val, ML + halfW, profY + i * RH, lw2, vw2, RH))

  // Right: WORK EXPERIENCE starting exactly at row 5 of right column
  const weStartY = profY + 5 * RH
  const weH      = profRows * RH - 5 * RH   // remaining right-column height
  const jobW     = halfW * 0.48
  const dtW      = halfW - jobW
  const dtHalf   = dtW / 2

  // Work Exp header
  sectHdr('WORK EXPERIENCE', ML + halfW, weStartY, halfW, SH)

  // Sub-header row 1: JOB DESCRIPTION | INCLUSIVE DATES
  const weSubH1 = RH * 0.65
  box(ML + halfW,         weStartY + SH, jobW, weSubH1, LBL)
  box(ML + halfW + jobW,  weStartY + SH, dtW,  weSubH1, LBL)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(...BLACK)
  doc.text('JOB DESCRIPTION',           ML + halfW + jobW / 2, weStartY + SH + weSubH1 / 2 + 2, { align: 'center' })
  doc.text('INCLUSIVE DATES (dd/mm/yyy)',ML + halfW + jobW + dtW / 2, weStartY + SH + weSubH1 / 2 + 2, { align: 'center' })

  // Sub-header row 2: (empty) | FROM | TO
  const weSubH2 = RH * 0.55
  const weSub2Y = weStartY + SH + weSubH1
  box(ML + halfW,              weSub2Y, jobW,    weSubH2, LBL)
  box(ML + halfW + jobW,       weSub2Y, dtHalf,  weSubH2, LBL)
  box(ML + halfW + jobW + dtHalf, weSub2Y, dtHalf, weSubH2, LBL)
  doc.setFontSize(6.5)
  doc.text('FROM', ML + halfW + jobW + dtHalf / 2,          weSub2Y + weSubH2 / 2 + 2, { align: 'center' })
  doc.text('TO',   ML + halfW + jobW + dtHalf + dtHalf / 2, weSub2Y + weSubH2 / 2 + 2, { align: 'center' })

  // Work exp data rows — fill remaining height evenly
  const weDataY  = weSub2Y + weSubH2
  const weDataH  = weH - SH - weSubH1 - weSubH2
  const weRowCnt = leftF.length - 5   // = 7 rows alongside left column
  const weRH     = weDataH / weRowCnt

  for (let i = 0; i < weRowCnt; i++) {
    const wy = weDataY + i * weRH
    emptyCell(ML + halfW,              wy, jobW,   weRH)
    emptyCell(ML + halfW + jobW,       wy, dtHalf, weRH)
    emptyCell(ML + halfW + jobW + dtHalf, wy, dtHalf, weRH)
  }

  y += profRows * RH

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION D — FAMILY BACKGROUND header
  // ═══════════════════════════════════════════════════════════════════════════
  sectHdr('FAMILY BACKGROUND', ML, y, W, SH)
  y += SH

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION E — Family: 3 stacked pairs, each = RH (label) + RH (value)
  //             Children columns on the right side
  // ═══════════════════════════════════════════════════════════════════════════
  const fbHalf = W / 2
  const cNW    = W * 0.32
  const cDW    = W - fbHalf - cNW

  // Column headers for children (on the FIRST row of the family section)
  // They span the height of the first label row
  box(ML + fbHalf,       y, cNW,  RH, LBL)
  box(ML + fbHalf + cNW, y, cDW,  RH, LBL)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(...BLACK)
  doc.text('NAME OF CHILDREN',          ML + fbHalf + cNW / 2,       y + RH / 2 + 2, { align: 'center' })
  doc.text('DATE OF BIRTH (dd/mm/yyyy)', ML + fbHalf + cNW + cDW / 2, y + RH / 2 + 2, { align: 'center' })
  doc.setTextColor(...BLACK)

  // FATHER'S NAME
  rowStacked("FATHER'S NAME", na(emp.father_name), ML, y, fbHalf, RH, RH)
  // child row beside father's value row
  emptyCell(ML + fbHalf,       y + RH, cNW, RH)
  emptyCell(ML + fbHalf + cNW, y + RH, cDW, RH)
  y += RH * 2

  // MOTHER'S MAIDEN NAME
  rowStacked("MOTHER'S MAIDEN NAME", na(emp.mother_name), ML, y, fbHalf, RH, RH)
  emptyCell(ML + fbHalf,       y,      cNW, RH)
  emptyCell(ML + fbHalf + cNW, y,      cDW, RH)
  emptyCell(ML + fbHalf,       y + RH, cNW, RH)
  emptyCell(ML + fbHalf + cNW, y + RH, cDW, RH)
  y += RH * 2

  // SPOUSE NAME
  rowStacked('SPOUSE NAME', na(emp.spouse_name), ML, y, fbHalf, RH, RH)
  emptyCell(ML + fbHalf,       y,      cNW, RH)
  emptyCell(ML + fbHalf + cNW, y,      cDW, RH)
  emptyCell(ML + fbHalf,       y + RH, cNW, RH)
  emptyCell(ML + fbHalf + cNW, y + RH, cDW, RH)
  y += RH * 2

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION F — SEMINAR/TRAINING ATTENDED header  (no gap — straight after family)
  // ═══════════════════════════════════════════════════════════════════════════
  sectHdr('SEMINAR/TRAINING ATTENDED:', ML, y, W, SH)
  y += SH

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION G — Training table header row + 8 data rows
  // ═══════════════════════════════════════════════════════════════════════════
  const tCW = [W * 0.295, W * 0.175, W * 0.275, W * 0.255]
  const tHdrs = ['TRAINING SEMINAR', 'DATE OF TRAINING', 'TRAINING CONDUCTED BY:', 'TRAINING VENUE']
  let tx = ML
  tHdrs.forEach((h, i) => {
    box(tx, y, tCW[i], RH, LBL)
    doc.setFont('helvetica', 'bold')
    fitTxt(h, tCW[i], 7)
    doc.setTextColor(...BLACK)
    doc.text(h, tx + tCW[i] / 2, y + RH / 2 + 2.5, { align: 'center', baseline: 'middle' })
    tx += tCW[i]
  })
  y += RH

  const trainings = Array.isArray(emp.trainings_attended) ? emp.trainings_attended : []
  for (let i = 0; i < trainRows; i++) {
    const t = trainings[i] || {}
    tx = ML
    tCW.forEach((cw, ci) => {
      emptyCell(tx, y, cw, RH)
      const vals = [t.seminar, t.date, t.conducted_by, t.venue]
      if (vals[ci]) {
        doc.setFont('helvetica', 'normal')
        fitTxt(na(vals[ci]), cw, 7.5)
        doc.setTextColor(...BLACK)
        doc.text(na(vals[ci]), tx + 3, y + RH / 2 + 2.5, { baseline: 'middle' })
      }
      tx += cw
    })
    y += RH
  }

  const safeName = (emp.name || 'employee').replace(/[^a-zA-Z0-9 ]/g, '_')
  doc.save(`${safeName}_profile.pdf`)
}
