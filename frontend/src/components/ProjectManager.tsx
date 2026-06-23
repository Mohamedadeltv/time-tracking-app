import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import {
  createProject,
  deleteProject,
  listProjects,
  updateProject,
  type Project,
} from '../api/projects'
import { formatDuration } from '../utils/duration'

function descendantIds(projects: Project[], rootId: number): Set<number> {
  const childrenByParentId = new Map<number, number[]>()
  for (const project of projects) {
    if (project.parentId != null) {
      const siblings = childrenByParentId.get(project.parentId) ?? []
      siblings.push(project.id)
      childrenByParentId.set(project.parentId, siblings)
    }
  }
  const result = new Set<number>()
  const stack = [rootId]
  while (stack.length > 0) {
    const current = stack.pop() as number
    if (!result.has(current)) {
      result.add(current)
      stack.push(...(childrenByParentId.get(current) ?? []))
    }
  }
  return result
}

function ParentProjectSelect({
  projects,
  excludedIds,
  value,
  onChange,
}: {
  projects: Project[]
  excludedIds: Set<number>
  value: number | null
  onChange: (value: number | null) => void
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-700">
      Parent project
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="rounded border border-slate-300 px-2 py-1"
      >
        <option value="">No parent</option>
        {projects
          .filter((project) => !excludedIds.has(project.id))
          .map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
      </select>
    </label>
  )
}

export function ProjectManager({
  refreshSignal,
  onProjectsChange,
}: {
  refreshSignal?: number
  onProjectsChange?: () => void
} = {}) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newParentId, setNewParentId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editParentId, setEditParentId] = useState<number | null>(null)

  function load() {
    listProjects()
      .then(setProjects)
      .catch(() => setError('Could not load projects.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch(() => setError('Could not load projects.'))
      .finally(() => setLoading(false))
  }, [refreshSignal])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await createProject(newName.trim(), newParentId)
      setNewName('')
      setNewParentId(null)
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
    setEditParentId(project.parentId)
  }

  async function handleRename(event: FormEvent, id: number) {
    event.preventDefault()
    setError(null)
    try {
      await updateProject(id, editName.trim(), editParentId)
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

  function childrenOf(parentId: number | null): Project[] {
    return projects.filter((project) => project.parentId === parentId)
  }

  function renderProject(project: Project) {
    const children = childrenOf(project.id)
    return (
      <li key={project.id}>
        <div className="flex items-center justify-between gap-2 border-b py-1">
          {editingId === project.id ? (
            <form
              onSubmit={(e) => handleRename(e, project.id)}
              className="flex flex-1 flex-wrap items-end gap-2"
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
              <ParentProjectSelect
                projects={projects}
                excludedIds={descendantIds(projects, project.id)}
                value={editParentId}
                onChange={setEditParentId}
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
              <span className="text-sm text-slate-700">
                <span>{project.name}</span>{' '}
                <span className="font-mono text-xs text-slate-500">
                  ({formatDuration(project.totalSeconds)})
                </span>
              </span>
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
        </div>
        {children.length > 0 && (
          <ul className="ml-4 flex flex-col gap-2">{children.map(renderProject)}</ul>
        )}
      </li>
    )
  }

  return (
    <section className="flex w-full max-w-2xl flex-col gap-4 rounded-lg bg-white p-8 shadow">
      <h2 className="text-lg font-semibold text-slate-900">Projects</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
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
        <ParentProjectSelect
          projects={projects}
          excludedIds={new Set()}
          value={newParentId}
          onChange={setNewParentId}
        />
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
        <ul aria-label="Project list" className="flex flex-col gap-2">
          {childrenOf(null).map(renderProject)}
        </ul>
      )}
    </section>
  )
}
