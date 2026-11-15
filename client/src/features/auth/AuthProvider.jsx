import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('pharmacare.accessToken')))

  const clearSession = useCallback(() => {
    localStorage.removeItem('pharmacare.accessToken')
    setUser(null)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('pharmacare.accessToken')
    if (!token) return
    api.get('/auth/me')
      .then(({ data }) => setUser(data.user))
      .catch(() => clearSession())
      .finally(() => setLoading(false))
  }, [clearSession])

  const login = useCallback(async (credentials) => {
    const { data } = await api.post('/auth/login', credentials)
    localStorage.setItem('pharmacare.accessToken', data.accessToken)
    setUser(data.user)
    return data.user
  }, [])

  const register = useCallback(async (details) => {
    const { data } = await api.post('/auth/register', details)
    localStorage.setItem('pharmacare.accessToken', data.accessToken)
    setUser(data.user)
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      if (localStorage.getItem('pharmacare.accessToken')) await api.post('/auth/logout')
    } finally {
      clearSession()
    }
  }, [clearSession])

  const value = useMemo(() => ({ user, loading, login, register, logout }), [
    user, loading, login, register, logout,
  ])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
