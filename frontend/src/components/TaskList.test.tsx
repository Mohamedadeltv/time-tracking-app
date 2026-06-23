import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskList } from './TaskList'
import { ApiError } from '../api/client'
import * as tasksApi from '../api/tasks'
import * as projectsApi from '../api/projects'

vi.mock('../api/tasks')
vi.mock('../api/projects')

function task(overrides: Partial<tasksApi.Task> = {}): tasksApi.Task {
  return {
    id: 1,
    description: 'Writing report',
    startTime: '2026-01-01T09:00:00Z',
    endTime: '2026-01-01T10:00:00Z',
    running: false,
    projects: [],
    ...overrides,
  }
}

function addTaskForm() {
  return screen.getByRole('button', { name: 'Add task' }).closest('form') as HTMLFormElement
}

describe('TaskList', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(projectsApi.listProjects).mockResolvedValue([])
  })

  it('shows a message when there are no tasks', async () => {
    vi.mocked(tasksApi.listTasks).mockResolvedValue([])

    render(<TaskList />)

    await waitFor(() => expect(screen.getByText('No tasks yet.')).toBeInTheDocument())
  })

  it('lists existing tasks', async () => {
    vi.mocked(tasksApi.listTasks).mockResolvedValue([task()])

    render(<TaskList />)

    await waitFor(() => expect(screen.getByText('Writing report')).toBeInTheDocument())
  })

  it('shows "Running" for a task with no end time', async () => {
    vi.mocked(tasksApi.listTasks).mockResolvedValue([task({ endTime: null, running: true })])

    render(<TaskList />)

    await waitFor(() => expect(screen.getByText('Running')).toBeInTheDocument())
  })

  it('adds a task with explicit start and end times', async () => {
    vi.mocked(tasksApi.listTasks).mockResolvedValue([])
    vi.mocked(tasksApi.createTask).mockResolvedValue(task())
    const user = userEvent.setup()

    render(<TaskList />)
    await waitFor(() => expect(screen.getByText('No tasks yet.')).toBeInTheDocument())

    const form = within(addTaskForm())
    await user.type(form.getByLabelText('Description'), 'New task')
    fireEvent.change(form.getByLabelText('Start'), { target: { value: '2026-01-01T09:00' } })
    fireEvent.change(form.getByLabelText('End'), { target: { value: '2026-01-01T10:00' } })
    await user.click(form.getByRole('button', { name: 'Add task' }))

    await waitFor(() => expect(tasksApi.createTask).toHaveBeenCalled())
    const input = vi.mocked(tasksApi.createTask).mock.calls[0][0]
    expect(input.description).toBe('New task')
    expect(new Date(input.startTime).toISOString()).toBe(input.startTime)
    expect(tasksApi.listTasks).toHaveBeenCalledTimes(2)
  })

  it('shows an error when adding a task fails', async () => {
    vi.mocked(tasksApi.listTasks).mockResolvedValue([])
    vi.mocked(tasksApi.createTask).mockRejectedValue(new ApiError(400, 'End time must be after start time'))
    const user = userEvent.setup()

    render(<TaskList />)
    await waitFor(() => expect(screen.getByText('No tasks yet.')).toBeInTheDocument())

    const form = within(addTaskForm())
    fireEvent.change(form.getByLabelText('Start'), { target: { value: '2026-01-01T10:00' } })
    fireEvent.change(form.getByLabelText('End'), { target: { value: '2026-01-01T09:00' } })
    await user.click(form.getByRole('button', { name: 'Add task' }))

    await waitFor(() =>
      expect(screen.getByText('End time must be after start time')).toBeInTheDocument(),
    )
  })

  it('edits a task', async () => {
    vi.mocked(tasksApi.listTasks).mockResolvedValue([task()])
    vi.mocked(tasksApi.updateTask).mockResolvedValue(task({ description: 'Updated' }))
    const user = userEvent.setup()

    render(<TaskList />)
    await waitFor(() => expect(screen.getByText('Writing report')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const saveButton = screen.getByRole('button', { name: 'Save' })
    const editForm = saveButton.closest('form') as HTMLFormElement
    const editScope = within(editForm)
    await user.clear(editScope.getByLabelText('Description'))
    await user.type(editScope.getByLabelText('Description'), 'Updated')
    await user.click(saveButton)

    await waitFor(() => expect(tasksApi.updateTask).toHaveBeenCalledWith(1, expect.objectContaining({ description: 'Updated' })))
  })

  it('shows a generic error when editing fails for a non-API reason', async () => {
    vi.mocked(tasksApi.listTasks).mockResolvedValue([task()])
    vi.mocked(tasksApi.updateTask).mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()

    render(<TaskList />)
    await waitFor(() => expect(screen.getByText('Writing report')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByText('Could not update the task.')).toBeInTheDocument())
  })

  it('shows an error when deleting fails', async () => {
    vi.mocked(tasksApi.listTasks).mockResolvedValue([task()])
    vi.mocked(tasksApi.deleteTask).mockRejectedValue(new Error('network down'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()

    render(<TaskList />)
    await waitFor(() => expect(screen.getByText('Writing report')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(screen.getByText('Could not delete the task.')).toBeInTheDocument())
  })

  it('cancels editing without saving', async () => {
    vi.mocked(tasksApi.listTasks).mockResolvedValue([task()])
    const user = userEvent.setup()

    render(<TaskList />)
    await waitFor(() => expect(screen.getByText('Writing report')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(tasksApi.updateTask).not.toHaveBeenCalled()
  })

  it('deletes a task after confirming', async () => {
    vi.mocked(tasksApi.listTasks).mockResolvedValue([task()])
    vi.mocked(tasksApi.deleteTask).mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()

    render(<TaskList />)
    await waitFor(() => expect(screen.getByText('Writing report')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(tasksApi.deleteTask).toHaveBeenCalledWith(1))
  })

  it('does not delete a task when the confirmation is declined', async () => {
    vi.mocked(tasksApi.listTasks).mockResolvedValue([task()])
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()

    render(<TaskList />)
    await waitFor(() => expect(screen.getByText('Writing report')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(tasksApi.deleteTask).not.toHaveBeenCalled()
  })

  it('shows the associated projects for a task', async () => {
    vi.mocked(tasksApi.listTasks).mockResolvedValue([
      task({ projects: [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }] }),
    ])

    render(<TaskList />)

    await waitFor(() => expect(screen.getByText('Alpha, Beta')).toBeInTheDocument())
  })

  it('shows a dash when a task has no associated projects', async () => {
    vi.mocked(tasksApi.listTasks).mockResolvedValue([task({ projects: [] })])

    render(<TaskList />)

    await waitFor(() => expect(screen.getByText('—')).toBeInTheDocument())
  })

  it('adds a task with selected projects', async () => {
    vi.mocked(tasksApi.listTasks).mockResolvedValue([])
    vi.mocked(projectsApi.listProjects).mockResolvedValue([
      { id: 1, name: 'Alpha' },
      { id: 2, name: 'Beta' },
    ])
    vi.mocked(tasksApi.createTask).mockResolvedValue(task())
    const user = userEvent.setup()

    render(<TaskList />)
    await waitFor(() => expect(screen.getByText('No tasks yet.')).toBeInTheDocument())

    const form = within(addTaskForm())
    fireEvent.change(form.getByLabelText('Start'), { target: { value: '2026-01-01T09:00' } })
    fireEvent.change(form.getByLabelText('End'), { target: { value: '2026-01-01T10:00' } })
    await user.click(form.getByLabelText('Alpha'))
    await user.click(form.getByRole('button', { name: 'Add task' }))

    await waitFor(() =>
      expect(tasksApi.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ projectIds: [1] }),
      ),
    )
  })

  it('pre-selects a task\'s current projects when editing, and saves the new selection', async () => {
    vi.mocked(tasksApi.listTasks).mockResolvedValue([
      task({ projects: [{ id: 1, name: 'Alpha' }] }),
    ])
    vi.mocked(projectsApi.listProjects).mockResolvedValue([
      { id: 1, name: 'Alpha' },
      { id: 2, name: 'Beta' },
    ])
    vi.mocked(tasksApi.updateTask).mockResolvedValue(task())
    const user = userEvent.setup()

    render(<TaskList />)
    await waitFor(() => expect(screen.getByText('Writing report')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const saveButton = screen.getByRole('button', { name: 'Save' })
    const editForm = within(saveButton.closest('form') as HTMLFormElement)

    expect(editForm.getByLabelText('Alpha')).toBeChecked()
    expect(editForm.getByLabelText('Beta')).not.toBeChecked()

    await user.click(editForm.getByLabelText('Beta'))
    await user.click(saveButton)

    await waitFor(() =>
      expect(tasksApi.updateTask).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ projectIds: expect.arrayContaining([1, 2]) }),
      ),
    )
  })

  it('shows an error when loading tasks fails', async () => {
    vi.mocked(tasksApi.listTasks).mockRejectedValue(new Error('network down'))

    render(<TaskList />)

    await waitFor(() => expect(screen.getByText('Could not load tasks.')).toBeInTheDocument())
  })
})
