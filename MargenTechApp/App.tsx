import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './src/context/AuthContext'
import { ClockProvider } from './src/context/ClockContext'
import { NotificationsProvider } from './src/context/NotificationsContext'
import { TechnicianProvider } from './src/context/TechnicianContext'
import { RootNavigator } from './src/navigation/RootNavigator'
import { queryClient } from './src/lib/queryClient'

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TechnicianProvider>
              <ClockProvider>
                <NotificationsProvider>
                  <StatusBar style="light" />
                  <RootNavigator />
                </NotificationsProvider>
              </ClockProvider>
            </TechnicianProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
