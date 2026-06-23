import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'
import { AuthProvider } from '../auth/AuthProvider'
import { ApiError } from '../api/client'
import * as authApi from '../api/auth'
import * as tasksApi from '../api/tasks'

vi.mock('../api/auth')
vi.mock('../api/tasks')

function renderDashboardPage() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(authApi.me).mockResolvedValue({ id: 1, email: 'a@example.com' })
    vi.mocked(tasksApi.getCurrentTask).mockResolvedValue(undefined)
  })

  it('greets the current user', async () => {
    renderDashboardPage()

    await waitFor(() => expect(screen.getByText('Hi, a@example.com')).toBeInTheDocument())
  })

  it('logs out and navigates to the login page', async () => {
    vi.mocked(authApi.logout).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderDashboardPage()

    await waitFor(() => screen.getByText('Hi, a@example.com'))
    await user.click(screen.getByRole('button', { name: 'Log out' }))

    await waitFor(() => expect(screen.getByText('login page')).toBeInTheDocument())
  })

  it('changes the password successfully', async () => {
    vi.mocked(authApi.changePassword).mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderDashboardPage()

    await waitFor(() => screen.getByText('Hi, a@example.com'))
    await user.type(screen.getByLabelText('Current password'), 'oldPassword1')
    await user.type(screen.getByLabelText('New password'), 'newPassword1')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    await waitFor(() => expect(screen.getByText('Password changed.')).toBeInTheDocument())
    expect(authApi.changePassword).toHaveBeenCalledWith('oldPassword1', 'newPassword1')
  })

  it('shows an error when changing the password fails', async () => {
    vi.mocked(authApi.changePassword).mockRejectedValue(
      new ApiError(400, 'Current password is incorrect'),
    )
    const user = userEvent.setup()
    renderDashboardPage()

    await waitFor(() => screen.getByText('Hi, a@example.com'))
    await user.type(screen.getByLabelText('Current password'), 'wrongPassword')
    await user.type(screen.getByLabelText('New password'), 'newPassword1')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    await waitFor(() =>
      expect(screen.getByText('Current password is incorrect')).toBeInTheDocument(),
    )
  })
})
