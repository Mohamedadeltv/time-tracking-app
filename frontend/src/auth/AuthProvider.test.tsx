import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from './AuthProvider'
import { useAuth } from './useAuth'
import * as authApi from '../api/auth'

vi.mock('../api/auth')

function Probe() {
  const { user, loading } = useAuth()
  if (loading) return <p>loading</p>
  return <p>{user ? `logged in as ${user.email}` : 'logged out'}</p>
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hydrates the user from /me on mount when a session exists', async () => {
    vi.mocked(authApi.me).mockResolvedValue({ id: 1, email: 'a@example.com' })

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByText('logged in as a@example.com')).toBeInTheDocument())
  })

  it('treats a failed /me call as logged out', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new Error('401'))

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByText('logged out')).toBeInTheDocument())
  })

  it('login updates the user state', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new Error('401'))
    vi.mocked(authApi.login).mockResolvedValue({ id: 2, email: 'b@example.com' })

    function LoginProbe() {
      const { login, user } = useAuth()
      return (
        <div>
          <button onClick={() => login('b@example.com', 'password123')}>login</button>
          <p>{user ? `logged in as ${user.email}` : 'logged out'}</p>
        </div>
      )
    }

    render(
      <AuthProvider>
        <LoginProbe />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByText('logged out')).toBeInTheDocument())
    await act(async () => {
      screen.getByText('login').click()
    })
    await waitFor(() => expect(screen.getByText('logged in as b@example.com')).toBeInTheDocument())
  })
})
