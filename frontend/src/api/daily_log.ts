import api from './client'

export interface WeatherData {
  temp_max: number | null
  temp_min: number | null
  conditions: string | null
  precipitation: number | null
  wind_speed: number | null
  error: string | null
}

export interface DailyLog {
  id: number
  project_id: number
  date: string
  weather: WeatherData
  submitted?: boolean
  ai_summary?: string | null
}

export async function fetchTodayLog(projectId: number): Promise<DailyLog> {
  const res = await api.post<DailyLog>(`/projects/${projectId}/daily-logs/today`)
  return res.data
}

export async function fetchLogByDate(projectId: number, date: string): Promise<DailyLog> {
  const res = await api.get<DailyLog>(`/projects/${projectId}/daily-logs/${date}`)
  return res.data
}

export async function refetchWeather(projectId: number, logId: number): Promise<DailyLog> {
  const res = await api.post<DailyLog>(`/projects/${projectId}/daily-logs/${logId}/refetch-weather`)
  return res.data
}

export async function submitLog(projectId: number, logId: number): Promise<DailyLog> {
  const res = await api.post<DailyLog>(`/projects/${projectId}/daily-logs/${logId}/submit`)
  return res.data
}
