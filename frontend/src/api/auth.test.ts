import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as authApi from './auth'

function mockFetchOnce(status: number, body?: unknown) {
  const text = body === undefined ? '' : JSON.stringify(body)
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(text),
  } as Response)
}

describe('auth api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('register posts to /api/auth/register', async () => {
    mockFetchOnce(201, { id: 1, email: 'a@example.com' })

    const user = await authApi.register('a@example.com', 'password123')

    expect(user).toEqual({ id: 1, email: 'a@example.com' })
    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/auth/register')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({
      email: 'a@example.com',
      password: 'password123',
    })
  })

  it('login posts to /api/auth/login', async () => {
    mockFetchOnce(200, { id: 1, email: 'a@example.com' })

    await authApi.login('a@example.com', 'password123')

    const [path] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/auth/login')
  })

  it('logout posts to /api/auth/logout', async () => {
    mockFetchOnce(204)

    await authApi.logout()

    const [path] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/auth/logout')
  })

  it('me fetches /api/auth/me', async () => {
    mockFetchOnce(200, { id: 1, email: 'a@example.com' })

    await authApi.me()

    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/auth/me')
    expect(init?.method).toBe('GET')
  })

  it('changePassword posts to /api/auth/change-password', async () => {
    mockFetchOnce(204)

    await authApi.changePassword('oldPassword1', 'newPassword1')

    const [path, init] = vi.mocked(fetch).mock.calls[0]
    expect(path).toBe('/api/auth/change-password')
    expect(JSON.parse(init?.body as string)).toEqual({
      currentPassword: 'oldPassword1',
      newPassword: 'newPassword1',
    })
  })
})
