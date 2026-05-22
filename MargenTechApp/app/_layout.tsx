import { Stack } from 'expo-router'
import { AppProviders } from '../src/providers/AppProviders'

export default function RootLayout() {
  return (
    <AppProviders>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: '#FAFAF8' },
        }}
      />
    </AppProviders>
  )
}
