import DailyLogView from './pages/DailyLogView'
import LogEntryForm from './pages/LogEntryForm'
import CrewManagement from './pages/CrewManagement'
import { useState } from 'react'

type View = 'log' | 'entry' | 'crew'

const NAV: { id: View; label: string }[] = [
  { id: 'log', label: "Today's Log" },
  { id: 'entry', label: 'Log Entry' },
  { id: 'crew', label: 'Crew' },
]

export default function App() {
  const [view, setView] = useState<View>('log')
  const [logKey, setLogKey] = useState(0)

  function navigate(id: View) {
    if (id === 'log') setLogKey((k) => k + 1)
    setView(id)
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem', maxWidth: '860px' }}>
      <div style={s.nav}>
        <strong style={s.brand}>simple.</strong>
        {NAV.map(({ id, label }) => (
          <button
            key={id}
            style={{ ...s.navBtn, ...(view === id ? s.active : {}) }}
            onClick={() => navigate(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'log'   && <DailyLogView key={logKey} />}
      {view === 'entry' && <LogEntryForm />}
      {view === 'crew'  && <CrewManagement />}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  nav: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.75rem', borderBottom: '2px solid #eee', paddingBottom: '0.75rem' },
  brand: { marginRight: '0.75rem', fontSize: '1.1rem', color: '#1a1a2e', letterSpacing: '-0.5px' },
  navBtn: { padding: '0.35rem 0.9rem', border: '1px solid #ddd', borderRadius: '6px', background: '#fff', cursor: 'pointer', fontSize: '0.9rem', color: '#555' },
  active: { background: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e' },
}
