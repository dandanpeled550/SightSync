import api from './client'

export interface Incident {
  id: number
  daily_log_id: number
  incident_type: string
  description: string
  people_involved: string | null
  corrective_action: string | null
  photo_url: string | null
}

export interface IncidentWithDate extends Incident {
  date: string
}

export interface IncidentCreate {
  description: string
  photo_url?: string
}

export async function fetchIncidents(logId: number): Promise<Incident[]> {
  const res = await api.get<Incident[]>(`/daily-logs/${logId}/incidents`)
  return res.data
}

export async function createIncident(logId: number, data: IncidentCreate): Promise<Incident> {
  const res = await api.post<Incident>(`/daily-logs/${logId}/incidents`, data)
  return res.data
}

export async function deleteIncident(logId: number, incidentId: number): Promise<void> {
  await api.delete(`/daily-logs/${logId}/incidents/${incidentId}`)
}

export async function fetchAllProjectIncidents(projectId: number): Promise<IncidentWithDate[]> {
  const res = await api.get<IncidentWithDate[]>(`/projects/${projectId}/incidents`)
  return res.data
}

export async function uploadIncidentPhoto(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post<{ url: string }>('/uploads/photo', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.url
}
