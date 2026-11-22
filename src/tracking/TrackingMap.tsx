import 'leaflet/dist/leaflet.css'
import './tracking.css'
import { useComputedColorScheme } from '@mantine/core'
import { divIcon, latLngBounds } from 'leaflet'
import { useEffect, useMemo } from 'react'
import { Circle, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, ZoomControl } from 'react-leaflet'

export interface MapPoint {
  latitude: number
  longitude: number
  label: string
  kind: 'driver' | 'destination'
  /** A driver not heard from for a few minutes is drawn grey, without the pulse */
  stale?: boolean
  /** The destination is an area (the PIN code's middle), drawn as a soft circle of this radius */
  areaRadiusM?: number
}

/**
 * Muted base maps, so the driver and the destination stand out: CARTO Positron by day, Dark Matter in dark mode.
 * Free within CARTO's limits; a production shop sets VITE_MAP_TILES_URL (and VITE_MAP_TILES_DARK_URL) to its own
 * provider (MapTiler, Stadia, CARTO enterprise).
 */
const TILES = {
  light: import.meta.env.VITE_MAP_TILES_URL || 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark:
    import.meta.env.VITE_MAP_TILES_DARK_URL ||
    import.meta.env.VITE_MAP_TILES_URL ||
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
}
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

const ORANGE = '#e8590c'

// Tabler "scooter" and "home" outlines, drawn inside the markers
const SCOOTER =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M6 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M8 17h5a6 6 0 0 1 5 -5v-5a2 2 0 0 0 -2 -2h-1"/></svg>'
const HOME =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l-2 0l9 -9l9 9l-2 0"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7"/></svg>'

/** Markers drawn with HTML and CSS (tracking.css), so no marker images are needed */
function icon(point: MapPoint) {
  if (point.kind === 'driver') {
    return divIcon({
      className: '',
      html: `<div class="tm-driver${point.stale ? ' tm-stale' : ''}">${point.stale ? '' : '<span class="tm-pulse"></span>'}<span class="tm-badge">${SCOOTER}</span></div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    })
  }
  return divIcon({
    className: '',
    html: `<div class="tm-home"><span class="tm-pin">${HOME}</span></div>`,
    iconSize: [34, 42],
    iconAnchor: [17, 40],
  })
}

/**
 * The delivery map: the driver, the customer's area, and a dashed line between them. Loaded on its own
 * (React.lazy), so Leaflet is downloaded only by pages that show a map.
 */
export default function TrackingMap({ points, height = 360, line = false }: { points: MapPoint[]; height?: number; line?: boolean }) {
  const scheme = useComputedColorScheme('light')
  const icons = useMemo(() => new Map(points.map((p) => [`${p.kind}-${p.label}`, icon(p)])), [points])
  const first = points[0]
  if (!first) return null
  const driver = points.find((p) => p.kind === 'driver')
  const home = points.find((p) => p.kind === 'destination')

  return (
    <MapContainer
      center={[first.latitude, first.longitude]}
      zoom={14}
      scrollWheelZoom={false}
      zoomControl={false}
      attributionControl
      className="tm-map"
      style={{ height, width: '100%' }}
    >
      <TileLayer key={scheme} url={TILES[scheme]} attribution={ATTRIBUTION} subdomains="abcd" maxZoom={19} />
      <ZoomControl position="bottomright" />
      {points
        .filter((p) => p.areaRadiusM)
        .map((p) => (
          <Circle
            key={`area-${p.label}`}
            center={[p.latitude, p.longitude]}
            radius={p.areaRadiusM!}
            pathOptions={{ color: ORANGE, weight: 1.5, dashArray: '4 6', fillColor: ORANGE, fillOpacity: 0.08 }}
          />
        ))}
      {line && driver && home && (
        <Polyline
          positions={[
            [driver.latitude, driver.longitude],
            [home.latitude, home.longitude],
          ]}
          pathOptions={{ color: '#1c7ed6', weight: 3, dashArray: '2 8', lineCap: 'round', opacity: 0.8 }}
        />
      )}
      {points.map((p) => (
        <Marker
          key={`${p.kind}-${p.label}`}
          position={[p.latitude, p.longitude]}
          icon={icons.get(`${p.kind}-${p.label}`)}
          zIndexOffset={p.kind === 'driver' ? 1000 : 0}
          keyboard={false}
        >
          <Tooltip direction="top" offset={[0, p.kind === 'driver' ? -18 : -38]}>
            {p.label}
          </Tooltip>
        </Marker>
      ))}
      <FitTo points={points} />
    </MapContainer>
  )
}

/** Keeps every point (and the customer's area) in view as they move. */
function FitTo({ points }: { points: MapPoint[] }) {
  const map = useMap()
  const key = points.map((p) => `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`).join('|')
  useEffect(() => {
    const corners: Array<[number, number]> = []
    for (const p of points) {
      corners.push([p.latitude, p.longitude])
      if (p.areaRadiusM) {
        // The circle's north and south edges (1° of latitude ≈ 111 km)
        const d = p.areaRadiusM / 111_000
        corners.push([p.latitude + d, p.longitude], [p.latitude - d, p.longitude])
      }
    }
    if (corners.length === 1) {
      map.setView(corners[0], 15)
    } else if (corners.length > 1) {
      map.fitBounds(latLngBounds(corners), { padding: [40, 40], maxZoom: 16 })
    }
    // Only when a point moves, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}
