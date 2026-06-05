import api from './client'

export interface CrewMember {
  id: number
  project_id: number
  name: string
  id_number: string | null
  profession: string | null
  reason: string | null
}

export interface AttendanceRecord {
  crew_member_id: number
  name: string
  id_number: string | null
  profession: string | null
  status: 'present' | 'absent' | 'partial'
  note: string | null
}

export interface CrewMemberCreate {
  name: string
  id_number?: string
  profession?: string
  reason?: string
}

// Crew registry
export async function fetchCrew(projectId: number): Promise<CrewMember[]> {
  const res = await api.get<CrewMember[]>(`/projects/${projectId}/crew`)
  return res.data
}

export async function addCrewMember(projectId: number, data: CrewMemberCreate): Promise<CrewMember> {
  const res = await api.post<CrewMember>(`/projects/${projectId}/crew`, data)
  return res.data
}

export async function updateCrewMember(memberId: number, data: CrewMemberCreate): Promise<CrewMember> {
  const res = await api.put<CrewMember>(`/crew/${memberId}`, data)
  return res.data
}

export async function deleteCrewMember(memberId: number): Promise<void> {
  await api.delete(`/crew/${memberId}`)
}

// Daily attendance
export async function fetchAttendance(logId: number): Promise<AttendanceRecord[]> {
  const res = await api.get<AttendanceRecord[]>(`/daily-logs/${logId}/attendance`)
  return res.data
}

export async function upsertAttendance(
  logId: number,
  memberId: number,
  status: string,
  note?: string
): Promise<AttendanceRecord> {
  const res = await api.put<AttendanceRecord>(`/daily-logs/${logId}/attendance/${memberId}`, { status, note })
  return res.data
}
