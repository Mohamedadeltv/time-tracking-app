import { apiClient } from './client'

export interface User {
  id: number
  email: string
  timezone?: string | null
  dailyGoalHours?: number | null
  weeklyGoalHours?: number | null
}

export function register(email: string, password: string): Promise<User> {
  return apiClient.post<User>('/api/auth/register', { email, password })
}

export function login(email: string, password: string): Promise<User> {
  return apiClient.post<User>('/api/auth/login', { email, password })
}

export function logout(): Promise<void> {
  return apiClient.post<void>('/api/auth/logout')
}

export function me(): Promise<User> {
  return apiClient.get<User>('/api/auth/me')
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiClient.post<void>('/api/auth/change-password', { currentPassword, newPassword })
}

export function setTimezone(timezone: string): Promise<User> {
  return apiClient.put<User>('/api/auth/timezone', { timezone })
}

export function setGoals(
  dailyGoalHours: number | null,
  weeklyGoalHours: number | null,
): Promise<User> {
  return apiClient.put<User>('/api/auth/goals', { dailyGoalHours, weeklyGoalHours })
}
