/** Haversine distance in miles */
export function distanceMiles(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 3958.8
  const toRad = (n: number) => (n * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const s1 = Math.sin(dLat / 2)
  const s2 = Math.sin(dLng / 2)
  const aa = s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2
  return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
}

export function formatMiles(mi: number | null): string {
  if (mi == null || !Number.isFinite(mi)) return '—'
  return `${mi.toFixed(1)} mi`
}

export type LatLng = { latitude: number; longitude: number }

export async function fetchDirectionsPolyline(
  origin: LatLng,
  destination: LatLng,
  apiKey: string,
): Promise<{ points: LatLng[]; durationText: string | null } | null> {
  const url =
    `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}` +
    `&destination=${destination.latitude},${destination.longitude}&mode=driving&key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = (await res.json()) as {
    routes?: { legs?: { duration?: { text?: string } }[]; overview_polyline?: { points?: string } }[]
  }
  const route = data.routes?.[0]
  const encoded = route?.overview_polyline?.points
  if (!encoded) return { points: [origin, destination], durationText: route?.legs?.[0]?.duration?.text ?? null }
  return {
    points: decodePolyline(encoded),
    durationText: route?.legs?.[0]?.duration?.text ?? null,
  }
}

/** Google encoded polyline decode */
function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = []
  let index = 0
  let lat = 0
  let lng = 0
  while (index < encoded.length) {
    let b = 0
    let shift = 0
    let result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lat += (result & 1) !== 0 ? ~(result >> 1) : result >> 1
    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lng += (result & 1) !== 0 ? ~(result >> 1) : result >> 1
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 })
  }
  return points
}
