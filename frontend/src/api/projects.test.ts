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

  it('createProject posts the name to /api/projects', async () => {
    mockFetchOnce(201, { id: 1, name: 'Lecture' })

    await projectsApi.createProject('Lecture')

    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/projects')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({ name: 'Lecture' })
  })

  it('updateProject puts the name to /api/projects/:id', async () => {
    mockFetchOnce(200, { id: 1, name: 'Renamed' })

    await projectsApi.updateProject(1, 'Renamed')

    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/projects/1')
    expect(init?.method).toBe('PUT')
    expect(JSON.parse(init?.body as string)).toEqual({ name: 'Renamed' })
  })

  it('deleteProject deletes /api/projects/:id', async () => {
    mockFetchOnce(204)

    await projectsApi.deleteProject(1)

    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/projects/1')
    expect(init?.method).toBe('DELETE')
  })
})
