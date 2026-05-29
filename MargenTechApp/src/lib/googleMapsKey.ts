import Constants from 'expo-constants'

/** Google Maps API key — set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in MargenTechApp/.env */
export function googleMapsApiKey(): string {
  const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
  if (fromEnv?.trim()) return fromEnv.trim()
  const extra = Constants.expoConfig?.extra as { googleMapsApiKey?: string } | undefined
  return extra?.googleMapsApiKey?.trim() ?? ''
}
