import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { getProjectOverview, type ProjectOverview } from '../api/overview'
import { listProjects, type Project } from '../api/projects'
import { listTasks, type Task } from '../api/tasks'
import { formatDuration } from '../utils/duration'

type Period = 'day' | 'week' | 'month'

const PERIOD_LABELS: Record<Period, string> = {
  day: 'Today',
  week: 'This week',
  month: 'This month',
}

function startOfPeriod(now: Date, period: Period): Date {
  if (period === 'day') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }
  if (period === 'week') {
    const daysSinceMonday = (now.getDay() + 6) % 7
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday)
  }
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

function endOfPeriod(start: Date, period: Period): Date {
  const end = new Date(start)
  if (period === 'day') {
    end.setDate(end.getDate() + 1)
  } else if (period === 'week') {
    end.setDate(end.getDate() + 7)
  } else {
    end.setMonth(end.getMonth() + 1)
  }
  return end
}

function periodRange(period: Period): { from: string; to: string } {
  const start = startOfPeriod(new Date(), period)
  const end = endOfPeriod(start, period)
  return { from: start.toISOString(), to: end.toISOString() }
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString()
}

function totalSecondsOf(tasks: Task[]): number {
  return tasks
    .filter((task) => task.endTime)
    .reduce(
      (sum, task) =>
        sum + (new Date(task.endTime as string).getTime() - new Date(task.startTime).getTime()) / 1000,
      0,
    )
}

function flattenHierarchy(projects: Project[]): { project: Project; depth: number }[] {
  const childrenByParentId = new Map<number | null, Project[]>()
  for (const project of projects) {
    const siblings = childrenByParentId.get(project.parentId) ?? []
    siblings.push(project)
    childrenByParentId.set(project.parentId, siblings)
  }
  const result: { project: Project; depth: number }[] = []
  function visit(parentId: number | null, depth: number) {
    for (const project of childrenByParentId.get(parentId) ?? []) {
      result.push({ project, depth })
      visit(project.id, depth + 1)
    }
  }
  visit(null, 0)
  return result
}

function TaskTable({ tasks }: { tasks: Task[] }) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b text-slate-500">
          <th className="py-1 pr-2">Description</th>
          <th className="py-1 pr-2">Start</th>
          <th className="py-1 pr-2">End</th>
          <th className="py-1 pr-2">Projects</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr key={task.id} className="border-b">
            <td className="py-1 pr-2">{task.description || 'Untitled task'}</td>
            <td className="py-1 pr-2">{formatTimestamp(task.startTime)}</td>
            <td className="py-1 pr-2">{task.endTime ? formatTimestamp(task.endTime) : 'Running'}</td>
            <td className="py-1 pr-2">
              {task.projects.length > 0 ? task.projects.map((p) => p.name).join(', ') : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function Overview({ projectsRefreshSignal }: { projectsRefreshSignal?: number } = {}) {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsError, setProjectsError] = useState<string | null>(null)

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [fromInput, setFromInput] = useState('')
  const [toInput, setToInput] = useState('')
  const [projectOverview, setProjectOverview] = useState<ProjectOverview | null>(null)
  const [projectOverviewError, setProjectOverviewError] = useState<string | null>(null)
  const [loadingProjectOverview, setLoadingProjectOverview] = useState(false)

  const [period, setPeriod] = useState<Period | null>(null)
  const [periodTasks, setPeriodTasks] = useState<Task[] | null>(null)
  const [periodError, setPeriodError] = useState<string | null>(null)
  const [loadingPeriod, setLoadingPeriod] = useState(false)

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch(() => setProjectsError('Could not load projects.'))
  }, [projectsRefreshSignal])

  const orderedProjects = useMemo(() => flattenHierarchy(projects), [projects])

  async function handleShowProject(event: FormEvent) {
    event.preventDefault()
    if (selectedProjectId == null) {
      return
    }
    setProjectOverviewError(null)
    setLoadingProjectOverview(true)
    try {
      const from = fromInput ? new Date(fromInput).toISOString() : undefined
      const to = toInput ? new Date(toInput).toISOString() : undefined
      const overview = await getProjectOverview(selectedProjectId, from, to)
      setProjectOverview(overview)
    } catch (err) {
      setProjectOverviewError(
        err instanceof ApiError ? err.message : 'Could not load the project overview.',
      )
    } finally {
      setLoadingProjectOverview(false)
    }
  }

  async function handleShowPeriod(nextPeriod: Period) {
    setPeriod(nextPeriod)
    setPeriodError(null)
    setLoadingPeriod(true)
    try {
      const { from, to } = periodRange(nextPeriod)
      const tasks = await listTasks(from, to)
      setPeriodTasks(tasks)
    } catch {
      setPeriodError('Could not load tasks for this period.')
    } finally {
      setLoadingPeriod(false)
    }
  }

  return (
    <section className="flex w-full max-w-2xl flex-col gap-6 rounded-lg bg-white p-8 shadow">
      <h2 className="text-lg font-semibold text-slate-900">Overview</h2>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-900">By project</h3>
        {projectsError && <p className="text-sm text-red-600">{projectsError}</p>}

        <form onSubmit={handleShowProject} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            Project
            <select
              required
              aria-label="Project"
              value={selectedProjectId ?? ''}
              onChange={(e) =>
                setSelectedProjectId(e.target.value ? Number(e.target.value) : null)
              }
              className="rounded border border-slate-300 px-2 py-1"
            >
              <option value="">Select a project</option>
              {orderedProjects.map(({ project, depth }) => (
                <option key={project.id} value={project.id}>
                  {'— '.repeat(depth)}
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            From
            <input
              type="datetime-local"
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            To
            <input
              type="datetime-local"
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            Show
          </button>
        </form>

        {projectOverviewError && <p className="text-sm text-red-600">{projectOverviewError}</p>}
        {loadingProjectOverview && <p className="text-sm text-slate-500">Loading…</p>}

        {projectOverview && !loadingProjectOverview && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-slate-700">
              Total time on <span className="font-medium">{projectOverview.projectName}</span>{' '}
              (incl. subprojects):{' '}
              <span className="font-mono">{formatDuration(projectOverview.totalSeconds)}</span>
            </p>
            {projectOverview.tasks.length === 0 ? (
              <p className="text-sm text-slate-500">No tasks in this range.</p>
            ) : (
              <TaskTable tasks={projectOverview.tasks} />
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-slate-900">By period</h3>
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handleShowPeriod(p)}
              aria-pressed={period === p}
              className={`rounded px-3 py-1 text-sm font-medium ${
                period === p ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {periodError && <p className="text-sm text-red-600">{periodError}</p>}
        {loadingPeriod && <p className="text-sm text-slate-500">Loading…</p>}

        {periodTasks && !loadingPeriod && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-slate-700">
              Total tracked time:{' '}
              <span className="font-mono">{formatDuration(totalSecondsOf(periodTasks))}</span>
            </p>
            {periodTasks.length === 0 ? (
              <p className="text-sm text-slate-500">No tasks in this period.</p>
            ) : (
              <TaskTable tasks={periodTasks} />
            )}
          </div>
        )}
      </div>
    </section>
  )
}
