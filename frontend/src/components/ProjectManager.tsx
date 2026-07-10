import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import {
  createProject,
  deleteProject,
  inviteMember,
  listMembers,
  listProjects,
  removeMember,
  updateProject,
  type Member,
  type Project,
} from '../api/projects'
import { useAuth } from '../auth/useAuth'
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

function MembersPanel({
  projectId,
  isOwner,
}: {
  projectId: number
  isOwner: boolean
}) {
  const [members, setMembers] = useState<Member[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  function load() {
    listMembers(projectId)
      .then(setMembers)
      .catch(() => setError('Could not load members.'))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  async function handleInvite(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await inviteMember(projectId, inviteEmail.trim())
      setInviteEmail('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not invite user.')
    }
  }

  async function handleRemove(userId: number) {
    setError(null)
    try {
      await removeMember(projectId, userId)
      load()
    } catch {
      setError('Could not remove member.')
    }
  }

  return (
    <div className="ml-4 mt-2 flex flex-col gap-2 rounded border border-slate-200 bg-slate-50 p-3">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <ul aria-label="Members list" className="flex flex-col gap-1">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between text-sm">
            <span>
              {m.email}{' '}
              <span className="text-xs text-slate-400">({m.role.toLowerCase()})</span>
            </span>
            {isOwner && m.role !== 'OWNER' && (
              <button
                onClick={() => handleRemove(m.userId)}
                className="text-xs text-red-600 underline"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      {isOwner && (
        <form onSubmit={handleInvite} className="flex gap-2">
          <input
            type="email"
            required
            placeholder="Invite by email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-slate-900 px-3 py-1 text-xs font-medium text-white"
          >
            Invite
          </button>
        </form>
      )}
    </div>
  )
}

function BudgetBar({ used, budgetHours }: { used: number; budgetHours: number }) {
  const budgetSeconds = budgetHours * 3600
  const pct = Math.min(100, Math.round((used / budgetSeconds) * 100))
  const over = used > budgetSeconds
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
        <span
          className={`block h-full rounded-full ${over ? 'bg-red-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
          aria-label={`Budget: ${pct}% used`}
        />
      </span>
      <span className={`text-xs ${over ? 'text-red-600' : 'text-slate-500'}`}>
        {formatDuration(used)} / {budgetHours}h
      </span>
    </span>
  )
}

export function ProjectManager({
  refreshSignal,
  onProjectsChange,
}: {
  refreshSignal?: number
  onProjectsChange?: () => void
} = {}) {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newParentId, setNewParentId] = useState<number | null>(null)
  const [newBudgetHours, setNewBudgetHours] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editParentId, setEditParentId] = useState<number | null>(null)
  const [editBudgetHours, setEditBudgetHours] = useState('')
  const [managingMembersId, setManagingMembersId] = useState<number | null>(null)

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
      await createProject(newName.trim(), newParentId, newBudgetHours ? Number(newBudgetHours) : null)
      setNewName('')
      setNewParentId(null)
      setNewBudgetHours('')
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
    setEditBudgetHours(project.budgetHours ? String(project.budgetHours) : '')
  }

  async function handleRename(event: FormEvent, id: number) {
    event.preventDefault()
    setError(null)
    try {
      await updateProject(id, editName.trim(), editParentId, editBudgetHours ? Number(editBudgetHours) : null)
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
      if (managingMembersId === id) setManagingMembersId(null)
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
    const isOwner = user?.id === project.ownerId
    const showMembers = managingMembersId === project.id
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
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Budget (h)
                <input
                  type="number"
                  aria-label="Budget hours"
                  min={1}
                  value={editBudgetHours}
                  onChange={(e) => setEditBudgetHours(e.target.value)}
                  placeholder="None"
                  className="w-20 rounded border border-slate-300 px-2 py-1"
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
          ) : (
            <>
              <span className="flex flex-col gap-0.5 text-sm text-slate-700">
                <span>
                  <span>{project.name}</span>{' '}
                  <span className="font-mono text-xs text-slate-500">
                    ({formatDuration(project.totalSeconds)})
                  </span>
                </span>
                {project.budgetHours != null && (
                  <BudgetBar used={project.totalSeconds} budgetHours={project.budgetHours} />
                )}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setManagingMembersId(showMembers ? null : project.id)
                  }
                  className="text-sm text-slate-600 underline"
                  aria-expanded={showMembers}
                >
                  Members
                </button>
                {isOwner && (
                  <>
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
                  </>
                )}
              </div>
            </>
          )}
        </div>
        {showMembers && <MembersPanel projectId={project.id} isOwner={isOwner} />}
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
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Budget (h)
          <input
            type="number"
            aria-label="Budget hours (new project)"
            min={1}
            value={newBudgetHours}
            onChange={(e) => setNewBudgetHours(e.target.value)}
            placeholder="None"
            className="w-20 rounded border border-slate-300 px-2 py-1"
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
        <ul aria-label="Project list" className="flex flex-col gap-2">
          {childrenOf(null).map(renderProject)}
        </ul>
      )}
    </section>
  )
}
