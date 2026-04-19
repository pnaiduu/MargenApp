import { Autocomplete, Circle, GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api'
import { motion, AnimatePresence } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { easePremium } from '../../lib/motion'

const MILES_TO_METERS = 1609.344
const PRESETS = [15, 25, 50, 100] as const
const US_CENTER = { lat: 39.8283, lng: -98.5795 }
const MAP_CONTAINER = { width: '100%', height: 'min(420px, 55vh)' }

export type ServiceAreaSnapshot = {
  business_address: string | null
  business_lat: number | null
  business_lng: number | null
  service_radius_miles: number | null
  covered_cities: string[]
}

export type ServiceAreaInitial = {
  address: string | null
  lat: number | null
  lng: number | null
  radiusMiles: number | null
  cities: string[]
}

function clampRadiusMiles(mi: number): number {
  if (!Number.isFinite(mi)) return 25
  return Math.min(120, Math.max(3, mi))
}

function milesToMeters(mi: number): number {
  return mi * MILES_TO_METERS
}

function metersToMiles(m: number): number {
  return m / MILES_TO_METERS
}

export function parseCoveredCities(raw: unknown): string[] {
  if (!raw) return []
  if (!Array.isArray(raw)) return []
  return raw
    .map((x) => {
      if (typeof x === 'string') return x.trim()
      if (x && typeof x === 'object' && 'name' in x && typeof (x as { name: unknown }).name === 'string') {
        return (x as { name: string }).name.trim()
      }
      return ''
    })
    .filter(Boolean)
}

function extractLocality(components: google.maps.GeocoderAddressComponent[]): string | null {
  const rank = ['locality', 'sublocality_level_1', 'neighborhood', 'administrative_area_level_3']
  for (const t of rank) {
    const c = components.find((x) => x.types.includes(t))
    if (c?.long_name) return c.long_name
  }
  const adm2 = components.find((x) => x.types.includes('administrative_area_level_2'))
  if (adm2?.long_name) return adm2.long_name
  return null
}

function geocodeReverse(
  geocoder: google.maps.Geocoder,
  loc: google.maps.LatLngLiteral,
): Promise<string | null> {
  return new Promise((resolve) => {
    geocoder.geocode({ location: loc }, (results, status) => {
      if (status !== 'OK' || !results?.[0]) {
        resolve(null)
        return
      }
      resolve(extractLocality(results[0].address_components))
    })
  })
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function collectLocalitiesInRadius(
  center: google.maps.LatLngLiteral,
  radiusMiles: number,
  geocoder: google.maps.Geocoder,
): Promise<string[]> {
  const centerLL = new google.maps.LatLng(center.lat, center.lng)
  const names = new Set<string>()
  const headings = [0, 45, 90, 135, 180, 225, 270, 315]
  const fractions = [0.28, 0.52, 0.78]
  const radiusM = milesToMeters(radiusMiles)
  const points: google.maps.LatLngLiteral[] = []
  for (const frac of fractions) {
    const dist = radiusM * frac
    for (const h of headings) {
      const p = google.maps.geometry.spherical.computeOffset(centerLL, dist, h)
      points.push({ lat: p.lat(), lng: p.lng() })
    }
  }
  for (const p of points) {
    const name = await geocodeReverse(geocoder, p)
    if (name) names.add(name)
    await delay(110)
  }
  const centerName = await geocodeReverse(geocoder, center)
  if (centerName) names.add(centerName)
  return [...names].sort((a, b) => a.localeCompare(b))
}

function areaSqMiles(radiusMiles: number): number {
  return Math.PI * radiusMiles * radiusMiles
}

function approxPopulationServed(radiusMiles: number): number {
  // Typical suburban US mix (~90–120 people / mi²); single rounded figure for UX
  return Math.round(areaSqMiles(radiusMiles) * 105)
}

function presetMatch(radiusMiles: number): (typeof PRESETS)[number] | null {
  for (const p of PRESETS) {
    if (Math.abs(radiusMiles - p) < 0.65) return p
  }
  return null
}

function NoKeyPlaceholder() {
  return (
    <div className="rounded-xl border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-10 text-center text-sm text-[var(--color-margen-muted)]">
      Add{' '}
      <code className="mx-1 rounded border border-[var(--color-margen-border)] px-1.5 py-0.5 font-mono text-xs">
        VITE_GOOGLE_MAPS_API_KEY
      </code>{' '}
      with Places and Geocoding enabled to configure your service area on the map.
    </div>
  )
}

type InnerProps = {
  apiKey: string
  resetToken: number
  initial: ServiceAreaInitial | null
  onChange: (s: ServiceAreaSnapshot) => void
}

function ServiceAreaMapInner({ apiKey, resetToken, initial, onChange }: InnerProps) {
  const acInstanceRef = useRef<google.maps.places.Autocomplete | null>(null)

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'margen-google-maps',
    googleMapsApiKey: apiKey,
    libraries: ['places', 'geometry'],
  })

  const [address, setAddress] = useState('')
  const [center, setCenter] = useState<google.maps.LatLngLiteral | null>(null)
  const [radiusMiles, setRadiusMiles] = useState(25)
  const [cities, setCities] = useState<string[]>([])
  const [citiesLoading, setCitiesLoading] = useState(false)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const circleRef = useRef<google.maps.Circle | null>(null)
  const lockedCenterRef = useRef<google.maps.LatLngLiteral | null>(null)

  const geocoder = useMemo(() => (isLoaded ? new google.maps.Geocoder() : null), [isLoaded])

  useEffect(() => {
    if (!initial) return
    setAddress(initial.address?.trim() ?? '')
    const lat = initial.lat
    const lng = initial.lng
    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      const c = { lat, lng }
      setCenter(c)
      lockedCenterRef.current = c
    } else {
      setCenter(null)
      lockedCenterRef.current = null
    }
    setRadiusMiles(clampRadiusMiles(initial.radiusMiles ?? 25))
    setCities(initial.cities ?? [])
  }, [resetToken, initial])

  useEffect(() => {
    onChange({
      business_address: address.trim() || null,
      business_lat: center?.lat ?? null,
      business_lng: center?.lng ?? null,
      service_radius_miles: center ? clampRadiusMiles(radiusMiles) : null,
      covered_cities: cities,
    })
  }, [address, center, radiusMiles, cities, onChange])

  const fitMapToCircle = useCallback(
    (c: google.maps.LatLngLiteral, rMi: number) => {
      if (!map || !isLoaded) return
      const circle = new google.maps.Circle({ center: c, radius: milesToMeters(rMi) })
      const b = circle.getBounds()
      circle.setMap(null)
      if (b) {
        map.fitBounds(b, 48)
      }
    },
    [map, isLoaded],
  )

  useEffect(() => {
    if (map && center) {
      fitMapToCircle(center, clampRadiusMiles(radiusMiles))
    }
  }, [map, center?.lat, center?.lng, resetToken, fitMapToCircle])

  useEffect(() => {
    if (!isLoaded || !geocoder || !center) {
      return
    }
    let alive = true
    const t = window.setTimeout(() => {
      void (async () => {
        setCitiesLoading(true)
        try {
          const next = await collectLocalitiesInRadius(center, clampRadiusMiles(radiusMiles), geocoder)
          if (alive) setCities(next)
        } finally {
          if (alive) setCitiesLoading(false)
        }
      })()
    }, 520)
    return () => {
      window.clearTimeout(t)
      alive = false
    }
  }, [isLoaded, geocoder, center?.lat, center?.lng, radiusMiles, center])

  const onPlaceChanged = useCallback(() => {
    const ac = acInstanceRef.current
    if (!ac) return
    const place = ac.getPlace()
    const loc = place.geometry?.location
    if (!loc) return
    const c = { lat: loc.lat(), lng: loc.lng() }
    const formatted = place.formatted_address ?? place.name ?? ''
    setAddress(formatted)
    setCenter(c)
    lockedCenterRef.current = c
    if (map) {
      map.panTo(c)
      map.setZoom(11)
    }
  }, [map])

  const onAutocompleteLoad = useCallback((ac: google.maps.places.Autocomplete) => {
    acInstanceRef.current = ac
  }, [])

  const handlePreset = (mi: number) => {
    setRadiusMiles(mi)
    circleRef.current?.setRadius(milesToMeters(mi))
    if (center && map) fitMapToCircle(center, mi)
  }

  const onCircleLoad = useCallback((c: google.maps.Circle) => {
    circleRef.current = c
  }, [])

  const onCircleRadiusChanged = useCallback(() => {
    const c = circleRef.current
    if (!c) return
    setRadiusMiles(clampRadiusMiles(metersToMiles(c.getRadius())))
  }, [])

  const onCircleCenterChanged = useCallback(() => {
    const c = circleRef.current
    const lock = lockedCenterRef.current
    if (!c || !lock) return
    const nc = c.getCenter()
    if (!nc) return
    const dlat = Math.abs(nc.lat() - lock.lat)
    const dlng = Math.abs(nc.lng() - lock.lng)
    if (dlat > 1e-7 || dlng > 1e-7) {
      c.setCenter(lock)
    }
  }, [])

  const activePreset = presetMatch(radiusMiles)
  const sqMi = areaSqMiles(radiusMiles)
  const approxPop = approxPopulationServed(radiusMiles)

  if (loadError) {
    return (
      <div className="rounded-xl border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-4 py-8 text-center text-sm text-danger">
        Google Maps failed to load. Check your API key and enabled APIs (Maps JavaScript, Places, Geocoding).
      </div>
    )
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] text-sm text-[var(--color-margen-muted)]">
        Loading maps…
      </div>
    )
  }

  const mapCenter = center ?? US_CENTER
  const mapZoom = center ? 10 : 4

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-medium uppercase tracking-wide text-[var(--color-margen-muted)]">
          Where is your business located?
        </label>
        <Autocomplete
          onLoad={onAutocompleteLoad}
          onPlaceChanged={onPlaceChanged}
          options={{ fields: ['geometry', 'formatted_address', 'name'] }}
        >
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Start typing an address or city…"
            className="mt-2 w-full rounded-lg border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] px-3 py-2.5 text-sm text-[var(--color-margen-text)] outline-none transition-shadow focus:border-[var(--margen-accent)] focus:ring-2 focus:ring-[var(--margen-accent-muted)]"
            autoComplete="off"
          />
        </Autocomplete>
        <p className="mt-1.5 text-xs text-[var(--color-margen-muted)]">
          Choose a suggestion to drop your pin and center the map.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-margen-border)] shadow-sm">
        <GoogleMap
          mapContainerStyle={MAP_CONTAINER}
          center={mapCenter}
          zoom={mapZoom}
          onLoad={(m) => setMap(m)}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            gestureHandling: 'greedy',
          }}
        >
          {center ? (
            <>
              <Marker position={center} title="Your business" />
              <Circle
                center={center}
                radius={milesToMeters(clampRadiusMiles(radiusMiles))}
                onLoad={onCircleLoad}
                onRadiusChanged={onCircleRadiusChanged}
                onCenterChanged={onCircleCenterChanged}
                options={{
                  strokeColor: '#111827',
                  strokeOpacity: 0.95,
                  strokeWeight: 2,
                  fillColor: '#111827',
                  fillOpacity: 0.14,
                  clickable: true,
                  draggable: false,
                  editable: true,
                  zIndex: 1,
                }}
              />
            </>
          ) : null}
        </GoogleMap>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-margen-border)] bg-[var(--color-margen-surface)] px-3 py-2.5">
          <AnimatePresence mode="wait">
            <motion.span
              key={Math.round(radiusMiles * 10)}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: easePremium }}
              className="text-sm font-semibold tabular-nums text-[var(--color-margen-text)]"
            >
              ~{radiusMiles.toFixed(radiusMiles >= 10 ? 0 : 1)} mile radius
            </motion.span>
          </AnimatePresence>
          <span className="text-xs text-[var(--color-margen-muted)]">Drag the circle edge to fine-tune</span>
        </div>
      </div>

      {center ? (
        <div className="rounded-xl border border-[#ebebeb] bg-[#fafafa] px-4 py-3.5">
          <p className="text-xs font-medium uppercase tracking-wide text-[#888888]">Places covered</p>
          <p className="mt-2 text-sm leading-relaxed text-[#111111]">
            {citiesLoading ? (
              <span className="text-[#888888]">Updating places…</span>
            ) : cities.length ? (
              cities.join(', ')
            ) : (
              <span className="text-[#888888]">Places will appear here as we scan your radius.</span>
            )}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((mi) => {
          const active = activePreset === mi
          return (
            <button
              key={mi}
              type="button"
              disabled={!center}
              onClick={() => handlePreset(mi)}
              className={[
                'rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-150',
                active
                  ? 'bg-[var(--margen-accent)] text-white shadow-md ring-2 ring-[var(--margen-accent-muted)] ring-offset-2 ring-offset-[var(--color-margen-surface-elevated)]'
                  : 'border border-[var(--color-margen-border)] bg-[var(--color-margen-surface-elevated)] text-[var(--color-margen-text)] hover:border-[var(--margen-accent)] hover:bg-[var(--margen-accent-muted)] hover:text-[var(--margen-accent)]',
                !center ? 'pointer-events-none opacity-40' : '',
              ].join(' ')}
            >
              {mi} mi
            </button>
          )
        })}
      </div>

      {center ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: easePremium }}
          className="rounded-xl border border-[#ebebeb] bg-white p-5 shadow-sm"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-[#888888]">Coverage summary</p>
          <dl className="mt-4 grid gap-5 sm:grid-cols-3 sm:gap-6">
            <div className="min-w-0">
              <dt className="text-[13px] leading-snug text-[#555555]">Area (approx.)</dt>
              <dd className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-[#111111]">
                {sqMi.toLocaleString(undefined, { maximumFractionDigits: 0 })} mi²
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[13px] leading-snug text-[#555555]">Population served (est.)</dt>
              <dd className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-[#111111]">
                ~{approxPop.toLocaleString()}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[13px] leading-snug text-[#555555]">Places named</dt>
              <dd className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-[#111111]">{cities.length}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-[#888888]">
            Population is a rough density estimate for planning—not a census count. Places are sampled across your circle using Google Geocoding.
          </p>
        </motion.div>
      ) : null}
    </div>
  )
}

type Props = {
  resetToken: number
  initial: ServiceAreaInitial | null
  onChange: (s: ServiceAreaSnapshot) => void
}

export function ServiceAreaEditor({ resetToken, initial, onChange }: Props) {
  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim()
  if (!apiKey) {
    return <NoKeyPlaceholder />
  }
  return <ServiceAreaMapInner apiKey={apiKey} resetToken={resetToken} initial={initial} onChange={onChange} />
}
