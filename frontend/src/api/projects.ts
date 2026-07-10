import { apiClient } from './client'

export interface Project {
  id: number
  name: string
  parentId: number | null
  totalSeconds: number
  ownerId: number
  budgetHours?: number | null
}

export interface Member {
  userId: number
  email: string
  role: 'OWNER' | 'MEMBER'
}

export function listProjects(): Promise<Project[]> {
  return apiClient.get<Project[]>('/api/projects')
}

export function createProject(
  name: string,
  parentId?: number | null,
  budgetHours?: number | null,
): Promise<Project> {
  return apiClient.post<Project>('/api/projects', {
    name,
    parentId: parentId ?? null,
    budgetHours: budgetHours ?? null,
  })
}

export function updateProject(
  id: number,
  name: string,
  parentId?: number | null,
  budgetHours?: number | null,
): Promise<Project> {
  return apiClient.put<Project>(`/api/projects/${id}`, {
    name,
    parentId: parentId ?? null,
    budgetHours: budgetHours ?? null,
  })
}

export function deleteProject(id: number): Promise<void> {
  return apiClient.delete<void>(`/api/projects/${id}`)
}

export function listMembers(projectId: number): Promise<Member[]> {
  return apiClient.get<Member[]>(`/api/projects/${projectId}/members`)
}

export function inviteMember(projectId: number, email: string): Promise<Member> {
  return apiClient.post<Member>(`/api/projects/${projectId}/members`, { email })
}

export function removeMember(projectId: number, userId: number): Promise<void> {
  return apiClient.delete<void>(`/api/projects/${projectId}/members/${userId}`)
}
