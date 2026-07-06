/**
 * printPDF.js
 * Opens a styled print window for any module's list data.
 *
 * Usage:
 *   printPDF({
 *     title:   'Incidents Report',
 *     columns: [
 *       { header: 'Date',     key: 'date_time',  format: v => formatDate(v) },
 *       { header: 'Location', key: 'location' },
 *       { header: 'Status',   key: 'status' },
 *     ],
 *     records: filteredRecords,
 *   })
 */
export function printPDF({ title, columns, records, subtitle = '' }) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })

  const headers = columns.map(c => `<th>${c.header}</th>`).join('')

  const rows = records.map(rec => {
    const cells = columns.map(c => {
      let val = rec[c.key]
      if (c.format) val = c.format(val, rec)
      return `<td>${val ?? '—'}</td>`
    })
    return `<tr>${cells.join('')}</tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      color: #111;
      background: #fff;
      padding: 28px 32px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 18px;
      border-bottom: 2px solid #16a34a;
      padding-bottom: 14px;
    }
    .header-left h1 {
      font-size: 18px;
      font-weight: 800;
      color: #16a34a;
      margin-bottom: 3px;
    }
    .header-left p {
      font-size: 11px;
      color: #6b7280;
    }
    .header-right {
      text-align: right;
      font-size: 11px;
      color: #6b7280;
    }
    .header-right strong {
      display: block;
      font-size: 13px;
      color: #111;
      margin-bottom: 2px;
    }
    .meta {
      font-size: 11px;
      color: #6b7280;
      margin-bottom: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    thead th {
      background: #16a34a;
      color: #fff;
      padding: 7px 9px;
      text-align: left;
      font-weight: 700;
      white-space: nowrap;
    }
    tbody tr:nth-child(even) {
      background: #f0fdf4;
    }
    tbody tr:hover {
      background: #dcfce7;
    }
    tbody td {
      padding: 6px 9px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
    }
    .footer {
      margin-top: 18px;
      font-size: 10px;
      color: #9ca3af;
      text-align: center;
      border-top: 1px solid #e5e7eb;
      padding-top: 10px;
    }
    @media print {
      body { padding: 12px 14px; }
      button { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>${title}</h1>
      ${subtitle ? `<p>${subtitle}</p>` : ''}
      <p>CDRRMO — City Disaster Risk Reduction and Management Office</p>
    </div>
    <div class="header-right">
      <strong>Generated Report</strong>
      ${dateStr}<br/>${timeStr}
    </div>
  </div>
  <p class="meta">Total records: <strong>${records.length}</strong></p>
  <table>
    <thead><tr>${headers}</tr></thead>
    <tbody>${rows || '<tr><td colspan="' + columns.length + '" style="text-align:center;color:#9ca3af;padding:16px">No records found</td></tr>'}</tbody>
  </table>
  <div class="footer">
    CDRRMO Records Management System &nbsp;|&nbsp; Printed on ${dateStr} at ${timeStr}
  </div>
  <script>
    window.onload = function() { window.print() }
  </script>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1000,height=700')
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for this site to print.')
    return
  }
  win.document.write(html)
  win.document.close()
}
