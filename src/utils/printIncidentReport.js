import jsPDF from 'jspdf'
import { format } from 'date-fns'
import { supabase } from '../services/supabase'

const na = (v) =>
  v === null || v === undefined || String(v).trim() === '' ? 'N/A' : String(v).trim()

const formatTime = (t) => {
  if (!t) return 'N/A'
  const str = String(t).trim()
  const match = str.match(/(\d{1,2}):(\d{2})/)
  if (!match) return str
  let h = parseInt(match[1], 10)
  const m = match[2]
  if (isNaN(h)) return str
  const isPMStr = /pm/i.test(str)
  const isAMStr = /am/i.test(str)
  if (isPMStr && h < 12) h += 12
  if (isAMStr && h === 12) h = 0
  const period = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m} ${period}`
}

const fmtDate = (d) => {
  if (!d) return 'N/A'
  try {
    return format(new Date(d), 'MMM dd, yyyy')
  } catch {
    return na(d)
  }
}

// Load image as base64
async function imgToBase64(src) {
  if (!src) return null

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

export async function printIncidentReport(incident) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const PW = 595.28
  const PH = 841.89
  const ML = 28
  const MT = 28
  const MB = 28
  const W = PW - ML * 2

  // Colors
  const HEADER_BG = [255, 255, 255]   // White background (no color)
  const SECTION_BG = [100, 100, 100]
  const LABEL_BG = [210, 210, 210]
  const WHITE = [255, 255, 255]
  const BLACK = [0, 0, 0]
  const LIGHT_GRAY = [245, 245, 245]

  let y = MT

  // Helper functions
  const box = (x, y, w, h, fill) => {
    doc.setFillColor(...fill)
    doc.setDrawColor(...BLACK)
    doc.rect(x, y, w, h, 'FD')
  }

  const sectionHeader = (label, x, y, w, h) => {
    box(x, y, w, h, SECTION_BG)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...WHITE)
    doc.text(label, x + w / 2, y + h / 2 + 3.5, { align: 'center' })
    doc.setTextColor(...BLACK)
  }

  const fitText = (txt, maxW, maxSz = 9) => {
    let sz = maxSz
    doc.setFontSize(sz)
    while (sz > 5 && doc.getTextWidth(txt) > maxW - 8) {
      sz -= 0.25
      doc.setFontSize(sz)
    }
  }

  const rowLabelValue = (label, value, x, y, lw, vw, h) => {
    box(x, y, lw, h, LABEL_BG)
    doc.setFont('helvetica', 'bold')
    fitText(label, lw, 8.5)
    doc.setTextColor(...BLACK)
    doc.text(label, x + 4, y + h / 2 + 3, { baseline: 'middle' })

    box(x + lw, y, vw, h, WHITE)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...BLACK)
    const val = na(value)
    fitText(val, vw, 9)
    doc.text(val, x + lw + 4, y + h / 2 + 3, { baseline: 'middle' })
  }

  const fullWidthRow = (label, value, x, y, w, h) => {
    const lh = h * 0.35
    const vh = h * 0.65
    box(x, y, w, lh, LABEL_BG)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...BLACK)
    doc.text(label, x + 4, y + lh / 2 + 2.5, { baseline: 'middle' })

    box(x, y + lh, w, vh, WHITE)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    const val = na(value)
    
    // Word wrap for long text - left-aligned from top
    const lines = doc.splitTextToSize(val, w - 8)
    const lineHeight = 10
    let textY = y + lh + 8  // Start from top with small padding
    lines.slice(0, Math.floor(vh / lineHeight)).forEach(line => {
      doc.text(line, x + 4, textY)
      textY += lineHeight
    })
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HEADER SECTION - SIMPLIFIED WITH PROPER SPACING
  // ═══════════════════════════════════════════════════════════════════════════
  const HEADER_H = 120  // Reduced header height
  const SECTION_HEADER_H = 18  // Section header height - increased
  const RH = 24  // Standard row height - increased for more space
  const FULL_ROW_H = 36  // Full width text rows - increased for more space
  
  box(ML, y, W, HEADER_H, HEADER_BG)
  
  // Draw header box without border - remove the box() call and draw directly
  // (Header background is white anyway, so no need to draw it)
  
  // Logo configuration - 2 logos closer to center, aligned with text
  const logoSize = 55  // Enlarged logos
  const logoY = y + 5  // Minimal top spacing
  const palayanLogoX = ML + 70  // Closer to center from left
  const cdrrmoLogoX = ML + W - logoSize - 70  // Closer to center from right
  
  // Helper function to load logo from Supabase Storage
  const loadSupabaseLogo = async (filename) => {
    try {
      const { data } = supabase.storage.from('Logos').getPublicUrl(filename)
      if (data?.publicUrl) {
        const imgData = await imgToBase64(data.publicUrl)
        return imgData
      }
    } catch (err) {
      console.warn(`Could not load ${filename}:`, err)
    }
    return null
  }
  
  // Left: Palayan City Logo
  const palayanImg = await loadSupabaseLogo('Palayan city logo.png')
  if (palayanImg) {
    try {
      doc.addImage(palayanImg, 'PNG', palayanLogoX, logoY, logoSize, logoSize)
    } catch (err) {
      console.warn('Error adding Palayan logo to PDF:', err)
    }
  }
  
  // Right: CDRRMO Logo
  const cdrrmoImg = await loadSupabaseLogo('CDRRMO logo.png')
  if (cdrrmoImg) {
    try {
      doc.addImage(cdrrmoImg, 'PNG', cdrrmoLogoX, logoY, logoSize, logoSize)
    } catch (err) {
      console.warn('Error adding CDRRMO logo to PDF:', err)
    }
  }
  
  // Text starts aligned with logos (not below)
  let textY = logoY + 12
  
  // Header text - aligned with top of logos
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...BLACK)
  doc.text('Republic of the Philippines', ML + W / 2, textY, { align: 'center' })
  textY += 10  // Increased spacing
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.text('PALAYAN CITY', ML + W / 2, textY, { align: 'center' })
  textY += 9 // Increased spacing
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.text('Capital of Nueva Ecija', ML + W / 2, textY, { align: 'center' })
  textY += 10
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('DISASTER RISK REDUCTION AND MANAGEMENT OFFICE', ML + W / 2, textY, { align: 'center' })
  textY += 9
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Palayan City Evacuation Center and Multi-Purpose Facility', ML + W / 2, textY, { align: 'center' })
  textY += 7
  doc.text('Brgy. Atate, Palayan City', ML + W / 2, textY, { align: 'center' })
  textY += 9
  
  // Contact info - all in one line with smaller font
  doc.setFontSize(6)
  doc.text('Email: r3.ne.cdrrm.palayan.official@gmail.com | Tel No.: (044) 940-4357 | Celular Nos.: 0966-910-9674; 0920-574-1581', ML + W / 2, textY, { align: 'center' })
  textY += 18  // Space before horizontal line
  
  // Horizontal line separator
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(1)
  doc.line(ML, textY, ML + W, textY)
  textY += 15  // Space after line before title
  
  // Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('INCIDENT REPORT', ML + W / 2, textY, { align: 'center' })
  textY += 14  // More space before record ID
  
  // Record ID
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.text(na(incident.record_id), ML + W / 2, textY, { align: 'center' })
  
  doc.setTextColor(...BLACK)
  y += HEADER_H + 6

  // ═══════════════════════════════════════════════════════════════════════════
  // INCIDENT DETAILS
  // ═══════════════════════════════════════════════════════════════════════════
  const halfW = W / 2
  const lw = 100
  const vw = halfW - lw

  sectionHeader('INCIDENT INFORMATION', ML, y, W, SECTION_HEADER_H)
  y += SECTION_HEADER_H

  // Row 1: Date | Time of Call
  rowLabelValue('Date', fmtDate(incident.date), ML, y, lw, vw, RH)
  rowLabelValue('Time of Call', formatTime(incident.time_of_call), ML + halfW, y, lw, vw, RH)
  y += RH

  // Row 2: Team | Severity
  const teamDisplay = incident.team === 'Other' && incident.team_other 
    ? incident.team_other 
    : na(incident.team)
  rowLabelValue('Team', teamDisplay, ML, y, lw, vw, RH)
  rowLabelValue('Severity', na(incident.severity), ML + halfW, y, lw, vw, RH)
  y += RH

  // Row 3: Place of Incident (full width)
  fullWidthRow('Place of Incident', incident.place_of_incident, ML, y, W, FULL_ROW_H)
  y += FULL_ROW_H

  // Row 4: Exact Place (full width)
  fullWidthRow('Exact Place / Landmark', incident.exact_place, ML, y, W, FULL_ROW_H)
  y += FULL_ROW_H

  // Row 5: Nature of Incident (full width)
  fullWidthRow('Nature of Incident', incident.nature_of_incident, ML, y, W, FULL_ROW_H)
  y += FULL_ROW_H

  y += 10

  // ═══════════════════════════════════════════════════════════════════════════
  // VICTIM INFORMATION
  // ═══════════════════════════════════════════════════════════════════════════
  sectionHeader('VICTIM / PATIENT INFORMATION', ML, y, W, SECTION_HEADER_H)
  y += SECTION_HEADER_H

  // Row 1: Name | Age
  rowLabelValue('Name', incident.name, ML, y, lw, halfW - lw - 60, RH)
  rowLabelValue('Age', na(incident.age), ML + halfW - 60, y, 30, 30, RH)
  rowLabelValue('Vehicle', na(incident.vehicle), ML + halfW, y, lw, vw, RH)
  y += RH

  // Row 2: Address (full width)
  fullWidthRow('Address', incident.address, ML, y, W, FULL_ROW_H)
  y += FULL_ROW_H

  // Row 3: Injury/Illness (full width)
  fullWidthRow('Injury / Illness / Complaint', incident.injury_illness_complaint, ML, y, W, FULL_ROW_H)
  y += FULL_ROW_H

  // Row 4: Helmet | Liquor
  rowLabelValue('Helmet', na(incident.helmet), ML, y, lw, vw, RH)
  rowLabelValue('Under Influence', na(incident.liquor), ML + halfW, y, lw, vw, RH)
  y += RH

  y += 10

  // ═══════════════════════════════════════════════════════════════════════════
  // RESPONSE TIMELINE
  // ═══════════════════════════════════════════════════════════════════════════
  sectionHeader('RESPONSE TIMELINE', ML, y, W, SECTION_HEADER_H)
  y += SECTION_HEADER_H

  rowLabelValue('Arrival at Scene', formatTime(incident.time_of_arrival_at_scene), ML, y, lw, vw, RH)
  rowLabelValue('Departure at Scene', formatTime(incident.time_of_departure_at_scene), ML + halfW, y, lw, vw, RH)
  y += RH

  rowLabelValue('Arrival at Hospital', formatTime(incident.time_of_arrival_at_hosp), ML, y, lw, vw, RH)
  rowLabelValue('Departure at Hospital', formatTime(incident.time_of_departure_at_hosp), ML + halfW, y, lw, vw, RH)
  y += RH

  rowLabelValue('Back to Base', formatTime(incident.back_to_base), ML, y, lw, vw, RH)
  y += RH

  y += 10

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSFER & ACTION
  // ═══════════════════════════════════════════════════════════════════════════
  sectionHeader('TRANSFER & ACTION TAKEN', ML, y, W, SECTION_HEADER_H)
  y += SECTION_HEADER_H

  const transferTo = incident.transfer_to === 'Other' && incident.transfer_to_other
    ? incident.transfer_to_other
    : na(incident.transfer_to)
  
  rowLabelValue('Transfer From', na(incident.transfer_from), ML, y, lw, vw, RH)
  rowLabelValue('Transfer To', transferTo, ML + halfW, y, lw, vw, RH)
  y += RH

  rowLabelValue('Ambulance', na(incident.ambulance), ML, y, lw, vw, RH)
  rowLabelValue('Refused Transfer', incident.refused_transfer ? 'Yes' : 'No', ML + halfW, y, lw, vw, RH)
  y += RH

  fullWidthRow('Action Given', incident.action_given, ML, y, W, FULL_ROW_H)
  y += FULL_ROW_H

  fullWidthRow('Remarks / Additional Notes', incident.remarks, ML, y, W, FULL_ROW_H)
  y += FULL_ROW_H

  y += 8

  // ═══════════════════════════════════════════════════════════════════════════
  // PHOTOS SECTION - ON SEPARATE PAGE
  // ═══════════════════════════════════════════════════════════════════════════
  if (incident.photos && incident.photos.length > 0) {
    // Add new page for photos
    doc.addPage()
    y = MT

    sectionHeader('INCIDENT PHOTOS', ML, y, W, 18)
    y += 18 + 10

    const photoSize = 200
    const photosPerRow = 2
    const photoGap = 20
    const availW = W - (photosPerRow - 1) * photoGap
    const photoW = availW / photosPerRow

    for (let i = 0; i < Math.min(incident.photos.length, 8); i++) {
      if (i > 0 && i % photosPerRow === 0) {
        y += photoSize + photoGap
        // Check if we need another new page
        if (y + photoSize > PH - MB) {
          doc.addPage()
          y = MT
        }
      }

      const col = i % photosPerRow
      const photoX = ML + col * (photoW + photoGap)

      box(photoX, y, photoW, photoSize, LIGHT_GRAY)

      const photoUrl = incident.photos[i]
      const imgData = await imgToBase64(photoUrl)
      if (imgData) {
        try {
          const ext = photoUrl.toLowerCase().includes('.png') ? 'PNG' : 'JPEG'
          doc.addImage(imgData, ext, photoX + 2, y + 2, photoW - 4, photoSize - 4)
        } catch (err) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
          doc.setTextColor(150, 150, 150)
          doc.text('Photo unavailable', photoX + photoW / 2, y + photoSize / 2, {
            align: 'center',
            baseline: 'middle'
          })
          doc.setTextColor(...BLACK)
        }
      } else {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text('Loading failed', photoX + photoW / 2, y + photoSize / 2, {
          align: 'center',
          baseline: 'middle'
        })
        doc.setTextColor(...BLACK)
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════════════════════════════════════
  const footerY = PH - MB - 20
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(150, 150, 150)
  doc.text(`Generated on ${format(new Date(), 'MMM dd, yyyy hh:mm a')}`, ML, footerY)
  doc.text('CDRRMO Incident Report', PW - ML, footerY, { align: 'right' })

  // Save PDF
  const safeName = (incident.record_id || 'incident').replace(/[^a-zA-Z0-9-]/g, '_')
  doc.save(`${safeName}_report.pdf`)
}
