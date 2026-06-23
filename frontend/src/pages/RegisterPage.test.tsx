import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RegisterPage } from './RegisterPage'
import { AuthProvider } from '../auth/AuthProvider'
import { ApiError } from '../api/client'
import * as authApi from '../api/auth'

vi.mock('../api/auth')

function renderRegisterPage() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <AuthProvider>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<p>dashboard</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(authApi.me).mockRejectedValue(new Error('401'))
  })

  it('registers and navigates to the dashboard on success', async () => {
    vi.mocked(authApi.register).mockResolvedValue({ id: 1, email: 'a@example.com' })
    const user = userEvent.setup()
    renderRegisterPage()

    await user.type(screen.getByLabelText('Email'), 'a@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Register' }))

    await waitFor(() => expect(screen.getByText('dashboard')).toBeInTheDocument())
    expect(authApi.register).toHaveBeenCalledWith('a@example.com', 'password123')
  })

  it('shows field errors reported by the server', async () => {
    vi.mocked(authApi.register).mockRejectedValue(
      new ApiError(400, 'Validation failed', { password: 'size must be between 8 and 72' }),
    )
    const user = userEvent.setup()
    renderRegisterPage()

    await user.type(screen.getByLabelText('Email'), 'a@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Register' }))

    await waitFor(() =>
      expect(screen.getByText('size must be between 8 and 72')).toBeInTheDocument(),
    )
  })

  it('shows a conflict error for a duplicate email', async () => {
    vi.mocked(authApi.register).mockRejectedValue(
      new ApiError(409, 'Email already in use: a@example.com'),
    )
    const user = userEvent.setup()
    renderRegisterPage()

    await user.type(screen.getByLabelText('Email'), 'a@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.click(screen.getByRole('button', { name: 'Register' }))

    await waitFor(() =>
      expect(screen.getByText('Email already in use: a@example.com')).toBeInTheDocument(),
    )
  })
})
