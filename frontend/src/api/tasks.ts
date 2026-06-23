import { apiClient } from './client'

export interface Task {
  id: number
  description: string | null
  startTime: string
  endTime: string | null
  running: boolean
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
}

export interface UpdateTaskInput {
  description?: string
  startTime: string
  endTime: string | null
}

export function listTasks(): Promise<Task[]> {
  return apiClient.get<Task[]>('/api/tasks')
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
