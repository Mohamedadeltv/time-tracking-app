import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as overviewApi from './overview'

function mockFetchOnce(status: number, body?: unknown) {
  const text = body === undefined ? '' : JSON.stringify(body)
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(text),
  } as Response)
}

describe('overview api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getProjectOverview fetches /api/projects/:id/overview with no params by default', async () => {
    mockFetchOnce(200, { projectId: 1, projectName: 'Lecture', totalSeconds: 0, tasks: [] })

    const overview = await overviewApi.getProjectOverview(1)

    expect(overview.projectName).toBe('Lecture')
    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/projects/1/overview')
    expect(init?.method).toBe('GET')
  })

  it('getProjectOverview sends from and to as query params when given', async () => {
    mockFetchOnce(200, { projectId: 1, projectName: 'Lecture', totalSeconds: 0, tasks: [] })

    await overviewApi.getProjectOverview(1, '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z')

    const [path] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe(
      '/api/projects/1/overview?from=2026-01-01T00%3A00%3A00Z&to=2026-01-02T00%3A00%3A00Z',
    )
  })
})
