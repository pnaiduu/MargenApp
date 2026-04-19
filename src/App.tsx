import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'

const routerBasename =
  import.meta.env.BASE_URL === '/' || import.meta.env.BASE_URL === '' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '')
import { AuthProvider } from './contexts/AuthProvider'
import { useAuth } from './contexts/useAuth'
import { PreferencesProvider } from './contexts/PreferencesProvider'
import { PageErrorBoundary } from './components/PageErrorBoundary'
import { ProtectedRoute } from './components/ProtectedRoute'
import { SubscriptionAccessRoute } from './components/SubscriptionAccessRoute'
import { AppShell } from './components/layout/AppShell'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { CallsLeadsPage } from './pages/CallsLeadsPage'
import { CustomersPage } from './pages/CustomersPage'
import { CustomerProfilePage } from './pages/CustomerProfilePage'
import { CustomerPaymentConfirmPage } from './pages/CustomerPaymentConfirmPage'
import { CustomerRatePage } from './pages/CustomerRatePage'
import { DashboardHome } from './pages/DashboardHome'
import { HoursAttendancePage } from './pages/HoursAttendancePage'
import { JobsPage } from './pages/JobsPage'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { PricingPage } from './pages/PricingPage'
import { SubscribePage } from './pages/SubscribePage'
import { PaymentsPage } from './pages/PaymentsPage'
import { RevenuePage } from './pages/RevenuePage'
import { SchedulePage } from './pages/SchedulePage'
import { AIReceptionistSettingsPage } from './pages/AIReceptionistSettingsPage'
import { OnboardingCallSetup } from './pages/OnboardingCallSetup'
import { SettingsPage } from './pages/SettingsPage'
import { TechnicianJoinPage } from './pages/TechnicianJoinPage'
import { TechniciansPage } from './pages/TechniciansPage'

function AuthSlowLoginFallback() {
  const { loading, configured } = useAuth()
  const navigate = useNavigate()
  const [pastDeadline, setPastDeadline] = useState(false)

  useEffect(() => {
    if (!configured || !loading) {
      setPastDeadline(false)
      return
    }
    const id = window.setTimeout(() => setPastDeadline(true), 3000)
    return () => window.clearTimeout(id)
  }, [configured, loading])

  useEffect(() => {
    if (configured && loading && pastDeadline) {
      navigate('/login', { replace: true })
    }
  }, [configured, loading, pastDeadline, navigate])

  return null
}

export default function App() {
  return (
    <BrowserRouter basename={routerBasename}>
      <AuthProvider>
        <AuthSlowLoginFallback />
        <PreferencesProvider>
          <Routes>
            <Route path="/" element={<AppShell />}>
              <Route
                index
                element={
                  <PageErrorBoundary>
                    <LandingPage />
                  </PageErrorBoundary>
                }
              />
              <Route
                path="login"
                element={
                  <PageErrorBoundary>
                    <LoginPage />
                  </PageErrorBoundary>
                }
              />
              <Route
                path="signup"
                element={
                  <PageErrorBoundary>
                    <SignupPage />
                  </PageErrorBoundary>
                }
              />
              <Route
                path="pricing"
                element={
                  <PageErrorBoundary>
                    <PricingPage />
                  </PageErrorBoundary>
                }
              />
              <Route
                path="join/:token"
                element={
                  <PageErrorBoundary>
                    <TechnicianJoinPage />
                  </PageErrorBoundary>
                }
              />
              <Route
                path="rate"
                element={
                  <PageErrorBoundary>
                    <CustomerRatePage />
                  </PageErrorBoundary>
                }
              />
              <Route
                path="confirm-payment"
                element={
                  <PageErrorBoundary>
                    <CustomerPaymentConfirmPage />
                  </PageErrorBoundary>
                }
              />
              <Route element={<ProtectedRoute />}>
                <Route element={<SubscriptionAccessRoute />}>
                  <Route
                    path="onboarding/call-setup"
                    element={
                      <PageErrorBoundary>
                        <OnboardingCallSetup />
                      </PageErrorBoundary>
                    }
                  />
                  <Route element={<DashboardLayout />}>
                    <Route path="dashboard" element={<DashboardHome />} />
                    <Route path="jobs" element={<JobsPage />} />
                    <Route path="customers" element={<CustomersPage />} />
                    <Route path="customers/:id" element={<CustomerProfilePage />} />
                    <Route path="technicians" element={<TechniciansPage />} />
                    <Route path="hours" element={<HoursAttendancePage />} />
                    <Route path="schedule" element={<SchedulePage />} />
                    <Route path="calls" element={<CallsLeadsPage />} />
                    <Route path="revenue" element={<RevenuePage />} />
                    <Route path="payments" element={<PaymentsPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="settings/ai-receptionist" element={<AIReceptionistSettingsPage />} />
                    <Route path="subscribe" element={<SubscribePage />} />
                  </Route>
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </PreferencesProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
