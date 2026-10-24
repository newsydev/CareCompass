import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { TriagePage } from './pages/TriagePage'
import { ProfilePage } from './pages/ProfilePage'
import { AppHeader } from './components/AppHeader'
import { DemoSessionProvider } from './components/DemoSessionProvider'
import { useDemoSession } from './hooks/useDemoSession'

function AppRoutes() {
  const { profile, activeChatId, loading } = useDemoSession()
  if (loading) return <main className="p-8" role="status">Loading your account...</main>
  return (
    <>
      <AppHeader />
      <main className="h-dvh overflow-hidden pt-16">
        <Routes>
          <Route path="/" element={<Navigate to={profile ? '/triage' : '/login'} replace />} />
          <Route path="/login" element={profile ? <Navigate to="/triage" replace /> : <LoginPage />} />
          <Route path="/signup" element={profile ? <Navigate to="/triage" replace /> : <SignupPage />} />
          <Route path="/triage" element={profile ? <TriagePage key={activeChatId} profile={profile} /> : <Navigate to="/login" replace />} />
          <Route path="/profile" element={profile ? <ProfilePage profile={profile} /> : <Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  )
}

function App() {
  return <DemoSessionProvider><AppRoutes /></DemoSessionProvider>
}

export default App
