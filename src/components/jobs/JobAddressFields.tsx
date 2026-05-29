import { Autocomplete, GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api'
import { useCallback, useMemo, useRef, useState } from 'react'

const MAP_CONTAINER = { width: '100%', height: '160px' }
const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 }

export type JobAddressValue = {
  address: string
  lat: number | null
  lng: number | null
}

type Props = {
  value: JobAddressValue
  onChange: (v: JobAddressValue) => void
  /** Optional technician location for distance label */
  techLat?: number | null
  techLng?: number | null
}

function haversineMiles(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 3958.8
  const toRad = (n: number) => (n * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const aa = s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2
  return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
}

export function JobAddressFields({ value, onChange, techLat, techLng }: Props) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey ?? '',
    libraries: ['places'],
  })
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [input, setInput] = useState(value.address)

  const onPlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace()
    const loc = place?.geometry?.location
    const addr = place?.formatted_address ?? input
    if (!loc) {
      onChange({ address: addr, lat: null, lng: null })
      return
    }
    const lat = loc.lat()
    const lng = loc.lng()
    setInput(addr)
    onChange({ address: addr, lat, lng })
  }, [input, onChange])

  const mapCenter = useMemo(() => {
    if (value.lat != null && value.lng != null) return { lat: value.lat, lng: value.lng }
    return DEFAULT_CENTER
  }, [value.lat, value.lng])

  const distanceLabel = useMemo(() => {
    if (value.lat == null || value.lng == null || techLat == null || techLng == null) return null
    const mi = haversineMiles(techLat, techLng, value.lat, value.lng)
    return `${mi.toFixed(1)} mi from assigned technician`
  }, [value.lat, value.lng, techLat, techLng])

  if (!apiKey) {
    return (
      <p className="text-sm text-[var(--color-margen-muted)]">
        Add VITE_GOOGLE_MAPS_API_KEY to enable address search.
      </p>
    )
  }

  if (loadError) {
    return <p className="text-sm text-danger">Could not load Google Maps.</p>
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-[var(--color-margen-muted)]" htmlFor="job-address">
        Job address
      </label>
      {isLoaded ? (
        <Autocomplete
          onLoad={(ac) => {
            autocompleteRef.current = ac
          }}
          onPlaceChanged={onPlaceChanged}
        >
          <input
            id="job-address"
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              onChange({ address: e.target.value, lat: value.lat, lng: value.lng })
            }}
            placeholder="Search address…"
            className="w-full rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2.5 text-sm text-[var(--color-margen-text)] outline-none focus:border-[var(--margen-accent)]"
          />
        </Autocomplete>
      ) : (
        <div className="h-10 animate-pulse rounded-lg bg-[var(--color-margen-hover)]" />
      )}
      {distanceLabel ? <p className="text-xs text-[var(--color-margen-muted)]">{distanceLabel}</p> : null}
      {value.lat != null && value.lng != null && isLoaded ? (
        <div className="overflow-hidden rounded-lg border border-[var(--color-margen-border)]">
          <GoogleMap mapContainerStyle={MAP_CONTAINER} center={mapCenter} zoom={14} options={{ disableDefaultUI: true }}>
            <Marker position={{ lat: value.lat, lng: value.lng }} />
          </GoogleMap>
        </div>
      ) : null}
    </div>
  )
}
