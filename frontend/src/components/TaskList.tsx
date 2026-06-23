import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import {
  createTask,
  deleteTask,
  listTasks,
  updateTask,
  type Task,
} from '../api/tasks'

function toLocalInputValue(iso: string): string {
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInputValue(value: string): string {
  return new Date(value).toISOString()
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [newDescription, setNewDescription] = useState('')
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')

  const [editDescription, setEditDescription] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')

  function load() {
    listTasks()
      .then(setTasks)
      .catch(() => setError('Could not load tasks.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await createTask({
        description: newDescription.trim() || undefined,
        startTime: fromLocalInputValue(newStart),
        endTime: fromLocalInputValue(newEnd),
      })
      setNewDescription('')
      setNewStart('')
      setNewEnd('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the task.')
    }
  }

  function startEditing(task: Task) {
    setError(null)
    setEditingId(task.id)
    setEditDescription(task.description ?? '')
    setEditStart(toLocalInputValue(task.startTime))
    setEditEnd(task.endTime ? toLocalInputValue(task.endTime) : '')
  }

  async function handleUpdate(event: FormEvent, id: number) {
    event.preventDefault()
    setError(null)
    try {
      await updateTask(id, {
        description: editDescription.trim() || undefined,
        startTime: fromLocalInputValue(editStart),
        endTime: editEnd ? fromLocalInputValue(editEnd) : null,
      })
      setEditingId(null)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update the task.')
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this task?')) {
      return
    }
    setError(null)
    try {
      await deleteTask(id)
      load()
    } catch {
      setError('Could not delete the task.')
    }
  }

  return (
    <section className="flex w-full max-w-2xl flex-col gap-4 rounded-lg bg-white p-8 shadow">
      <h2 className="text-lg font-semibold text-slate-900">Tasks</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Description
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            maxLength={500}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Start
          <input
            type="datetime-local"
            required
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          End
          <input
            type="datetime-local"
            required
            value={newEnd}
            onChange={(e) => setNewEnd(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          Add task
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-slate-500">No tasks yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-slate-500">
              <th className="py-1 pr-2">Description</th>
              <th className="py-1 pr-2">Start</th>
              <th className="py-1 pr-2">End</th>
              <th className="py-1 pr-2" />
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) =>
              editingId === task.id ? (
                <tr key={task.id} className="border-b">
                  <td colSpan={4} className="py-2">
                    <form
                      onSubmit={(e) => handleUpdate(e, task.id)}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <label className="flex flex-col gap-1 text-xs text-slate-700">
                        Description
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          maxLength={500}
                          className="rounded border border-slate-300 px-2 py-1"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-slate-700">
                        Start
                        <input
                          type="datetime-local"
                          required
                          value={editStart}
                          onChange={(e) => setEditStart(e.target.value)}
                          className="rounded border border-slate-300 px-2 py-1"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-slate-700">
                        End
                        <input
                          type="datetime-local"
                          value={editEnd}
                          onChange={(e) => setEditEnd(e.target.value)}
                          className="rounded border border-slate-300 px-2 py-1"
                        />
                      </label>
                      <button
                        type="submit"
                        className="rounded bg-slate-900 px-3 py-1 text-sm font-medium text-white"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-sm text-slate-600 underline"
                      >
                        Cancel
                      </button>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={task.id} className="border-b">
                  <td className="py-1 pr-2">{task.description || 'Untitled task'}</td>
                  <td className="py-1 pr-2">{formatTimestamp(task.startTime)}</td>
                  <td className="py-1 pr-2">
                    {task.endTime ? formatTimestamp(task.endTime) : 'Running'}
                  </td>
                  <td className="flex gap-2 py-1 pr-2">
                    <button
                      onClick={() => startEditing(task)}
                      className="text-sm text-slate-600 underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="text-sm text-red-600 underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}
    </section>
  )
}
