import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { buildExportUrl, type ExportFormat } from '../api/export'
import { getProjectOverview, type ProjectOverview } from '../api/overview'
import { listProjects, type Project } from '../api/projects'
import { listTasks, type Task } from '../api/tasks'
import { useAuth } from '../auth/useAuth'
import { formatDuration } from '../utils/duration'
import {
  addDays,
  addOneDay,
  addOneMonth,
  formatInTimezone,
  startOfDayInTimezone,
  startOfMonthInTimezone,
  startOfWeekInTimezone,
} from '../utils/timezone'

type Period = 'day' | 'week' | 'month'

const PERIOD_LABELS: Record<Period, string> = {
  day: 'Today',
  week: 'This week',
  month: 'This month',
}

function periodRange(period: Period, timezone: string): { from: string; to: string } {
  if (period === 'day') {
    const start = startOfDayInTimezone(timezone)
    return { from: start.toISOString(), to: addOneDay(start).toISOString() }
  }
  if (period === 'week') {
    const start = startOfWeekInTimezone(timezone)
    return { from: start.toISOString(), to: addDays(start, 7).toISOString() }
  }
  const start = startOfMonthInTimezone(timezone)
  return { from: start.toISOString(), to: addOneMonth(start, timezone).toISOString() }
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

function GoalBar({ label, used, goalHours }: { label: string; used: number; goalHours: number }) {
  const goalSeconds = goalHours * 3600
  const pct = Math.min(100, Math.round((used / goalSeconds) * 100))
  const met = used >= goalSeconds
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm text-slate-700">
        {label}: <span className="font-mono">{formatDuration(used)}</span> / {goalHours}h goal
        {met && <span className="ml-2 text-xs font-medium text-emerald-600">Goal reached</span>}
      </p>
      <span className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <span
          className="block h-full rounded-full bg-emerald-500"
          style={{ width: `${pct}%` }}
          aria-label={`${label} goal: ${pct}% reached`}
        />
      </span>
    </div>
  )
}

function TaskTable({ tasks, timezone }: { tasks: Task[]; timezone: string }) {
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
            <td className="py-1 pr-2">{formatInTimezone(task.startTime, timezone)}</td>
            <td className="py-1 pr-2">
              {task.endTime ? formatInTimezone(task.endTime, timezone) : 'Running'}
            </td>
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
  const { user } = useAuth()
  const timezone = user?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsError, setProjectsError] = useState<string | null>(null)

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [fromInput, setFromInput] = useState('')
  const [toInput, setToInput] = useState('')
  const [projectOverview, setProjectOverview] = useState<ProjectOverview | null>(null)
  const [projectOverviewError, setProjectOverviewError] = useState<string | null>(null)
  const [loadingProjectOverview, setLoadingProjectOverview] = useState(false)

  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv')
  const [exportAllTime, setExportAllTime] = useState(true)
  const [exportYear, setExportYear] = useState(new Date().getFullYear())
  const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1)

  const [period, setPeriod] = useState<Period | null>(null)
  const [periodTasks, setPeriodTasks] = useState<Task[] | null>(null)
  const [periodError, setPeriodError] = useState<string | null>(null)
  const [loadingPeriod, setLoadingPeriod] = useState(false)

  const [todaySeconds, setTodaySeconds] = useState(0)
  const [weekSeconds, setWeekSeconds] = useState(0)

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch(() => setProjectsError('Could not load projects.'))
  }, [projectsRefreshSignal])

  useEffect(() => {
    if (user?.dailyGoalHours == null && user?.weeklyGoalHours == null) {
      return
    }
    const today = periodRange('day', timezone)
    const week = periodRange('week', timezone)
    listTasks(today.from, today.to)
      .then((tasks) => setTodaySeconds(totalSecondsOf(tasks)))
      .catch(() => setTodaySeconds(0))
    listTasks(week.from, week.to)
      .then((tasks) => setWeekSeconds(totalSecondsOf(tasks)))
      .catch(() => setWeekSeconds(0))
  }, [user?.dailyGoalHours, user?.weeklyGoalHours, timezone, projectsRefreshSignal])

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

  function handleExport() {
    if (selectedProjectId == null) return
    let from: string | undefined
    let to: string | undefined
    if (!exportAllTime) {
      from = new Date(exportYear, exportMonth - 1, 1).toISOString()
      to = new Date(exportYear, exportMonth, 1).toISOString()
    }
    const url = buildExportUrl(selectedProjectId, exportFormat, from, to)
    const a = document.createElement('a')
    a.href = url
    a.click()
  }

  async function handleShowPeriod(nextPeriod: Period) {
    setPeriod(nextPeriod)
    setPeriodError(null)
    setLoadingPeriod(true)
    try {
      const { from, to } = periodRange(nextPeriod, timezone)
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

      {(user?.dailyGoalHours != null || user?.weeklyGoalHours != null) && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-slate-900">Time goals</h3>
          {user?.dailyGoalHours != null && (
            <GoalBar label="Today" used={todaySeconds} goalHours={user.dailyGoalHours} />
          )}
          {user?.weeklyGoalHours != null && (
            <GoalBar label="This week" used={weekSeconds} goalHours={user.weeklyGoalHours} />
          )}
        </div>
      )}

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
              <TaskTable tasks={projectOverview.tasks} timezone={timezone} />
            )}
          </div>
        )}
      </div>

      {selectedProjectId != null && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-slate-900">Export tasks</h3>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Format
              <select
                aria-label="Export format"
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                className="rounded border border-slate-300 px-2 py-1"
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Period
              <select
                aria-label="Export period"
                value={exportAllTime ? 'all' : 'month'}
                onChange={(e) => setExportAllTime(e.target.value === 'all')}
                className="rounded border border-slate-300 px-2 py-1"
              >
                <option value="all">All time</option>
                <option value="month">Specific month</option>
              </select>
            </label>
            {!exportAllTime && (
              <>
                <label className="flex flex-col gap-1 text-sm text-slate-700">
                  Year
                  <input
                    type="number"
                    aria-label="Export year"
                    value={exportYear}
                    onChange={(e) => setExportYear(Number(e.target.value))}
                    min={2000}
                    max={2100}
                    className="w-24 rounded border border-slate-300 px-2 py-1"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm text-slate-700">
                  Month
                  <input
                    type="number"
                    aria-label="Export month"
                    value={exportMonth}
                    onChange={(e) => setExportMonth(Number(e.target.value))}
                    min={1}
                    max={12}
                    className="w-20 rounded border border-slate-300 px-2 py-1"
                  />
                </label>
              </>
            )}
            <button
              type="button"
              onClick={handleExport}
              className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            >
              Download
            </button>
          </div>
        </div>
      )}

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
              <TaskTable tasks={periodTasks} timezone={timezone} />
            )}
          </div>
        )}
      </div>
    </section>
  )
}
