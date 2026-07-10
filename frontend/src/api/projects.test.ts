import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as projectsApi from './projects'

function mockFetchOnce(status: number, body?: unknown) {
  const text = body === undefined ? '' : JSON.stringify(body)
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(text),
  } as Response)
}

describe('projects api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('listProjects fetches /api/projects', async () => {
    mockFetchOnce(200, [{ id: 1, name: 'Lecture' }])

    const projects = await projectsApi.listProjects()

    expect(projects).toEqual([{ id: 1, name: 'Lecture' }])
    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/projects')
    expect(init?.method).toBe('GET')
  })

  it('createProject posts the name, parentId, and budgetHours to /api/projects', async () => {
    mockFetchOnce(201, { id: 1, name: 'Lecture', parentId: null, totalSeconds: 0 })

    await projectsApi.createProject('Lecture', 5)

    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/projects')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      name: 'Lecture',
      parentId: 5,
      budgetHours: null,
    })
  })

  it('createProject defaults parentId and budgetHours to null', async () => {
    mockFetchOnce(201, { id: 1, name: 'Lecture', parentId: null, totalSeconds: 0 })

    await projectsApi.createProject('Lecture')

    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(JSON.parse(init?.body as string)).toEqual({
      name: 'Lecture',
      parentId: null,
      budgetHours: null,
    })
  })

  it('createProject sends budgetHours when provided', async () => {
    mockFetchOnce(201, { id: 1, name: 'Lecture', parentId: null, totalSeconds: 0, budgetHours: 10 })

    await projectsApi.createProject('Lecture', null, 10)

    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(JSON.parse(init?.body as string)).toEqual({
      name: 'Lecture',
      parentId: null,
      budgetHours: 10,
    })
  })

  it('updateProject puts the name and parentId to /api/projects/:id', async () => {
    mockFetchOnce(200, { id: 1, name: 'Renamed', parentId: null, totalSeconds: 0 })

    await projectsApi.updateProject(1, 'Renamed', 5)

    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/projects/1')
    expect(init?.method).toBe('PUT')
    expect(JSON.parse(init?.body as string)).toEqual({
      name: 'Renamed',
      parentId: 5,
      budgetHours: null,
    })
  })

  it('deleteProject deletes /api/projects/:id', async () => {
    mockFetchOnce(204)

    await projectsApi.deleteProject(1)

    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/projects/1')
    expect(init?.method).toBe('DELETE')
  })

  it('listMembers fetches /api/projects/:id/members', async () => {
    mockFetchOnce(200, [{ userId: 1, email: 'a@b.com', role: 'OWNER' }])

    const members = await projectsApi.listMembers(5)

    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/projects/5/members')
    expect(init?.method).toBe('GET')
    expect(members).toEqual([{ userId: 1, email: 'a@b.com', role: 'OWNER' }])
  })

  it('inviteMember posts email to /api/projects/:id/members', async () => {
    mockFetchOnce(201, { userId: 2, email: 'b@c.com', role: 'MEMBER' })

    await projectsApi.inviteMember(5, 'b@c.com')

    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/projects/5/members')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({ email: 'b@c.com' })
  })

  it('removeMember deletes /api/projects/:id/members/:userId', async () => {
    mockFetchOnce(204)

    await projectsApi.removeMember(5, 2)

    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/projects/5/members/2')
    expect(init?.method).toBe('DELETE')
  })
})
