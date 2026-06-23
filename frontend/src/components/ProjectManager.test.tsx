import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectManager } from './ProjectManager'
import { ApiError } from '../api/client'
import * as projectsApi from '../api/projects'

vi.mock('../api/projects')

function project(overrides: Partial<projectsApi.Project> = {}): projectsApi.Project {
  return {
    id: 1,
    name: 'Lecture',
    parentId: null,
    totalSeconds: 0,
    ...overrides,
  }
}

// Project names also appear as options in the "Parent project" pickers, so existence checks
// for a name must be scoped to the list itself to avoid matching both.
function projectList() {
  return within(screen.getByRole('list', { name: 'Project list' }))
}

describe('ProjectManager', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows a message when there are no projects', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([])

    render(<ProjectManager />)

    await waitFor(() => expect(screen.getByText('No projects yet.')).toBeInTheDocument())
  })

  it('lists existing projects with their total time', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([project({ totalSeconds: 3600 })])

    render(<ProjectManager />)

    await waitFor(() => expect(projectList().getByText('Lecture')).toBeInTheDocument())
    expect(projectList().getByText('(01:00:00)')).toBeInTheDocument()
  })

  it('renders subprojects nested under their parent', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([
      project({ id: 1, name: 'Course' }),
      project({ id: 2, name: 'Assignment', parentId: 1 }),
    ])

    render(<ProjectManager />)

    await waitFor(() => expect(projectList().getByText('Assignment')).toBeInTheDocument())
    const assignmentItem = projectList().getByText('Assignment').closest('li')
    const courseItem = projectList().getByText('Course').closest('li')
    expect(courseItem).toContainElement(assignmentItem)
  })

  it('adds a project', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([])
    vi.mocked(projectsApi.createProject).mockResolvedValue(project())
    const onProjectsChange = vi.fn()
    const user = userEvent.setup()

    render(<ProjectManager onProjectsChange={onProjectsChange} />)
    await waitFor(() => expect(screen.getByText('No projects yet.')).toBeInTheDocument())

    await user.type(screen.getByLabelText('New project'), 'Lecture')
    await user.click(screen.getByRole('button', { name: 'Add project' }))

    await waitFor(() => expect(projectsApi.createProject).toHaveBeenCalledWith('Lecture', null))
    expect(onProjectsChange).toHaveBeenCalled()
  })

  it('adds a subproject under a chosen parent', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([project({ id: 1, name: 'Course' })])
    vi.mocked(projectsApi.createProject).mockResolvedValue(
      project({ id: 2, name: 'Assignment', parentId: 1 }),
    )
    const user = userEvent.setup()

    render(<ProjectManager />)
    await waitFor(() => expect(projectList().getByText('Course')).toBeInTheDocument())

    await user.type(screen.getByLabelText('New project'), 'Assignment')
    await user.selectOptions(screen.getAllByLabelText('Parent project')[0], 'Course')
    await user.click(screen.getByRole('button', { name: 'Add project' }))

    await waitFor(() => expect(projectsApi.createProject).toHaveBeenCalledWith('Assignment', 1))
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
    vi.mocked(projectsApi.listProjects).mockResolvedValue([project()])
    vi.mocked(projectsApi.updateProject).mockResolvedValue(project({ name: 'Seminar' }))
    const user = userEvent.setup()

    render(<ProjectManager />)
    await waitFor(() => expect(projectList().getByText('Lecture')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Rename' }))
    const input = screen.getByLabelText('Project name')
    await user.clear(input)
    await user.type(input, 'Seminar')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(projectsApi.updateProject).toHaveBeenCalledWith(1, 'Seminar', null),
    )
  })

  it('excludes a project and its descendants from its own parent picker', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([
      project({ id: 1, name: 'Grandparent' }),
      project({ id: 2, name: 'Parent', parentId: 1 }),
      project({ id: 3, name: 'Child', parentId: 2 }),
    ])
    const user = userEvent.setup()

    render(<ProjectManager />)
    await waitFor(() => expect(projectList().getByText('Parent')).toBeInTheDocument())

    await user.click(screen.getAllByRole('button', { name: 'Rename' })[1])
    const editSelect = screen.getAllByLabelText('Parent project')[1]
    const optionLabels = Array.from(editSelect.querySelectorAll('option')).map(
      (option) => option.textContent,
    )
    expect(optionLabels).toEqual(['No parent', 'Grandparent'])
  })

  it('cancels renaming without saving', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([project()])
    const user = userEvent.setup()

    render(<ProjectManager />)
    await waitFor(() => expect(projectList().getByText('Lecture')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Rename' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(projectsApi.updateProject).not.toHaveBeenCalled()
  })

  it('shows a generic error when renaming fails for a non-API reason', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([project()])
    vi.mocked(projectsApi.updateProject).mockRejectedValue(new Error('network down'))
    const user = userEvent.setup()

    render(<ProjectManager />)
    await waitFor(() => expect(projectList().getByText('Lecture')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Rename' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(screen.getByText('Could not rename the project.')).toBeInTheDocument(),
    )
  })

  it('deletes a project after confirming', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([project()])
    vi.mocked(projectsApi.deleteProject).mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onProjectsChange = vi.fn()
    const user = userEvent.setup()

    render(<ProjectManager onProjectsChange={onProjectsChange} />)
    await waitFor(() => expect(projectList().getByText('Lecture')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(projectsApi.deleteProject).toHaveBeenCalledWith(1))
    expect(onProjectsChange).toHaveBeenCalled()
  })

  it('does not delete a project when the confirmation is declined', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([project()])
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()

    render(<ProjectManager />)
    await waitFor(() => expect(projectList().getByText('Lecture')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(projectsApi.deleteProject).not.toHaveBeenCalled()
  })

  it('shows an error when deleting fails', async () => {
    vi.mocked(projectsApi.listProjects).mockResolvedValue([project()])
    vi.mocked(projectsApi.deleteProject).mockRejectedValue(new Error('network down'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()

    render(<ProjectManager />)
    await waitFor(() => expect(projectList().getByText('Lecture')).toBeInTheDocument())

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
