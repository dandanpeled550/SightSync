import { useState } from 'react'
import { fetchWeather, WeatherResponse, DailyForecast } from '../api/weather'

type Status = 'idle' | 'loading' | 'success' | 'error'

interface State {
  status: Status
  data: WeatherResponse | null
  errorMessage: string
}

function wmoToEmoji(code: number): string {
  if (code === 0) return '☀️'
  if (code <= 3) return '⛅'
  if (code <= 48) return '🌫️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '❄️'
  if (code <= 82) return '🌦️'
  return '⛈️'
}

function wmoToLabel(code: number): string {
  if (code === 0) return 'Clear'
  if (code <= 3) return 'Partly Cloudy'
  if (code <= 48) return 'Foggy'
  if (code <= 67) return 'Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Showers'
  return 'Thunderstorm'
}

function ForecastCard({ day }: { day: DailyForecast }) {
  const label = new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
  return (
    <div style={styles.card}>
      <p style={styles.cardDate}>{label}</p>
      <span style={styles.emoji}>{wmoToEmoji(day.weather_code)}</span>
      <p style={styles.cardLabel}>{wmoToLabel(day.weather_code)}</p>
      <p style={styles.temps}>
        <span style={styles.tempHigh}>{Math.round(day.max_temp)}°</span>
        {' / '}
        <span style={styles.tempLow}>{Math.round(day.min_temp)}°</span>
      </p>
      <p style={styles.precip}>
        {day.precipitation > 0 ? `💧 ${day.precipitation.toFixed(1)} mm` : 'No rain'}
      </p>
    </div>
  )
}

export default function WeatherPOC() {
  const [query, setQuery] = useState('')
  const [state, setState] = useState<State>({ status: 'idle', data: null, errorMessage: '' })

  async function handleSearch() {
    if (!query.trim()) return
    setState({ status: 'loading', data: null, errorMessage: '' })
    try {
      const data = await fetchWeather(query.trim())
      setState({ status: 'success', data, errorMessage: '' })
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Could not fetch weather. Try again.'
      setState({ status: 'error', data: null, errorMessage: detail })
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>7-Day Weather Forecast</h2>

      <div style={styles.searchRow}>
        <input
          style={styles.input}
          type="text"
          placeholder="Enter city name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={state.status === 'loading'}
        />
        <button
          style={{
            ...styles.button,
            opacity: state.status === 'loading' || !query.trim() ? 0.6 : 1,
            cursor: state.status === 'loading' || !query.trim() ? 'not-allowed' : 'pointer',
          }}
          onClick={handleSearch}
          disabled={state.status === 'loading' || !query.trim()}
        >
          {state.status === 'loading' ? 'Searching...' : 'Search'}
        </button>
      </div>

      {state.status === 'loading' && <p style={styles.muted}>Fetching forecast...</p>}

      {state.status === 'error' && <p style={styles.error}>{state.errorMessage}</p>}

      {state.status === 'success' && state.data && (
        <div>
          <h3 style={styles.cityHeading}>
            {state.data.city}, {state.data.country}
          </h3>
          <div style={styles.forecastGrid}>
            {state.data.forecast.map((day) => (
              <ForecastCard key={day.date} day={day} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '1.5rem 0', maxWidth: '900px' },
  heading: { marginBottom: '1rem', color: '#1a1a2e' },
  searchRow: { display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' },
  input: {
    flex: 1,
    padding: '0.6rem 1rem',
    fontSize: '1rem',
    border: '1px solid #ccc',
    borderRadius: '6px',
    outline: 'none',
  },
  button: {
    padding: '0.6rem 1.4rem',
    fontSize: '1rem',
    backgroundColor: '#4f6ef7',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    transition: 'opacity 0.15s',
  },
  muted: { color: '#777' },
  error: { color: '#c0392b', fontWeight: 'bold' },
  cityHeading: { marginBottom: '1rem', color: '#333' },
  forecastGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '0.75rem',
  },
  card: {
    background: '#f0f4ff',
    borderRadius: '10px',
    padding: '1rem 0.75rem',
    textAlign: 'center',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
  },
  cardDate: { fontSize: '0.78rem', fontWeight: 600, color: '#555', margin: '0 0 0.4rem' },
  emoji: { fontSize: '2rem', lineHeight: '1' },
  cardLabel: { fontSize: '0.72rem', color: '#666', margin: '0.3rem 0' },
  temps: { margin: '0.4rem 0 0.2rem', fontSize: '0.95rem' },
  tempHigh: { fontWeight: 700, color: '#e07b39' },
  tempLow: { color: '#3a86c8' },
  precip: { fontSize: '0.72rem', color: '#888', margin: 0 },
}
