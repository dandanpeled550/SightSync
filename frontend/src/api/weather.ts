import api from './client'

export interface CityResult {
  name: string
  country: string
  country_code: string
  admin1?: string
  latitude: number
  longitude: number
}

export async function searchCities(query: string): Promise<CityResult[]> {
  if (!query.trim()) return []
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.results ?? []) as CityResult[]
}

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
