import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'

import Login        from './pages/Login'
import Onboarding   from './pages/Onboarding'
import ResetPassword from './pages/ResetPassword'
import Dashboard    from './pages/Dashboard'
import Lire         from './pages/Lire'

import Module1_Profils     from './pages/Module1_Profils'
import Module2_Adapter     from './pages/Module2_Adapter'
import Module3_Sequence    from './pages/Module3_Sequence'
import Module4_Bibliotheque from './pages/Module4_Bibliotheque'
import Module5_Progression from './pages/Module5_Progression'
import References          from './pages/References'

function AppRoutes() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50">
        <div className="text-center">
          <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-3 animate-pulse">
            <span className="text-white text-lg font-bold">DA</span>
          </div>
          <p className="text-brand-700 text-sm">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login"          element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/lire"           element={<Lire />} />
        <Route path="*"               element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  if (!profile) {
    return (
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="*"           element={<Navigate to="/onboarding" replace />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/"             element={<Navigate to="/dashboard" replace />} />
        <Route path="/login"        element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard"    element={<Dashboard />} />
        <Route path="/profils"      element={<Module1_Profils />} />
        <Route path="/adapter"      element={<Module2_Adapter />} />
        <Route path="/sequence"     element={<Module3_Sequence />} />
        <Route path="/bibliotheque" element={<Module4_Bibliotheque />} />
        <Route path="/progression"  element={<Module5_Progression />} />
        <Route path="/references"   element={<References />} />
        <Route path="/lire"         element={<Lire />} />
        <Route path="*"             element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
