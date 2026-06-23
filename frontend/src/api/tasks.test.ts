import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as tasksApi from './tasks'

function mockFetchOnce(status: number, body?: unknown) {
  const text = body === undefined ? '' : JSON.stringify(body)
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(text),
  } as Response)
}

describe('tasks api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('startTask posts the description to /api/tasks/start', async () => {
    mockFetchOnce(201, { id: 1, description: 'Writing', startTime: '2026-01-01T00:00:00Z', endTime: null, running: true })

    const task = await tasksApi.startTask('Writing')

    expect(task.running).toBe(true)
    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/tasks/start')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({ description: 'Writing' })
  })

  it('startTask omits the body when no description is given', async () => {
    mockFetchOnce(201, { id: 1, description: null, startTime: '2026-01-01T00:00:00Z', endTime: null, running: true })

    await tasksApi.startTask()

    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(init?.body).toBeUndefined()
  })

  it('stopTask posts to /api/tasks/stop', async () => {
    mockFetchOnce(200, {
      id: 1,
      description: 'Writing',
      startTime: '2026-01-01T00:00:00Z',
      endTime: '2026-01-01T01:00:00Z',
      running: false,
    })

    const task = await tasksApi.stopTask()

    expect(task.running).toBe(false)
    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/tasks/stop')
    expect(init?.method).toBe('POST')
  })

  it('getCurrentTask fetches /api/tasks/current', async () => {
    mockFetchOnce(200, {
      id: 1,
      description: 'Writing',
      startTime: '2026-01-01T00:00:00Z',
      endTime: null,
      running: true,
    })

    const task = await tasksApi.getCurrentTask()

    expect(task?.running).toBe(true)
    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/tasks/current')
    expect(init?.method).toBe('GET')
  })

  it('getCurrentTask returns undefined when nothing is running', async () => {
    mockFetchOnce(204)

    const task = await tasksApi.getCurrentTask()

    expect(task).toBeUndefined()
  })
})
