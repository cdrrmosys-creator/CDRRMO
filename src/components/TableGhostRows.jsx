export default function TableGhostRows({ count, colSpan, rowHeight = '49px' }) {
  if (count <= 0) return null

  return Array.from({ length: count }).map((_, i) => (
    <tr key={`ghost-${i}`} className="table-ghost-row" style={{ height: rowHeight, pointerEvents: 'none' }}>
      <td colSpan={colSpan} style={{ borderBottom: '1px solid var(--border-light)' }} />
    </tr>
  ))
}