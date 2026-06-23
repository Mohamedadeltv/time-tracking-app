import { useEffect, useState } from 'react'

type BackendStatus = 'checking' | 'online' | 'offline'

const STATUS_STYLES: Record<BackendStatus, string> = {
  checking: 'bg-gray-100 text-gray-600',
  online: 'bg-green-100 text-green-700',
  offline: 'bg-red-100 text-red-700',
}

function App() {
  const [status, setStatus] = useState<BackendStatus>('checking')

  useEffect(() => {
    fetch('/api/health')
      .then((res) => setStatus(res.ok ? 'online' : 'offline'))
      .catch(() => setStatus('offline'))
  }, [])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50">
      <h1 className="text-3xl font-semibold text-slate-900">Time Tracking</h1>
      <p
        data-testid="backend-status"
        className={`rounded-full px-4 py-1 text-sm font-medium ${STATUS_STYLES[status]}`}
      >
        Backend: {status}
      </p>
    </main>
  )
}

export default App
