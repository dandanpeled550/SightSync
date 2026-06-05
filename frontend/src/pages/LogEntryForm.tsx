import { useEffect, useState } from 'react'
import { fetchTodayLog, fetchLogByDate, refetchWeather, DailyLog } from '../api/daily_log'
import WeatherBlock from '../components/WeatherBlock'
import CrewAttendanceBlock from '../components/CrewAttendanceBlock'
import SafetyBlock from '../components/SafetyBlock'
import MaterialsBlock from '../components/MaterialsBlock'

export default function LogEntryForm() {
  const todayIso = new Date().toISOString().slice(0, 10)
  const [selectedDate, setSelectedDate] = useState(todayIso)
  const [log, setLog] = useState<DailyLog | null>(null)
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [refetching, setRefetching] = useState(false)

  useEffect(() => {
    setStatus('loading')
    setLog(null)
    const isToday = selectedDate === todayIso
    const load = isToday ? fetchTodayLog() : fetchLogByDate(selectedDate)
    load
      .then((data) => { setLog(data); setStatus('success') })
      .catch(() => setStatus('error'))
  }, [selectedDate])

  async function handleRefetchWeather() {
    if (!log) return
    setRefetching(true)
    try {
      const updated = await refetchWeather(log.id)
      setLog(updated)
    } finally {
      setRefetching(false)
    }
  }

  return (
    <div>
      {/* Date selector */}
      <div style={s.datePicker}>
        <label style={s.label}>Date</label>
        <input
          type="date"
          style={s.dateInput}
          value={selectedDate}
          max={todayIso}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      {status === 'loading' && <p style={s.muted}>Loading…</p>}
      {status === 'error' && <p style={s.error}>No log found for this date. Select today to create one.</p>}

      {status === 'success' && log && (
        <>
          {/* Weather */}
          <div style={s.section}>
            <WeatherBlock weather={log.weather} date={log.date} />
            <button style={s.refetchBtn} onClick={handleRefetchWeather} disabled={refetching}>
              {refetching ? 'Fetching…' : '↺ Re-fetch Weather'}
            </button>
          </div>

          {/* Crew attendance — auto-saves on toggle */}
          <CrewAttendanceBlock logId={log.id} />

          {/* Safety incidents — add / delete inline */}
          <SafetyBlock logId={log.id} />

          {/* Materials — add / delete inline */}
          <MaterialsBlock logId={log.id} />
        </>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  datePicker: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' },
  label: { fontWeight: 600, color: '#555', fontSize: '0.9rem' },
  dateInput: { padding: '0.35rem 0.6rem', border: '1px solid #ccc', borderRadius: '6px', fontSize: '0.9rem' },
  muted: { color: '#888', fontSize: '0.9rem' },
  error: { color: '#c0392b' },
  section: { marginBottom: '0.5rem' },
  refetchBtn: { marginBottom: '1.5rem', padding: '0.35rem 0.9rem', border: '1px solid #3498db', borderRadius: '6px', background: '#fff', color: '#3498db', cursor: 'pointer', fontSize: '0.85rem' },
}
