import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TimeTracker } from './TimeTracker'
import { ApiError } from '../api/client'
import * as tasksApi from '../api/tasks'

vi.mock('../api/tasks')

function runningTask(overrides: Partial<tasksApi.Task> = {}): tasksApi.Task {
  return {
    id: 1,
    description: 'Writing report',
    startTime: new Date(Date.now() - 5000).toISOString(),
    endTime: null,
    running: true,
    ...overrides,
  }
}

describe('TimeTracker', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows the start form when nothing is running', async () => {
    vi.mocked(tasksApi.getCurrentTask).mockResolvedValue(undefined)

    render(<TimeTracker />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument())
  })

  it('shows the running task with a stop button', async () => {
    vi.mocked(tasksApi.getCurrentTask).mockResolvedValue(runningTask())

    render(<TimeTracker />)

    await waitFor(() => expect(screen.getByText('Writing report')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(screen.getByText(/^\d{2}:\d{2}:\d{2}$/)).toBeInTheDocument()
  })

  it('starts a task and switches to the running view', async () => {
    vi.mocked(tasksApi.getCurrentTask).mockResolvedValue(undefined)
    vi.mocked(tasksApi.startTask).mockResolvedValue(runningTask({ description: 'New task' }))
    const user = userEvent.setup()

    render(<TimeTracker />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument())

    await user.type(screen.getByLabelText('What are you working on?'), 'New task')
    await user.click(screen.getByRole('button', { name: 'Start' }))

    await waitFor(() => expect(screen.getByText('New task')).toBeInTheDocument())
    expect(tasksApi.startTask).toHaveBeenCalledWith('New task')
  })

  it('stops the running task and switches back to the start form', async () => {
    vi.mocked(tasksApi.getCurrentTask).mockResolvedValue(runningTask())
    vi.mocked(tasksApi.stopTask).mockResolvedValue(runningTask({ running: false }))
    const user = userEvent.setup()

    render(<TimeTracker />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Stop' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument(),
    )
    expect(tasksApi.stopTask).toHaveBeenCalled()
  })

  it('shows an error when the current task cannot be loaded', async () => {
    vi.mocked(tasksApi.getCurrentTask).mockRejectedValue(new Error('network down'))

    render(<TimeTracker />)

    await waitFor(() =>
      expect(screen.getByText('Could not load the current task.')).toBeInTheDocument(),
    )
  })

  it('shows a generic error when stopping fails for a non-API reason', async () => {
    vi.mocked(tasksApi.getCurrentTask).mockResolvedValue(runningTask())
    vi.mocked(tasksApi.stopTask).mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()

    render(<TimeTracker />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Stop' }))

    await waitFor(() =>
      expect(screen.getByText('Could not stop the task.')).toBeInTheDocument(),
    )
  })

  it('shows the server error message when starting fails', async () => {
    vi.mocked(tasksApi.getCurrentTask).mockResolvedValue(undefined)
    vi.mocked(tasksApi.startTask).mockRejectedValue(new ApiError(400, 'Description too long'))
    const user = userEvent.setup()

    render(<TimeTracker />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Start' }))

    await waitFor(() => expect(screen.getByText('Description too long')).toBeInTheDocument())
  })
})
