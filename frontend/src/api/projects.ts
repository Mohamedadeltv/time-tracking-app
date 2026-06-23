import { apiClient } from './client'

export interface Project {
  id: number
  name: string
}

export function listProjects(): Promise<Project[]> {
  return apiClient.get<Project[]>('/api/projects')
}

export function createProject(name: string): Promise<Project> {
  return apiClient.post<Project>('/api/projects', { name })
}

export function updateProject(id: number, name: string): Promise<Project> {
  return apiClient.put<Project>(`/api/projects/${id}`, { name })
}

export function deleteProject(id: number): Promise<void> {
  return apiClient.delete<void>(`/api/projects/${id}`)
}
