import { useState, useMemo, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

// ── Verified coordinates for all 19 barangays of Palayan City ─────────────────
const BARANGAY_COORDS = {
  'Atate':          [15.5589, 121.1007],
  'Aulo':           [15.5189, 121.0946],
  'Bagong Buhay':   [15.4630, 121.1160],
  'Bo. Militar':    [15.4330, 121.0754],
  'Caballero':      [15.5396, 121.1166],
  'Caimito':        [15.5464, 121.0862],
  'Doña Josefa':    [15.4440, 121.1150],
  'Ganaderia':      [15.5416, 121.0877],
  'Imelda Valley':  [15.5781, 121.1219],
  'Langka':         [15.4281, 121.1555],
  'Malate':         [15.5434, 121.0806],
  'Maligaya':       [15.4636, 121.1021],
  'Manacnac':       [15.5301, 121.0621],
  'Mapait':         [15.5098, 121.1041],
  'Marcos Village': [15.5846, 121.1180],
  'Popolon Pagas':  [15.5375, 121.0565],
  'Santolan':       [15.5323, 121.0901],
  'Sapang Buho':    [15.5902, 121.1259],
  'Singalat':       [15.5718, 121.0953],
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const normalize = (str = '') =>
  str.toLowerCase()
    .replace(/^(brgy\.?|barangay\.?|bo\.?)\s*/i, '')
    .replace(/[^a-z0-9\s\-ñ]/g, '')
    .trim()

const findBarangay = (locationStr = '') => {
  if (!locationStr) return null
  const loc = normalize(locationStr)
  for (const [name, coords] of Object.entries(BARANGAY_COORDS)) {
    const normName = normalize(name)
    if (loc.includes(normName) || normName.includes(loc.split(' ')[0])) {
      return { name, coords }
    }
  }
  const firstWord = loc.split(/[\s,]+/)[0]
  if (firstWord.length >= 4) {
    for (const [name, coords] of Object.entries(BARANGAY_COORDS)) {
      if (normalize(name).startsWith(firstWord)) return { name, coords }
    }
  }
  return null
}

function buildHeatData(incidents) {
  const heat = {}
  for (const inc of incidents) {
    for (const f of [inc.place_of_incident, inc.specific_location, inc.exact_place]) {
      const match = findBarangay(f)
      if (match) { heat[match.name] = (heat[match.name] || 0) + 1; break }
    }
  }
  return heat
}

function dotColor(ratio) {
  if (ratio >= 0.8) return '#dc2626'
  if (ratio >= 0.5) return '#f97316'
  if (ratio >= 0.25) return '#eab308'
  return '#3b82f6'
}

// ── Fly-to helper ─────────────────────────────────────────────────────────────
function FlyTo({ coords }) {
  const map = useMap()
  useEffect(() => {
    if (coords) map.flyTo(coords, 14, { duration: 0.8 })
  }, [coords, map])
  return null
}

// ── World-minus-Palayan mask rendered as a native SVG overlay ─────────────────
// This approach FOLLOWS the map on pan/zoom because we use latLngToContainerPoint()
// on every move event — unlike GeoJSON which clips at viewport bounds.
function PalayanMask({ geom }) {
  const map = useMap()
  const svgRef = useRef(null)

  useEffect(() => {
    if (!geom || !map) return

    // Extract the main boundary ring [lng, lat] pairs
    let ring = []
    if (geom.type === 'Polygon') {
      ring = geom.coordinates[0]
    } else if (geom.type === 'MultiPolygon') {
      // Use the longest ring (largest polygon)
      ring = geom.coordinates.reduce((a, b) =>
        a[0].length >= b[0].length ? a : b
      )[0]
    }
    if (!ring.length) return

    const container = map.getContainer()

    // Build SVG element positioned absolutely over the map
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    Object.assign(svg.style, {
      position: 'absolute',
      top: '0', left: '0',
      width: '100%', height: '100%',
      pointerEvents: 'none',
      zIndex: '450',  // above tiles (200), below markers (600)
    })

    // KEY FIX: evenodd fill-rule only creates a "hole" when sub-paths are part
    // of a SINGLE <path> element — NOT separate children of a <g>.
    // We build a single <path d="..."> with two sub-paths:
    //   1. A huge rectangle  → odd intersections → filled dark
    //   2. The Palayan ring  → even intersections → transparent hole (window into the map)
    const maskPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    maskPath.setAttribute('fill', 'rgba(0,0,0,0.60)')
    maskPath.setAttribute('fill-rule', 'evenodd')
    svg.appendChild(maskPath)

    // Blue border outline (separate element — no fill, stroke only)
    const border = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    border.setAttribute('fill', 'none')
    border.setAttribute('stroke', '#3b82f6')
    border.setAttribute('stroke-width', '2.5')
    border.setAttribute('stroke-linejoin', 'round')
    border.setAttribute('stroke-linecap', 'round')
    svg.appendChild(border)

    container.appendChild(svg)
    svgRef.current = svg

    // Re-project boundary ring to container pixels every time the map moves
    const update = () => {
      const size = map.getSize()
      svg.setAttribute('viewBox', `0 0 ${size.x} ${size.y}`)

      // Convert each [lng, lat] pair to current viewport pixel coords
      const palayanSubPath = ring
        .map(([lng, lat], i) => {
          const p = map.latLngToContainerPoint([lat, lng])
          return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
        })
        .join(' ') + ' Z'

      // Sub-path 1: giant rectangle (dark background)
      const rectSubPath = 'M -10000 -10000 L 20000 -10000 L 20000 20000 L -10000 20000 Z'

      // Combined single path — evenodd makes Palayan transparent
      maskPath.setAttribute('d', `${rectSubPath} ${palayanSubPath}`)
      border.setAttribute('d', palayanSubPath)
    }

    update()
    map.on('move zoom resize moveend zoomend', update)

    return () => {
      map.off('move zoom resize moveend zoomend', update)
      if (svgRef.current && container.contains(svgRef.current)) {
        container.removeChild(svgRef.current)
        svgRef.current = null
      }
    }
  }, [geom, map])

  return null
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PalayanCityMap({ incidents = [] }) {
  const [filterBarangay, setFilterBarangay] = useState(null)
  const [flyCoords, setFlyCoords] = useState(null)
  const [palayanGeom, setPalayanGeom] = useState(null)
  const [boundaryLoading, setBoundaryLoading] = useState(true)

  // Fetch Palayan City boundary from Nominatim
  useEffect(() => {
    fetch(
      'https://nominatim.openstreetmap.org/search?q=Palayan+City%2C+Nueva+Ecija%2C+Philippines&format=geojson&polygon_geojson=1&limit=1',
      { headers: { Accept: 'application/json' } }
    )
      .then(r => r.json())
      .then(data => {
        const geom = data.features?.[0]?.geometry
        if (geom) setPalayanGeom(geom)
      })
      .catch(err => console.info('Palayan boundary unavailable:', err.message))
      .finally(() => setBoundaryLoading(false))
  }, [])

  const heatData = useMemo(() => buildHeatData(incidents), [incidents])
  const maxCount = useMemo(() => Math.max(1, ...Object.values(heatData)), [heatData])

  const incidentsByBarangay = useMemo(() => {
    const map = {}
    for (const inc of incidents) {
      for (const f of [inc.place_of_incident, inc.specific_location, inc.exact_place]) {
        const match = findBarangay(f)
        if (match) {
          if (!map[match.name]) map[match.name] = []
          map[match.name].push(inc)
          break
        }
      }
    }
    return map
  }, [incidents])

  const totalMapped = useMemo(() =>
    Object.values(heatData).reduce((s, c) => s + c, 0), [heatData])

  const hotBarangays = useMemo(() =>
    Object.entries(heatData).sort((a, b) => b[1] - a[1]).slice(0, 5), [heatData])

  const filteredIncidents = filterBarangay ? (incidentsByBarangay[filterBarangay] || []) : []

  const handleSelect = (name, coords) => {
    if (filterBarangay === name) { setFilterBarangay(null); setFlyCoords(null) }
    else { setFilterBarangay(name); setFlyCoords(coords) }
  }

  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border-light)',
      borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '24px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--primary-bg)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
            <i className="ri-map-pin-2-fill" />
          </div>
          <div>
            <div style={{ fontWeight: '800', fontSize: '15px', color: 'var(--text-main)' }}>Palayan City Incident Map</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {totalMapped} incident{totalMapped !== 1 ? 's' : ''} mapped across {Object.keys(heatData).length} barangay{Object.keys(heatData).length !== 1 ? 's' : ''} &bull; 19 barangays
              {boundaryLoading && <span style={{ marginLeft: '8px', color: 'var(--primary)', fontSize: '11px' }}>Loading boundary…</span>}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {[['#3b82f6','Low'],['#eab308','Moderate'],['#f97316','High'],['#dc2626','Hotspot']].map(([c, l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: c }} />
              <span style={{ fontWeight: '600' }}>{l}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#94a3b8' }} />
            <span>No incidents</span>
          </div>
        </div>
      </div>

      {/* Map + sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '16px', alignItems: 'start' }}>

        {/* Leaflet Map */}
        <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-light)', height: '460px', position: 'relative' }}>
          <MapContainer
            center={[15.5100, 121.0900]}
            zoom={11}
            style={{ width: '100%', height: '100%' }}
            scrollWheelZoom
            maxZoom={17}
            minZoom={11}
            maxBounds={[[15.30, 120.90], [15.70, 121.30]]}
            maxBoundsViscosity={1.0}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Native SVG mask — follows pan/zoom */}
            {palayanGeom && <PalayanMask geom={palayanGeom} />}

            {/* Fly to selected barangay */}
            {flyCoords && <FlyTo coords={flyCoords} />}

            {/* Incident dots (rendered above the mask via z-index > 450) */}
            {Object.entries(BARANGAY_COORDS).map(([name, coords]) => {
              const count = heatData[name] || 0
              const hasIncidents = count > 0
              const ratio = count / maxCount
              const color = hasIncidents ? dotColor(ratio) : '#94a3b8'
              const radius = hasIncidents ? 7 + ratio * 13 : 5
              const isSelected = filterBarangay === name

              return (
                <CircleMarker
                  key={name}
                  center={coords}
                  radius={isSelected ? radius + 4 : radius}
                  pathOptions={{
                    color: isSelected ? '#fff' : (hasIncidents ? 'rgba(255,255,255,0.85)' : 'rgba(148,163,184,0.4)'),
                    fillColor: color,
                    fillOpacity: hasIncidents ? 0.92 : 0.5,
                    weight: isSelected ? 3 : 1.5,
                  }}
                  eventHandlers={{ click: () => handleSelect(name, coords) }}
                >
                  <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
                    <div>
                      <strong style={{ fontSize: '13px' }}>{name}</strong>
                      <div style={{ fontSize: '12px', color: hasIncidents ? '#dc2626' : '#64748b', marginTop: '2px' }}>
                        {hasIncidents ? `${count} incident${count !== 1 ? 's' : ''}` : 'No recorded incidents'}
                      </div>
                      {hasIncidents && <div style={{ fontSize: '10px', color: '#6366f1', marginTop: '2px' }}>Click to filter</div>}
                    </div>
                  </Tooltip>
                  {hasIncidents && (
                    <Popup>
                      <div style={{ minWidth: '160px' }}>
                        <div style={{ fontWeight: '800', fontSize: '13px', marginBottom: '6px' }}>📍 {name}</div>
                        <div style={{ fontSize: '12px' }}><strong>{count}</strong> incident{count !== 1 ? 's' : ''}</div>
                        <button
                          onClick={() => handleSelect(name, coords)}
                          style={{ marginTop: '8px', width: '100%', padding: '5px 10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          {filterBarangay === name ? 'Clear Filter' : 'View Incidents'}
                        </button>
                      </div>
                    </Popup>
                  )}
                </CircleMarker>
              )
            })}
          </MapContainer>
        </div>

        {/* Side panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="ri-fire-line" style={{ color: '#dc2626' }} /> Top Barangays
            </div>
            {hotBarangays.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>No incidents mapped yet</div>
            ) : hotBarangays.map(([name, count], i) => {
              const ratio = count / maxCount
              return (
                <div key={name} onClick={() => handleSelect(name, BARANGAY_COORDS[name])} style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px',
                  borderRadius: '7px', cursor: 'pointer', marginBottom: '4px',
                  background: filterBarangay === name ? 'var(--primary-bg)' : 'transparent',
                  border: filterBarangay === name ? '1px solid var(--primary)' : '1px solid transparent',
                  transition: 'all 0.15s ease',
                }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: dotColor(ratio), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '800', flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{count} incident{count !== 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ width: '30px', height: '4px', background: 'var(--border-light)', borderRadius: '99px', overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ width: `${ratio * 100}%`, height: '100%', background: dotColor(ratio), borderRadius: '99px' }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>Summary</div>
            {[
              { label: 'Total incidents', value: incidents.length, color: 'var(--text-main)' },
              { label: 'Mapped', value: totalMapped, color: '#16a34a' },
              { label: 'Unmapped', value: incidents.length - totalMapped, color: '#d97706' },
              { label: 'Barangays affected', value: Object.keys(heatData).length, color: '#dc2626' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginBottom: '7px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                <span style={{ fontWeight: '800', color: s.color, fontFamily: 'monospace' }}>{s.value}</span>
              </div>
            ))}
          </div>

          <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>All Barangays</div>
            <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {Object.entries(BARANGAY_COORDS).map(([name, coords]) => {
                const count = heatData[name] || 0
                return (
                  <div key={name} onClick={() => handleSelect(name, coords)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '4px 6px', borderRadius: '5px', cursor: 'pointer', fontSize: '11.5px',
                    background: filterBarangay === name ? 'var(--primary-bg)' : 'transparent',
                    color: count > 0 ? 'var(--text-main)' : 'var(--text-muted)',
                    fontWeight: count > 0 ? '600' : '400',
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    {count > 0 && (
                      <span style={{ flexShrink: 0, padding: '1px 6px', borderRadius: '99px', background: dotColor(count / maxCount), color: '#fff', fontSize: '10px', fontWeight: '800', marginLeft: '4px' }}>{count}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {filterBarangay && (
            <button onClick={() => { setFilterBarangay(null); setFlyCoords(null) }} style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-app)', color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <i className="ri-close-circle-line" /> Clear: {filterBarangay}
            </button>
          )}
        </div>
      </div>

      {/* Incident list for selected barangay */}
      {filterBarangay && filteredIncidents.length > 0 && (
        <div style={{ marginTop: '16px', background: 'var(--bg-app)', border: '1px solid var(--border-light)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="ri-map-pin-line" style={{ color: 'var(--primary)' }} />
            <span style={{ fontWeight: '800', fontSize: '13px' }}>Incidents in {filterBarangay}</span>
            <span style={{ marginLeft: 'auto', padding: '2px 8px', background: '#fee2e2', color: '#dc2626', borderRadius: '99px', fontSize: '11px', fontWeight: '700' }}>
              {filteredIncidents.length} record{filteredIncidents.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
            {filteredIncidents.map((inc, i) => (
              <div key={inc.id || i} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '12px', alignItems: 'center' }}>
                <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted)', fontWeight: '600' }}>{inc.record_id || `#${i + 1}`}</div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>{inc.nature_of_incident || 'Incident'}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{inc.place_of_incident || inc.specific_location || '—'}</div>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {inc.date ? new Date(inc.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
