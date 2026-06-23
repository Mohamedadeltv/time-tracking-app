import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from './App'

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the app title', () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }))

    render(<App />)

    expect(screen.getByText('Time Tracking')).toBeInTheDocument()
  })

  it('shows the backend as online when the health check succeeds', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }))

    render(<App />)

    await waitFor(() =>
      expect(screen.getByTestId('backend-status')).toHaveTextContent('Backend: online'),
    )
  })

  it('shows the backend as offline when the health check fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network error'))

    render(<App />)

    await waitFor(() =>
      expect(screen.getByTestId('backend-status')).toHaveTextContent('Backend: offline'),
    )
  })
})
