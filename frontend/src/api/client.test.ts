import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient, ApiError } from './client'

function mockFetchOnce(response: { status: number; body?: unknown }) {
  const text = response.body === undefined ? '' : JSON.stringify(response.body)
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    text: () => Promise.resolve(text),
  } as Response)
}

function clearCsrfCookie() {
  document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
}

describe('apiClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    clearCsrfCookie()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearCsrfCookie()
  })

  it('performs a GET without a body or CSRF header', async () => {
    document.cookie = 'XSRF-TOKEN=some-token'
    mockFetchOnce({ status: 200, body: { id: 1 } })

    const result = await apiClient.get<{ id: number }>('/api/auth/me')

    expect(result).toEqual({ id: 1 })
    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(init?.method).toBe('GET')
    expect(init?.headers).not.toHaveProperty('X-XSRF-TOKEN')
  })

  it('returns undefined for an empty (e.g. 204) response body', async () => {
    mockFetchOnce({ status: 204 })

    const result = await apiClient.post<void>('/api/auth/logout')

    expect(result).toBeUndefined()
  })

  it('sends the CSRF cookie value as a header on mutating requests', async () => {
    document.cookie = 'XSRF-TOKEN=abc123'
    mockFetchOnce({ status: 200, body: { id: 1, email: 'a@example.com' } })

    await apiClient.post('/api/auth/login', { email: 'a@example.com', password: 'password123' })

    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(init?.headers).toMatchObject({ 'X-XSRF-TOKEN': 'abc123', 'Content-Type': 'application/json' })
    expect(init?.body).toBe(JSON.stringify({ email: 'a@example.com', password: 'password123' }))
  })

  it('omits the CSRF header when no cookie is present', async () => {
    mockFetchOnce({ status: 200, body: {} })

    await apiClient.post('/api/auth/login', { email: 'a@example.com', password: 'password123' })

    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(init?.headers).not.toHaveProperty('X-XSRF-TOKEN')
  })

  it('throws an ApiError with the server message and field errors on failure', async () => {
    mockFetchOnce({
      status: 400,
      body: { message: 'Validation failed', errors: { email: 'must not be blank' } },
    })

    await expect(apiClient.post('/api/auth/register', {})).rejects.toMatchObject({
      status: 400,
      message: 'Validation failed',
      fieldErrors: { email: 'must not be blank' },
    })
  })

  it('falls back to a generic message when the error body has none', async () => {
    mockFetchOnce({ status: 500 })

    const error = await apiClient.get('/api/auth/me').catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 500, message: 'Request failed' })
  })
})
