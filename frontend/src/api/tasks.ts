import { apiClient } from './client'

export interface TaskProject {
  id: number
  name: string
}

export interface Task {
  id: number
  description: string | null
  startTime: string
  endTime: string | null
  running: boolean
  projects: TaskProject[]
}

export function startTask(description?: string): Promise<Task> {
  return apiClient.post<Task>('/api/tasks/start', description ? { description } : undefined)
}

export function stopTask(): Promise<Task> {
  return apiClient.post<Task>('/api/tasks/stop')
}

export function getCurrentTask(): Promise<Task | undefined> {
  return apiClient.get<Task | undefined>('/api/tasks/current')
}

export interface CreateTaskInput {
  description?: string
  startTime: string
  endTime: string
  projectIds?: number[]
}

export interface UpdateTaskInput {
  description?: string
  startTime: string
  endTime: string | null
  projectIds?: number[]
}

export function listTasks(from?: string, to?: string): Promise<Task[]> {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const query = params.toString()
  return apiClient.get<Task[]>(`/api/tasks${query ? `?${query}` : ''}`)
}

export function createTask(input: CreateTaskInput): Promise<Task> {
  return apiClient.post<Task>('/api/tasks', input)
}

export function updateTask(id: number, input: UpdateTaskInput): Promise<Task> {
  return apiClient.put<Task>(`/api/tasks/${id}`, input)
}

export function deleteTask(id: number): Promise<void> {
  return apiClient.delete<void>(`/api/tasks/${id}`)
}
