import React, { createContext, useContext, useState, useEffect } from 'react'
import { getProfile, login as apiLogin, logout as apiLogout } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      getProfile()
        .then((r) => setUser(r.data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    const res = await apiLogin(email, password)
    localStorage.setItem('token', res.data.access_token)
    const profile = await getProfile()
    setUser(profile.data)
    return profile.data
  }

  const logoutUser = async () => {
    try { await apiLogout() } catch (_) {}
    localStorage.removeItem('token')
    setUser(null)
  }

  const refreshUser = async () => {
    const profile = await getProfile()
    setUser(profile.data)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout: logoutUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
