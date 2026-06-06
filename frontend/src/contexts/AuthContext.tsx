import React, { createContext, useContext, useState, useEffect } from 'react'
import { AuthUser, getMe } from '../api/auth'

interface AuthContextValue {
  token: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  login: (token: string, user: AuthUser) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('auth_token'))
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    if (token && !user) {
      getMe().then(setUser).catch(() => {
        setToken(null)
        localStorage.removeItem('auth_token')
      })
    }
  }, [token])

  const login = (newToken: string, newUser: AuthUser) => {
    localStorage.setItem('auth_token', newToken)
    setToken(newToken)
    setUser(newUser)
  }

  const logout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('current_project')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
