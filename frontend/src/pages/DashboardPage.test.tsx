import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'
import { AuthProvider } from '../auth/AuthProvider'
import { ApiError } from '../api/client'
import * as authApi from '../api/auth'
import * as tasksApi from '../api/tasks'
import * as projectsApi from '../api/projects'

vi.mock('../api/auth')
vi.mock('../api/tasks')
vi.mock('../api/projects')

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
    vi.mocked(tasksApi.listTasks).mockResolvedValue([])
    vi.mocked(projectsApi.listProjects).mockResolvedValue([])
  })

  it('greets the current user', async () => {
    renderDashboardPage()

    await waitFor(() => expect(screen.getByText('Hi, a@example.com')).toBeInTheDocument())
  })

  it('reloads the task list after starting a task', async () => {
    vi.mocked(tasksApi.startTask).mockResolvedValue({
      id: 1,
      description: 'New task',
      startTime: new Date().toISOString(),
      endTime: null,
      running: true,
      projects: [],
    })
    const user = userEvent.setup()
    renderDashboardPage()

    await waitFor(() => screen.getByText('Hi, a@example.com'))
    await waitFor(() => expect(tasksApi.listTasks).toHaveBeenCalledTimes(1))

    await user.click(screen.getByRole('button', { name: 'Start' }))

    await waitFor(() => expect(tasksApi.listTasks).toHaveBeenCalledTimes(2))
  })

  it('reloads the project list after adding a task', async () => {
    vi.mocked(tasksApi.createTask).mockResolvedValue({
      id: 1,
      description: null,
      startTime: '2026-01-01T09:00:00Z',
      endTime: '2026-01-01T10:00:00Z',
      running: false,
      projects: [],
    })
    const user = userEvent.setup()
    renderDashboardPage()

    await waitFor(() => screen.getByText('Hi, a@example.com'))
    // One initial fetch each from TaskList (project checkboxes), ProjectManager, and Overview.
    await waitFor(() => expect(projectsApi.listProjects).toHaveBeenCalledTimes(3))

    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '2026-01-01T09:00' } })
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '2026-01-01T10:00' } })
    await user.click(screen.getByRole('button', { name: 'Add task' }))

    // +1 from TaskList's own reload, +1 each from ProjectManager and Overview reacting to
    // onTasksChange bumping the shared refresh signal.
    await waitFor(() => expect(projectsApi.listProjects).toHaveBeenCalledTimes(6))
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

  it('saves the timezone successfully', async () => {
    vi.mocked(authApi.setTimezone).mockResolvedValue({
      id: 1,
      email: 'a@example.com',
      timezone: 'Europe/Berlin',
    })
    const user = userEvent.setup()
    renderDashboardPage()

    await waitFor(() => screen.getByText('Hi, a@example.com'))
    const input = screen.getByLabelText('Timezone')
    await user.clear(input)
    await user.type(input, 'Europe/Berlin')
    await user.click(screen.getByRole('button', { name: 'Apply timezone' }))

    await waitFor(() => expect(screen.getByText('Timezone saved.')).toBeInTheDocument())
    expect(authApi.setTimezone).toHaveBeenCalledWith('Europe/Berlin')
  })

  it('shows an error when saving the timezone fails', async () => {
    vi.mocked(authApi.setTimezone).mockRejectedValue(new ApiError(400, 'Unknown timezone: bad/tz'))
    const user = userEvent.setup()
    renderDashboardPage()

    await waitFor(() => screen.getByText('Hi, a@example.com'))
    const input = screen.getByLabelText('Timezone')
    await user.clear(input)
    await user.type(input, 'bad/tz')
    await user.click(screen.getByRole('button', { name: 'Apply timezone' }))

    await waitFor(() => expect(screen.getByText('Unknown timezone: bad/tz')).toBeInTheDocument())
  })
})
