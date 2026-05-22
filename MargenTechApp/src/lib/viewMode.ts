import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'margen_app_view_mode'

export type AppViewMode = 'technician' | 'owner_demo'

export async function setAppViewMode(mode: AppViewMode): Promise<void> {
  await AsyncStorage.setItem(KEY, mode)
}

export async function getAppViewMode(): Promise<AppViewMode | null> {
  const v = await AsyncStorage.getItem(KEY)
  if (v === 'technician' || v === 'owner_demo') return v
  return null
}

export async function clearAppViewMode(): Promise<void> {
  await AsyncStorage.removeItem(KEY)
}
