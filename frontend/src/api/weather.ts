import api from './client'

export interface DailyForecast {
  date: string
  max_temp: number
  min_temp: number
  weather_code: number
  precipitation: number
}

export interface WeatherResponse {
  city: string
  country: string
  latitude: number
  longitude: number
  forecast: DailyForecast[]
}

export async function fetchWeather(city: string): Promise<WeatherResponse> {
  const response = await api.get<WeatherResponse>('/weather', { params: { city } })
  return response.data
}
