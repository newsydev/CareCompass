import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { HomePage } from './pages/HomePage'
import { TriagePage } from './pages/TriagePage'
import { ConsultPage } from './pages/ConsultPage'
import { VoiceConsultPage } from './pages/VoiceConsultPage'
import { PartnersPage } from './pages/PartnersPage'
import { ProfilePage } from './pages/ProfilePage'
import { AppHeader } from './components/AppHeader'
import { BottomNav } from './components/BottomNav'
import { DemoSessionProvider } from './components/DemoSessionProvider'
import { TutorialProvider } from './components/tutorial/TutorialProvider'
import { useDemoSession } from './hooks/useDemoSession'

function AppRoutes() {
  const { profile, activeChatId, loading } = useDemoSession()
  const { pathname } = useLocation()
  if (loading) return <main className="p-8" role="status">Loading your account...</main>

  const routes = (
    <Routes>
      <Route path="/" element={<Navigate to={profile ? '/home' : '/login'} replace />} />
      <Route path="/login" element={profile ? <Navigate to="/home" replace /> : <LoginPage />} />
      <Route path="/signup" element={profile ? <Navigate to="/home" replace /> : <SignupPage />} />
      <Route path="/home" element={profile ? <HomePage profile={profile} /> : <Navigate to="/login" replace />} />
      <Route path="/consult" element={profile ? <ConsultPage /> : <Navigate to="/login" replace />} />
      <Route path="/consult/voice" element={profile ? <VoiceConsultPage /> : <Navigate to="/login" replace />} />
      <Route path="/triage" element={profile ? <TriagePage key={activeChatId} profile={profile} /> : <Navigate to="/login" replace />} />
      <Route path="/partners" element={profile ? <PartnersPage /> : <Navigate to="/login" replace />} />
      <Route path="/profile" element={profile ? <ProfilePage profile={profile} /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )

  if (!profile) {
    return (
      <>
        <AppHeader />
        <main className="h-dvh overflow-hidden pt-16">{routes}</main>
      </>
    )
  }

  // Signed-in app: a phone-width column (centred on larger screens) with a bottom nav.
  // The transform makes the nav and header position against this column instead of the window.
  // The chat and the voice consultation take the whole screen, without the bottom navigation.
  const immersive = pathname.startsWith('/triage') || pathname.startsWith('/consult/voice')
  return (
    <div className="min-h-dvh bg-gray-100">
      <div className="relative mx-auto h-dvh w-full max-w-[480px] transform-gpu overflow-hidden bg-white shadow-xl">
        <TutorialProvider>
          <main className={`h-full overflow-hidden ${immersive ? '' : 'pb-[calc(4rem+env(safe-area-inset-bottom))]'}`}>{routes}</main>
          {!immersive && <BottomNav />}
        </TutorialProvider>
      </div>
    </div>
  )
}

function App() {
  return <DemoSessionProvider><AppRoutes /></DemoSessionProvider>
}

export default App
