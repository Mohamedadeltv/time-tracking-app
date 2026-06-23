import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { getCurrentTask, startTask, stopTask, type Task } from '../api/tasks'

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':')
}

function elapsedSecondsSince(startTime: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(startTime).getTime()) / 1000))
}

export function TimeTracker() {
  const [task, setTask] = useState<Task | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function applyTask(next: Task | null) {
    setTask(next)
    setElapsedSeconds(next ? elapsedSecondsSince(next.startTime) : 0)
  }

  useEffect(() => {
    getCurrentTask()
      .then((current) => {
        setTask(current ?? null)
        setElapsedSeconds(current ? elapsedSecondsSince(current.startTime) : 0)
      })
      .catch(() => setError('Could not load the current task.'))
      .finally(() => setLoading(false))
  }, [])

  // The interval is the only thing that updates elapsedSeconds while a task is running, re-deriving
  // it from the server-recorded startTime each tick - so a page reload (or the server restarting)
  // reconstructs the same running duration instead of relying on a client-side timer that resets.
  useEffect(() => {
    if (!task) {
      return
    }
    const startTime = task.startTime
    const interval = setInterval(() => setElapsedSeconds(elapsedSecondsSince(startTime)), 1000)
    return () => clearInterval(interval)
  }, [task])

  async function handleStart(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const started = await startTask(description.trim() || undefined)
      applyTask(started)
      setDescription('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start the task.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleStop() {
    setError(null)
    setSubmitting(true)
    try {
      await stopTask()
      applyTask(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not stop the task.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <section className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
        <p className="text-sm text-slate-500">Loading…</p>
      </section>
    )
  }

  return (
    <section className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-white p-8 shadow">
      <h2 className="text-lg font-semibold text-slate-900">Time tracking</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {task ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-700">
            Tracking: <span className="font-medium">{task.description || 'Untitled task'}</span>
          </p>
          <p className="font-mono text-3xl text-slate-900">{formatDuration(elapsedSeconds)}</p>
          <button
            onClick={handleStop}
            disabled={submitting}
            className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? 'Stopping…' : 'Stop'}
          </button>
        </div>
      ) : (
        <form onSubmit={handleStart} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            What are you working on?
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              maxLength={500}
              className="rounded border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? 'Starting…' : 'Start'}
          </button>
        </form>
      )}
    </section>
  )
}
