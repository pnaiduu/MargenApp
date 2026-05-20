import { Stack } from 'expo-router'

export default function MainLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FAFAF8' },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="job"
        options={{
          animation: 'slide_from_right',
          presentation: 'card',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="rating"
        options={{
          presentation: 'fullScreenModal',
          animation: 'slide_from_bottom',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="location-history"
        options={{
          headerShown: true,
          title: 'Location history',
          headerTintColor: '#111111',
          headerStyle: { backgroundColor: '#FFFFFF' },
        }}
      />
      <Stack.Screen
        name="privacy"
        options={{
          headerShown: true,
          title: 'Privacy',
          headerTintColor: '#111111',
          headerStyle: { backgroundColor: '#FFFFFF' },
        }}
      />
    </Stack>
  )
}
