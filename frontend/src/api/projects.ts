import api from './client'

export interface Project {
  id: number
  name: string
  location_city: string
  latitude: number
  longitude: number
}

export interface CreateProjectPayload {
  name: string
  location_city: string
  latitude: number
  longitude: number
}

export async function fetchProjects(): Promise<Project[]> {
  const res = await api.get<Project[]>('/projects')
  return res.data
}

export async function createProject(payload: CreateProjectPayload): Promise<Project> {
  const res = await api.post<Project>('/projects', payload)
  return res.data
}

export async function addMember(projectId: number, email: string, role = 'member'): Promise<void> {
  await api.post(`/projects/${projectId}/members`, { email, role })
}

export async function removeMember(projectId: number, userId: number): Promise<void> {
  await api.delete(`/projects/${projectId}/members/${userId}`)
}
