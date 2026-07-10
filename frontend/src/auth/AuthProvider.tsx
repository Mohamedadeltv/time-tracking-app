import { useEffect, useState, type ReactNode } from 'react'
import * as authApi from '../api/auth'
import type { User } from '../api/auth'
import { AuthContext } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function register(email: string, password: string) {
    const registeredUser = await authApi.register(email, password)
    setUser(registeredUser)
  }

  async function login(email: string, password: string) {
    const loggedInUser = await authApi.login(email, password)
    setUser(loggedInUser)
  }

  async function logout() {
    await authApi.logout()
    setUser(null)
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    await authApi.changePassword(currentPassword, newPassword)
  }

  async function setTimezone(timezone: string) {
    const updated = await authApi.setTimezone(timezone)
    setUser(updated)
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, register, login, logout, changePassword, setTimezone }}
    >
      {children}
    </AuthContext.Provider>
  )
}
