import { useEffect, useState } from 'react'
import { fetchTodayLog, DailyLog } from './api/daily_log'
import WeatherBlock from './components/WeatherBlock'
import CrewAttendanceBlock from './components/CrewAttendanceBlock'
import CrewManagement from './pages/CrewManagement'

type View = 'log' | 'crew'

function App() {
  const [view, setView] = useState<View>('log')
  const [log, setLog] = useState<DailyLog | null>(null)
  const [logStatus, setLogStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [logError, setLogError] = useState('')

  useEffect(() => {
    fetchTodayLog()
      .then((data) => { setLog(data); setLogStatus('success') })
      .catch((err) => {
        setLogError(err?.response?.data?.detail ?? "Could not load today's log.")
        setLogStatus('error')
      })
  }, [])

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: '800px' }}>
      {/* Nav */}
      <div style={s.nav}>
        <strong style={s.brand}>simple.</strong>
        {(['log', 'crew'] as View[]).map((v) => (
          <button
            key={v}
            style={{ ...s.navBtn, ...(view === v ? s.navBtnActive : {}) }}
            onClick={() => setView(v)}
          >
            {v === 'log' ? "Today's Log" : 'Crew'}
          </button>
        ))}
      </div>

      {/* Today's Log */}
      {view === 'log' && (
        <div>
          <p style={s.dateLine}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          {logStatus === 'loading' && <p>Loading today's log...</p>}
          {logStatus === 'error' && <p style={s.error}>{logError}</p>}
          {logStatus === 'success' && log && (
            <>
              <WeatherBlock weather={log.weather} date={log.date} />
              <CrewAttendanceBlock logId={log.id} />
            </>
          )}
        </div>
      )}

      {/* Crew registry */}
      {view === 'crew' && <CrewManagement />}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  nav: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '2px solid #eee', paddingBottom: '0.75rem' },
  brand: { marginRight: '0.5rem', fontSize: '1.1rem', color: '#1a1a2e' },
  navBtn: { padding: '0.35rem 0.9rem', border: '1px solid #ddd', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.9rem', color: '#555' },
  navBtnActive: { background: '#1a1a2e', color: '#fff', borderColor: '#1a1a2e' },
  dateLine: { color: '#888', margin: '0 0 1.5rem', fontSize: '0.9rem' },
  error: { color: '#c0392b' },
}

export default App
