import { apiClient } from './client'

export interface Project {
  id: number
  name: string
  parentId: number | null
  totalSeconds: number
}

export function listProjects(): Promise<Project[]> {
  return apiClient.get<Project[]>('/api/projects')
}

export function createProject(name: string, parentId?: number | null): Promise<Project> {
  return apiClient.post<Project>('/api/projects', { name, parentId: parentId ?? null })
}

export function updateProject(
  id: number,
  name: string,
  parentId?: number | null,
): Promise<Project> {
  return apiClient.put<Project>(`/api/projects/${id}`, { name, parentId: parentId ?? null })
}

export function deleteProject(id: number): Promise<void> {
  return apiClient.delete<void>(`/api/projects/${id}`)
}
