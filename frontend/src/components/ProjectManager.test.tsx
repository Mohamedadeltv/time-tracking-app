import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectManager } from './ProjectManager'
import { ApiError } from '../api/client'
import * as projectsApi from '../api/projects'

vi.mock('../api/projects')

describe('ProjectManager', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows a message when there are no projects', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([])

    render(<ProjectManager />)

    await waitFor(() => expect(screen.getByText('No projects yet.')).toBeInTheDocument())
  })

  it('lists existing projects', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([{ id: 1, name: 'Lecture' }])

    render(<ProjectManager />)

    await waitFor(() => expect(screen.getByText('Lecture')).toBeInTheDocument())
  })

  it('adds a project', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([])
    vi.mocked(projectsApi.createProject).mockResolvedValue({ id: 1, name: 'Lecture' })
    const onProjectsChange = vi.fn()
    const user = userEvent.setup()

    render(<ProjectManager onProjectsChange={onProjectsChange} />)
    await waitFor(() => expect(screen.getByText('No projects yet.')).toBeInTheDocument())

    await user.type(screen.getByLabelText('New project'), 'Lecture')
    await user.click(screen.getByRole('button', { name: 'Add project' }))

    await waitFor(() => expect(projectsApi.createProject).toHaveBeenCalledWith('Lecture'))
    expect(onProjectsChange).toHaveBeenCalled()
  })

  it('shows an error when adding a project fails', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([])
    vi.mocked(projectsApi.createProject).mockRejectedValue(
      new ApiError(409, 'Project name already in use: Lecture'),
    )
    const user = userEvent.setup()

    render(<ProjectManager />)
    await waitFor(() => expect(screen.getByText('No projects yet.')).toBeInTheDocument())

    await user.type(screen.getByLabelText('New project'), 'Lecture')
    await user.click(screen.getByRole('button', { name: 'Add project' }))

    await waitFor(() =>
      expect(screen.getByText('Project name already in use: Lecture')).toBeInTheDocument(),
    )
  })

  it('renames a project', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([{ id: 1, name: 'Lecture' }])
    vi.mocked(projectsApi.updateProject).mockResolvedValue({ id: 1, name: 'Seminar' })
    const user = userEvent.setup()

    render(<ProjectManager />)
    await waitFor(() => expect(screen.getByText('Lecture')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Rename' }))
    const input = screen.getByLabelText('Project name')
    await user.clear(input)
    await user.type(input, 'Seminar')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(projectsApi.updateProject).toHaveBeenCalledWith(1, 'Seminar'))
  })

  it('cancels renaming without saving', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([{ id: 1, name: 'Lecture' }])
    const user = userEvent.setup()

    render(<ProjectManager />)
    await waitFor(() => expect(screen.getByText('Lecture')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Rename' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(projectsApi.updateProject).not.toHaveBeenCalled()
  })

  it('shows a generic error when renaming fails for a non-API reason', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([{ id: 1, name: 'Lecture' }])
    vi.mocked(projectsApi.updateProject).mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()

    render(<ProjectManager />)
    await waitFor(() => expect(screen.getByText('Lecture')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Rename' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(screen.getByText('Could not rename the project.')).toBeInTheDocument(),
    )
  })

  it('deletes a project after confirming', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([{ id: 1, name: 'Lecture' }])
    vi.mocked(projectsApi.deleteProject).mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onProjectsChange = vi.fn()
    const user = userEvent.setup()

    render(<ProjectManager onProjectsChange={onProjectsChange} />)
    await waitFor(() => expect(screen.getByText('Lecture')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(projectsApi.deleteProject).toHaveBeenCalledWith(1))
    expect(onProjectsChange).toHaveBeenCalled()
  })

  it('does not delete a project when the confirmation is declined', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([{ id: 1, name: 'Lecture' }])
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()

    render(<ProjectManager />)
    await waitFor(() => expect(screen.getByText('Lecture')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(projectsApi.deleteProject).not.toHaveBeenCalled()
  })

  it('shows an error when deleting fails', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([{ id: 1, name: 'Lecture' }])
    vi.mocked(projectsApi.deleteProject).mockRejectedValue(new Error('network down'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()

    render(<ProjectManager />)
    await waitFor(() => expect(screen.getByText('Lecture')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() =>
      expect(screen.getByText('Could not delete the project.')).toBeInTheDocument(),
    )
  })

  it('shows an error when loading projects fails', async () => {
    vi.mocked(projectsApi.listProjects).mockRejectedValue(new Error('network down'))

    render(<ProjectManager />)

    await waitFor(() => expect(screen.getByText('Could not load projects.')).toBeInTheDocument())
  })
})
