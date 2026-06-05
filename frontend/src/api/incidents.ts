import api from './client'

export interface Incident {
  id: number
  daily_log_id: number
  incident_type: string
  description: string
  people_involved: string | null
  corrective_action: string | null
}

export interface IncidentCreate {
  incident_type: string
  description: string
  people_involved?: string
  corrective_action?: string
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
