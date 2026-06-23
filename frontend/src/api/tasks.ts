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
