/**
 * printPDF.js
 * Generates and downloads a clean PDF report using jsPDF and jspdf-autotable.
 * Direct file download prevents browser popup windows and UI freezing.
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function printPDF({ title, columns, records, subtitle = '', filename }) {
  // Use landscape for reports with 6 or more columns, portrait otherwise
  const isLandscape = columns.length >= 6
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  // Title Header
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(22, 163, 74) // #16a34a Primary Green
  doc.text(title || 'CDRRMO Report', 14, 15)

  // Meta / Subtitle info
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(107, 114, 128) // #6b7280 Muted Text

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
  const subText = subtitle
    ? `${subtitle}  |  Generated: ${dateStr} ${timeStr}`
    : `Total records: ${records.length}  |  Generated: ${dateStr} ${timeStr}`

  doc.text(subText, 14, 21)
  doc.text('CDRRMO — City Disaster Risk Reduction and Management Office', 14, 26)

  // Green accent line divider
  doc.setDrawColor(22, 163, 74)
  doc.setLineWidth(0.5)
  const pageWidth = doc.internal.pageSize.getWidth()
  doc.line(14, 29, pageWidth - 14, 29)

  // Headers and table body formatting
  const head = [columns.map(c => c.header)]
  const body = records.map(rec => {
    return columns.map(c => {
      let val = rec[c.key]
      if (c.format) val = c.format(val, rec)
      return val ?? '—'
    })
  })

  // Render Table
  autoTable(doc, {
    startY: 33,
    head: head,
    body: body,
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      overflow: 'linebreak',
      textColor: [31, 41, 55],
    },
    headStyles: {
      fillColor: [22, 163, 74],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [240, 253, 244],
    },
    margin: { top: 33, left: 14, right: 14, bottom: 18 },
    didDrawPage: (data) => {
      const pageCount = doc.internal.getNumberOfPages()
      const pageHeight = doc.internal.pageSize.getHeight()
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(156, 163, 175)
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}  |  CDRRMO Records Management System`,
        14,
        pageHeight - 8
      )
    }
  })

  // Format output filename
  let outName = filename || title || 'report'
  outName = outName.toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/_+/g, '_')
  if (!outName.endsWith('.pdf')) {
    outName += '.pdf'
  }

  // 1. Download file directly
  doc.save(outName)

  // 2. Automatically open PDF in a new tab
  try {
    const blobUrl = doc.output('bloburl')
    window.open(blobUrl, '_blank')
  } catch (err) {
    console.warn('Could not auto-open PDF preview tab:', err)
  }
}
