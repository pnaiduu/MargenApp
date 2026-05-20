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
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(main)" />
      </Stack>
    </AppProviders>
  )
}
