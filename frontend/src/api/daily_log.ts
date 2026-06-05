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
}

export async function fetchTodayLog(): Promise<DailyLog> {
  const res = await api.post<DailyLog>('/daily-logs/today')
  return res.data
}

export async function fetchLogByDate(date: string): Promise<DailyLog> {
  const res = await api.get<DailyLog>(`/daily-logs/${date}`)
  return res.data
}
