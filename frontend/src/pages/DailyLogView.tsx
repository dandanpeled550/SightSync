import { useEffect, useState } from 'react'
import { fetchTodayLog, fetchLogByDate, DailyLog } from '../api/daily_log'
import WeatherBlock from '../components/WeatherBlock'
import CrewAttendanceBlock from '../components/CrewAttendanceBlock'
import SafetyBlock from '../components/SafetyBlock'
import MaterialsBlock from '../components/MaterialsBlock'

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function formatDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default function DailyLogView() {
  const [log, setLog] = useState<DailyLog | null>(null)
  const [status, setStatus] = useState<'loading' | 'success' | 'empty' | 'error'>('loading')
  const [currentDate, setCurrentDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const isToday = currentDate === new Date().toISOString().slice(0, 10)

  useEffect(() => {
    setStatus('loading')
    setLog(null)
    const load = isToday
      ? fetchTodayLog()
      : fetchLogByDate(currentDate)

    load
      .then((data) => { setLog(data); setStatus('success') })
      .catch((err) => {
        if (err?.response?.status === 404) setStatus('empty')
        else setStatus('error')
      })
  }, [currentDate])

  function navigate(n: number) {
    setCurrentDate((d) => addDays(d, n))
  }

  return (
    <div>
      {/* Date navigator */}
      <div style={s.nav}>
        <button style={s.arrow} onClick={() => navigate(-1)}>← Prev</button>
        <span style={s.dateLabel}>{formatDate(currentDate)}</span>
        <button
          style={{ ...s.arrow, ...(isToday ? s.arrowDisabled : {}) }}
          onClick={() => navigate(1)}
          disabled={isToday}
        >Next →</button>
      </div>

      {status === 'loading' && <p style={s.muted}>Loading…</p>}

      {status === 'error' && <p style={s.error}>Failed to load log for this date.</p>}

      {status === 'empty' && (
        <div>
          <p style={s.muted}>No log recorded for this date.</p>
          <WeatherBlock weather={{ temp_max: null, temp_min: null, conditions: null, precipitation: null, wind_speed: null, error: null }} date={currentDate} />
          <div style={s.emptyBlock}><strong>Crew Attendance</strong><p style={s.muted}>No data.</p></div>
          <div style={s.emptyBlock}><strong>Safety Incidents</strong><p style={s.muted}>None.</p></div>
          <div style={s.emptyBlock}><strong>Materials Used</strong><p style={s.muted}>None.</p></div>
        </div>
      )}

      {status === 'success' && log && (
        <>
          <WeatherBlock weather={log.weather} date={log.date} />
          <CrewAttendanceBlock logId={log.id} readOnly />
          <SafetyBlock logId={log.id} readOnly />
          <MaterialsBlock logId={log.id} readOnly />
        </>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  nav: { display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' },
  arrow: { padding: '0.35rem 0.8rem', border: '1px solid #ddd', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.88rem', color: '#333' },
  arrowDisabled: { opacity: 0.35, cursor: 'not-allowed' },
  dateLabel: { flex: 1, textAlign: 'center', fontWeight: 600, color: '#333', fontSize: '0.95rem' },
  muted: { color: '#888', fontSize: '0.9rem' },
  error: { color: '#c0392b' },
  emptyBlock: { border: '1px solid #eee', borderRadius: '8px', padding: '1rem 1.25rem', marginBottom: '1.5rem', color: '#555' },
}
