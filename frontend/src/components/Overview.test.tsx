import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Overview } from './Overview'
import { ApiError } from '../api/client'
import * as exportApi from '../api/export'
import * as overviewApi from '../api/overview'
import * as projectsApi from '../api/projects'
import * as tasksApi from '../api/tasks'

vi.mock('../api/overview')
vi.mock('../api/projects')
vi.mock('../api/tasks')
vi.mock('../api/export', () => ({
  buildExportUrl: vi.fn(() => '/api/projects/1/export?format=csv'),
}))

function project(overrides: Partial<projectsApi.Project> = {}): projectsApi.Project {
  return {
    id: 1,
    name: 'Course',
    parentId: null,
    totalSeconds: 0,
    ownerId: 1,
    ...overrides,
  }
}

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

function projectOverview(
  overrides: Partial<overviewApi.ProjectOverview> = {},
): overviewApi.ProjectOverview {
  return {
    projectId: 1,
    projectName: 'Course',
    totalSeconds: 3600,
    tasks: [task()],
    ...overrides,
  }
}

describe('Overview', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('lists projects, including subprojects indented, in the project picker', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([
      project({ id: 1, name: 'Course' }),
      project({ id: 2, name: 'Assignment', parentId: 1 }),
    ])

    render(<Overview />)

    const select = await screen.findByLabelText('Project')
    const optionLabels = Array.from(select.querySelectorAll('option')).map((o) => o.textContent)
    expect(optionLabels).toEqual(['Select a project', 'Course', '— Assignment'])
  })

  it('shows an error when projects fail to load', async () => {
    vi.mocked(projectsApi.listProjects).mockRejectedValue(new Error('network down'))

    render(<Overview />)

    await waitFor(() => expect(screen.getByText('Could not load projects.')).toBeInTheDocument())
  })

  it('does not request an overview when no project is selected', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([project()])
    const user = userEvent.setup()

    render(<Overview />)
    await screen.findByLabelText('Project')
    await user.click(screen.getByRole('button', { name: 'Show' }))

    expect(overviewApi.getProjectOverview).not.toHaveBeenCalled()
  })

  it('shows the total time and tasks for the selected project', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([project()])
    vi.mocked(overviewApi.getProjectOverview).mockResolvedValue(
      projectOverview({ totalSeconds: 7384, tasks: [task({ description: 'Writing report' })] }),
    )
    const user = userEvent.setup()

    render(<Overview />)
    await user.selectOptions(await screen.findByLabelText('Project'), 'Course')
    await user.click(screen.getByRole('button', { name: 'Show' }))

    await waitFor(() => expect(overviewApi.getProjectOverview).toHaveBeenCalledWith(1, undefined, undefined))
    expect(screen.getByText('02:03:04')).toBeInTheDocument()
    expect(screen.getByText('Writing report')).toBeInTheDocument()
  })

  it('passes the from and to fields as ISO instants', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([project()])
    vi.mocked(overviewApi.getProjectOverview).mockResolvedValue(projectOverview({ tasks: [] }))
    const user = userEvent.setup()

    render(<Overview />)
    await user.selectOptions(await screen.findByLabelText('Project'), 'Course')
    await user.type(screen.getByLabelText('From'), '2026-01-01T00:00')
    await user.type(screen.getByLabelText('To'), '2026-01-02T00:00')
    await user.click(screen.getByRole('button', { name: 'Show' }))

    await waitFor(() => expect(overviewApi.getProjectOverview).toHaveBeenCalledTimes(1))
    const [, from, to] = vi.mocked(overviewApi.getProjectOverview).mock.calls[0]
    expect(from).toBe(new Date('2026-01-01T00:00').toISOString())
    expect(to).toBe(new Date('2026-01-02T00:00').toISOString())
  })

  it('shows a message when the project has no tasks in range', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([project()])
    vi.mocked(overviewApi.getProjectOverview).mockResolvedValue(projectOverview({ tasks: [] }))
    const user = userEvent.setup()

    render(<Overview />)
    await user.selectOptions(await screen.findByLabelText('Project'), 'Course')
    await user.click(screen.getByRole('button', { name: 'Show' }))

    await waitFor(() => expect(screen.getByText('No tasks in this range.')).toBeInTheDocument())
  })

  it('shows an error when the project overview fails to load', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([project()])
    vi.mocked(overviewApi.getProjectOverview).mockRejectedValue(
      new ApiError(404, 'Project not found'),
    )
    const user = userEvent.setup()

    render(<Overview />)
    await user.selectOptions(await screen.findByLabelText('Project'), 'Course')
    await user.click(screen.getByRole('button', { name: 'Show' }))

    await waitFor(() => expect(screen.getByText('Project not found')).toBeInTheDocument())
  })

  it('reloads the project picker when the refresh signal changes', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([project()])

    const { rerender } = render(<Overview projectsRefreshSignal={0} />)
    await waitFor(() => expect(projectsApi.listProjects).toHaveBeenCalledTimes(1))

    rerender(<Overview projectsRefreshSignal={1} />)
    await waitFor(() => expect(projectsApi.listProjects).toHaveBeenCalledTimes(2))
  })

  it('shows tasks and the total time for a chosen period', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([])
    vi.mocked(tasksApi.listTasks).mockResolvedValue([
      task({ description: 'Today task', startTime: '2026-01-01T09:00:00Z', endTime: '2026-01-01T10:00:00Z' }),
    ])
    const user = userEvent.setup()

    render(<Overview />)
    await user.click(screen.getByRole('button', { name: 'Today' }))

    await waitFor(() => expect(screen.getByText('Today task')).toBeInTheDocument())
    expect(screen.getByText('01:00:00')).toBeInTheDocument()
    expect(tasksApi.listTasks).toHaveBeenCalledTimes(1)
  })

  it('shows a message when there are no tasks in the chosen period', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([])
    vi.mocked(tasksApi.listTasks).mockResolvedValue([])
    const user = userEvent.setup()

    render(<Overview />)
    await user.click(screen.getByRole('button', { name: 'This week' }))

    await waitFor(() => expect(screen.getByText('No tasks in this period.')).toBeInTheDocument())
  })

  it('shows an error when loading the period tasks fails', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([])
    vi.mocked(tasksApi.listTasks).mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()

    render(<Overview />)
    await user.click(screen.getByRole('button', { name: 'This month' }))

    await waitFor(() =>
      expect(screen.getByText('Could not load tasks for this period.')).toBeInTheDocument(),
    )
  })

  it('shows export controls when a project is selected', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([project()])
    const user = userEvent.setup()

    render(<Overview />)
    await user.selectOptions(await screen.findByLabelText('Project'), 'Course')

    expect(screen.getByLabelText('Export format')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument()
  })

  it('download button calls buildExportUrl with selected format', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([project()])
    const user = userEvent.setup()
    const mockAnchor = { href: '', click: vi.fn() } as unknown as HTMLAnchorElement
    const orig = document.createElement.bind(document)
    const spy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string, ...args: unknown[]) =>
        tag === 'a' ? mockAnchor : orig(tag as keyof HTMLElementTagNameMap, ...(args as [])),
      )

    render(<Overview />)
    await user.selectOptions(await screen.findByLabelText('Project'), 'Course')
    await user.selectOptions(screen.getByLabelText('Export format'), 'json')
    await user.click(screen.getByRole('button', { name: 'Download' }))

    expect(exportApi.buildExportUrl).toHaveBeenCalledWith(1, 'json', undefined, undefined)
    expect(mockAnchor.click).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('passes month boundaries to buildExportUrl when specific month is selected', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([project()])
    const user = userEvent.setup()

    render(<Overview />)
    await user.selectOptions(await screen.findByLabelText('Project'), 'Course')
    await user.selectOptions(screen.getByLabelText('Export period'), 'month')

    await waitFor(() => expect(screen.getByLabelText('Export year')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Download' }))

    expect(exportApi.buildExportUrl).toHaveBeenCalledWith(
      1,
      'csv',
      expect.any(String),
      expect.any(String),
    )
  })
})
