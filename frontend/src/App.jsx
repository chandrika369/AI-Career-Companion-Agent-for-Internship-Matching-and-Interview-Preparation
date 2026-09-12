import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

import Login        from './pages/Login'
import Register     from './pages/Register'
import Profile      from './pages/Profile'
import Resumes      from './pages/Resumes'
import Internships  from './pages/Internships'
import CoverLetter  from './pages/CoverLetter'
import Applications from './pages/Applications'
import Chat         from './pages/Chat'

/* Spinner shown while token is being validated */
function Loader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )
}

/* Guard — redirects to /login if not authenticated */
function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loader />
  return user ? children : <Navigate to="/login" replace />
}

/* Guard — redirects to /internships if already logged in */
function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Loader />
  return user ? <Navigate to="/internships" replace /> : children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

      {/* Private */}
      <Route path="/profile"      element={<PrivateRoute><Profile /></PrivateRoute>} />
      <Route path="/resumes"      element={<PrivateRoute><Resumes /></PrivateRoute>} />
      <Route path="/internships"  element={<PrivateRoute><Internships /></PrivateRoute>} />
      <Route path="/cover-letter" element={<PrivateRoute><CoverLetter /></PrivateRoute>} />
      <Route path="/applications" element={<PrivateRoute><Applications /></PrivateRoute>} />
      <Route path="/chat"         element={<PrivateRoute><Chat /></PrivateRoute>} />

      {/* Default */}
      <Route path="/" element={<Navigate to="/internships" replace />} />
      <Route path="*" element={<Navigate to="/internships" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        {/* Global CSS animation keyframes injected once */}
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          select option { background: #1a1d27; color: #e2e8f0; }
          input:focus, textarea:focus, select:focus {
            border-color: var(--accent) !important;
            box-shadow: 0 0 0 3px rgba(124,111,247,0.15);
          }
          button:hover:not(:disabled) { filter: brightness(1.08); }
        `}</style>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
