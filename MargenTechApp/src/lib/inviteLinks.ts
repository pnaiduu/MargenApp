import Constants from 'expo-constants'

export function customerRateUrl(token: string) {
  const base = (
    process.env.EXPO_PUBLIC_CUSTOMER_RATE_BASE_URL ??
    (Constants.expoConfig?.extra?.customerRateBaseUrl as string | undefined) ??
    ''
  ).replace(/\/$/, '')
  if (!base) return `https://trymargen.com/rate?token=${encodeURIComponent(token)}`
  return `${base}/rate?token=${encodeURIComponent(token)}`
}
