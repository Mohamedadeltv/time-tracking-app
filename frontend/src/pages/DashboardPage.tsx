import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { ApiError } from '../api/client'
import { TimeTracker } from '../components/TimeTracker'
import { TaskList } from '../components/TaskList'
import { ProjectManager } from '../components/ProjectManager'
import { Overview } from '../components/Overview'

export function DashboardPage() {
  const { user, logout, changePassword, setTimezone } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [taskListRefresh, setTaskListRefresh] = useState(0)
  const [projectManagerRefresh, setProjectManagerRefresh] = useState(0)
  const [timezoneInput, setTimezoneInput] = useState(user?.timezone ?? '')
  const [timezoneError, setTimezoneError] = useState<string | null>(null)
  const [timezoneSaved, setTimezoneSaved] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  async function handleSetTimezone(event: FormEvent) {
    event.preventDefault()
    setTimezoneError(null)
    setTimezoneSaved(false)
    try {
      await setTimezone(timezoneInput.trim())
      setTimezoneSaved(true)
    } catch (err) {
      setTimezoneError(err instanceof ApiError ? err.message : 'Could not save timezone.')
    }
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(false)
    setSubmitting(true)
    try {
      await changePassword(currentPassword, newPassword)
      setSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-8 bg-slate-50 p-8">
      <header className="flex w-full max-w-2xl items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Hi, {user?.email}</h1>
        <button onClick={handleLogout} className="text-sm font-medium text-slate-600 underline">
          Log out
        </button>
      </header>

      <TimeTracker onTaskChange={() => setTaskListRefresh((n) => n + 1)} />

      <ProjectManager
        refreshSignal={projectManagerRefresh}
        onProjectsChange={() => setTaskListRefresh((n) => n + 1)}
      />

      <TaskList
        refreshSignal={taskListRefresh}
        onTasksChange={() => setProjectManagerRefresh((n) => n + 1)}
      />

      <Overview projectsRefreshSignal={projectManagerRefresh} />

      <form
        onSubmit={handleSetTimezone}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-white p-8 shadow"
      >
        <h2 className="text-lg font-semibold text-slate-900">Timezone</h2>
        <p className="text-xs text-slate-500">
          Current: {user?.timezone ?? 'Browser default'}
        </p>
        {timezoneError && <p className="text-sm text-red-600">{timezoneError}</p>}
        {timezoneSaved && <p className="text-sm text-green-700">Timezone saved.</p>}
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          IANA timezone (e.g. Europe/Berlin)
          <input
            type="text"
            aria-label="Timezone"
            value={timezoneInput}
            onChange={(e) => setTimezoneInput(e.target.value)}
            placeholder="Europe/Berlin"
            className="rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          Apply timezone
        </button>
      </form>

      <form
        onSubmit={handleChangePassword}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-white p-8 shadow"
      >
        <h2 className="text-lg font-semibold text-slate-900">Change password</h2>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-700">Password changed.</p>}

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Current password
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          New password
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2"
          />
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Change password'}
        </button>
      </form>
    </main>
  )
}
