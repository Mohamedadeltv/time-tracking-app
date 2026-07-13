import { apiClient } from './client'
import type { Task } from './tasks'

export interface ProjectOverview {
  projectId: number
  projectName: string
  totalSeconds: number
  tasks: Task[]
}

export function getProjectOverview(
  projectId: number,
  from?: string,
  to?: string,
  userId?: number,
): Promise<ProjectOverview> {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (userId != null) params.set('userId', String(userId))
  const query = params.toString()
  return apiClient.get<ProjectOverview>(
    `/api/projects/${projectId}/overview${query ? `?${query}` : ''}`,
  )
}
