import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ProtectedRoute } from './ProtectedRoute'
import { AuthProvider } from '../auth/AuthProvider'
import * as authApi from '../api/auth'

vi.mock('../api/auth')

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<p>login page</p>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<p>secret dashboard</p>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  it('redirects to /login when there is no authenticated user', async () => {
    vi.mocked(authApi.me).mockRejectedValue(new Error('401'))

    renderProtected()

    await waitFor(() => expect(screen.getByText('login page')).toBeInTheDocument())
  })

  it('renders the protected content when a user is authenticated', async () => {
    vi.mocked(authApi.me).mockResolvedValue({ id: 1, email: 'a@example.com' })

    renderProtected()

    await waitFor(() => expect(screen.getByText('secret dashboard')).toBeInTheDocument())
  })
})
