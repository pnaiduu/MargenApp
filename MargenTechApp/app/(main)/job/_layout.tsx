import { Stack } from 'expo-router'

export default function JobStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTintColor: '#111111',
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        contentStyle: { backgroundColor: '#FAFAF8' },
      }}
    >
      <Stack.Screen name="[id]" options={{ title: 'Job' }} />
    </Stack>
  )
}
