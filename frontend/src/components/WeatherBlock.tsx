import { WeatherData } from '../api/daily_log'

interface Props {
  weather: WeatherData
  date: string
}

export default function WeatherBlock({ weather, date }: Props) {
  if (weather.error) {
    return (
      <div style={styles.block}>
        <h3 style={styles.heading}>Weather — {date}</h3>
        <p style={styles.error}>Failed to fetch weather: {weather.error}</p>
      </div>
    )
  }

  return (
    <div style={styles.block}>
      <h3 style={styles.heading}>Weather — {date}</h3>
      <table style={styles.table}>
        <tbody>
          <tr>
            <td style={styles.label}>Conditions</td>
            <td>{weather.conditions ?? '—'}</td>
          </tr>
          <tr>
            <td style={styles.label}>High / Low</td>
            <td>
              {weather.temp_max != null ? `${Math.round(weather.temp_max)}°C` : '—'}
              {' / '}
              {weather.temp_min != null ? `${Math.round(weather.temp_min)}°C` : '—'}
            </td>
          </tr>
          <tr>
            <td style={styles.label}>Precipitation</td>
            <td>{weather.precipitation != null ? `${weather.precipitation.toFixed(1)} mm` : '—'}</td>
          </tr>
          <tr>
            <td style={styles.label}>Wind Speed</td>
            <td>{weather.wind_speed != null ? `${weather.wind_speed.toFixed(1)} km/h` : '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  block: {
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '1.25rem',
    marginBottom: '1.5rem',
    maxWidth: '480px',
  },
  heading: { margin: '0 0 1rem', fontSize: '1rem', color: '#333' },
  table: { borderCollapse: 'collapse', width: '100%' },
  label: { fontWeight: 600, paddingRight: '1.5rem', paddingBottom: '0.4rem', color: '#555', width: '140px' },
  error: { color: '#c0392b' },
}
