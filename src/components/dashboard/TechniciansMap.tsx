import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api'
import { useMemo } from 'react'

export type TechMapPoint = {
  id: string
  name: string
  map_color: string | null
  last_lat: number | null
  last_lng: number | null
  is_emergency_assignee?: boolean
}

function normalizeHex(hex: string | null | undefined) {
  if (!hex) return '#6b7280'
  const h = hex.trim()
  if (/^#[0-9A-Fa-f]{6}$/i.test(h)) return h
  if (/^#[0-9A-Fa-f]{3}$/i.test(h)) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`
  }
  return '#6b7280'
}

function markerIconUrl(hex: string | null | undefined) {
  const safe = normalizeHex(hex)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="9" fill="${safe}" stroke="#ffffff" stroke-width="3"/></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function emergencyMarkerIconUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34"><circle cx="17" cy="17" r="11" fill="#dc2626" stroke="#ffffff" stroke-width="4"/></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const defaultCenter = { lat: 39.8283, lng: -98.5795 }
const containerStyle = { width: '100%', height: '320px' }

function NoKeyPlaceholder() {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-[#ebebeb] bg-white px-4 text-center text-sm text-[#888888]">
      Add <code className="mx-1 rounded border border-[var(--color-margen-border)] px-1 py-0.5 font-mono text-xs">VITE_GOOGLE_MAPS_API_KEY</code> to your{' '}
      <code className="mx-1 rounded border border-[var(--color-margen-border)] px-1 py-0.5 font-mono text-xs">.env</code> to show the live map.
    </div>
  )
}

function TechniciansMapWithLoader({ technicians, apiKey }: { technicians: TechMapPoint[]; apiKey: string }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'margen-google-maps',
    googleMapsApiKey: apiKey,
    libraries: ['places', 'geometry'],
  })

  const withCoords = useMemo(
    () =>
      technicians.filter((t) => t.last_lat != null && t.last_lng != null) as (TechMapPoint & {
        last_lat: number
        last_lng: number
      })[],
    [technicians],
  )

  const center = useMemo(() => {
    if (withCoords.length === 0) return defaultCenter
    const lat = withCoords.reduce((a, t) => a + t.last_lat, 0) / withCoords.length
    const lng = withCoords.reduce((a, t) => a + t.last_lng, 0) / withCoords.length
    return { lat, lng }
  }, [withCoords])

  if (loadError) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-[#ebebeb] bg-white px-4 text-center text-sm text-danger">
        Could not load Google Maps.
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-[#ebebeb] bg-white text-sm text-[#888888]">
        Loading map…
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#ebebeb]">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={withCoords.length ? 11 : 4}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        }}
      >
        {withCoords.map((t) => (
          <Marker
            key={t.id}
            position={{ lat: t.last_lat, lng: t.last_lng }}
            title={t.name}
            icon={{
              url: t.is_emergency_assignee ? emergencyMarkerIconUrl() : markerIconUrl(t.map_color),
              scaledSize: t.is_emergency_assignee ? new google.maps.Size(34, 34) : new google.maps.Size(28, 28),
              anchor: t.is_emergency_assignee ? new google.maps.Point(17, 17) : new google.maps.Point(14, 14),
            }}
          />
        ))}
      </GoogleMap>
    </div>
  )
}

export function TechniciansMap({ technicians }: { technicians: TechMapPoint[] }) {
  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim()
  if (!apiKey) {
    return <NoKeyPlaceholder />
  }
  return <TechniciansMapWithLoader technicians={technicians} apiKey={apiKey} />
}
