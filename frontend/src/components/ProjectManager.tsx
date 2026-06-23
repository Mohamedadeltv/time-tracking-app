import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
  type Project,
} from '../api/projects'

export function ProjectManager({ onProjectsChange }: { onProjectsChange?: () => void } = {}) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  function load() {
    listProjects()
      .then(setProjects)
      .catch(() => setError('Could not load projects.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await createProject(newName.trim())
      setNewName('')
      load()
      onProjectsChange?.()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the project.')
    }
  }

  function startEditing(project: Project) {
    setError(null)
    setEditingId(project.id)
    setEditName(project.name)
  }

  async function handleRename(event: FormEvent, id: number) {
    event.preventDefault()
    setError(null)
    try {
      await updateProject(id, editName.trim())
      setEditingId(null)
      load()
      onProjectsChange?.()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not rename the project.')
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this project? Tasks will keep their other associations.')) {
      return
    }
    setError(null)
    try {
      await deleteProject(id)
      load()
      onProjectsChange?.()
    } catch {
      setError('Could not delete the project.')
    }
  }

  return (
    <section className="flex w-full max-w-2xl flex-col gap-4 rounded-lg bg-white p-8 shadow">
      <h2 className="text-lg font-semibold text-slate-900">Projects</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={handleCreate} className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1 text-sm text-slate-700">
          New project
          <input
            type="text"
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={200}
            className="rounded border border-slate-300 px-2 py-1"
          />
        </label>
        <button
          type="submit"
          className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          Add project
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-slate-500">No projects yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((project) => (
            <li key={project.id} className="flex items-center justify-between gap-2 border-b py-1">
              {editingId === project.id ? (
                <form
                  onSubmit={(e) => handleRename(e, project.id)}
                  className="flex flex-1 items-end gap-2"
                >
                  <input
                    type="text"
                    required
                    aria-label="Project name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={200}
                    className="rounded border border-slate-300 px-2 py-1"
                  />
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
              ) : (
                <>
                  <span className="text-sm text-slate-700">{project.name}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditing(project)}
                      className="text-sm text-slate-600 underline"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="text-sm text-red-600 underline"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
