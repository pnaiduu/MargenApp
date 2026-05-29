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
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="technician-login" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="owner-login" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="signup" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="link-invite" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="join/[token]" options={{ animation: 'fade' }} />
      </Stack>
    </AppProviders>
  )
}
