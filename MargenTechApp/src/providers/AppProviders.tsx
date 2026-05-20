import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../context/AuthContext'
import { ClockProvider } from '../context/ClockContext'
import { NotificationsProvider } from '../context/NotificationsContext'
import { TechnicianProvider } from '../context/TechnicianContext'
import { ThemeProvider } from '../context/ThemeContext'
import { queryClient } from '../lib/queryClient'
import type { ReactNode } from 'react'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TechnicianProvider>
              <ThemeProvider>
                <ClockProvider>
                  <NotificationsProvider>
                    <StatusBar style="dark" />
                    {children}
                  </NotificationsProvider>
                </ClockProvider>
              </ThemeProvider>
            </TechnicianProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
