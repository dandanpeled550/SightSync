import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ScreenShell, { IconBtn } from '../components/ScreenShell'
import { colors, radius } from '../constants/theme'
import { fetchTodayLog } from '../api/daily_log'
import { fetchTodayTasks, markTaskDone, type Task } from '../api/tasks'

const PROJECT_ID = 1

const TRADE_ICONS: Record<string, string> = {
  electrical: '⚡',
  plumbing:   '🔧',
  concrete:   '🏗',
  framing:    '🪵',
  safety:     '🛡',
  cleanup:    '🧹',
  materials:  '📦',
  inspection: '🔎',
}

function getTradeIcon(trade: string | null): string {
  if (!trade) return '📋'
  const lower = trade.toLowerCase()
  for (const key of Object.keys(TRADE_ICONS)) {
    if (lower.includes(key)) return TRADE_ICONS[key]
  }
  return '📋'
}

function getTradeColor(trade: string | null): string {
  if (!trade) return colors.orangeSoft
  const lower = trade.toLowerCase()
  if (lower.includes('electrical'))                        return colors.orangeSoft
  if (lower.includes('safety'))                            return colors.blueSoft
  if (lower.includes('concrete') || lower.includes('framing')) return colors.greenSoft
  if (lower.includes('plumbing'))                          return colors.blueSoft
  return colors.orangeSoft
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Today() {
  const navigate = useNavigate()
  const [logId, setLogId]         = useState<number | null>(null)
  const [weather, setWeather]     = useState<string | null>(null)
  const [tasks, setTasks]         = useState<Task[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [markingId, setMarkingId] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const log = await fetchTodayLog()
        if (cancelled) return
        setLogId(log.id)
        // pull weather temp for the right-action chip
        const w = log.weather
        if (w && w.temp_max != null) {
          setWeather(`${Math.round(w.temp_max)}°`)
        }
        const todayTasks = await fetchTodayTasks(PROJECT_ID)
        if (cancelled) return
        setTasks(Array.isArray(todayTasks) ? todayTasks : [])
      } catch (err: unknown) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load today's tasks")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  async function handleDone(task: Task) {
    if (!logId || markingId) return
    setMarkingId(task.id)
    setTasks(prev => prev.filter(t => t.id !== task.id))
    try {
      await markTaskDone(logId, task.id)
      navigate('/report')
    } catch {
      setTasks(prev => [task, ...prev])
    } finally {
      setMarkingId(null)
    }
  }

  const today   = new Date()
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <ScreenShell
      title="Tower B"
      subtitle={dateStr}
      leftAction={
        <IconBtn>☰</IconBtn>
      }
      rightAction={
        weather ? (
          <span style={{ fontSize: '13px', color: colors.muted }}>☁️ {weather}</span>
        ) : undefined
      }
    >
      <div style={{ padding: '4px 18px 0' }}>
        <p style={{
          margin: '0 0 12px',
          fontWeight: 900,
          fontSize: '15px',
          letterSpacing: '-0.02em',
          color: colors.text,
        }}>
          Today's progress
        </p>

        {loading && (
          <div style={{ padding: '48px 0', textAlign: 'center', color: colors.muted, fontSize: '14px' }}>
            Loading…
          </div>
        )}

        {error && !loading && (
          <div style={{
            background: colors.redSoft,
            border: `1px solid #ffd0d0`,
            borderRadius: radius.card,
            padding: '16px',
            color: colors.red,
            fontSize: '14px',
          }}>
            {error}
          </div>
        )}

        {!loading && !error && tasks.length === 0 && (
          <div style={{
            textAlign: 'center',
            color: colors.muted,
            padding: '60px 20px',
            fontSize: '14px',
          }}>
            No tasks scheduled for today.
          </div>
        )}

        {!loading && !error && tasks.map(task => (
          <div
            key={task.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '42px 1fr 44px 44px',
              gap: '9px',
              alignItems: 'center',
              border: `1px solid ${colors.line}`,
              borderRadius: '20px',
              padding: '10px',
              marginBottom: '10px',
              background: colors.surface,
            }}
          >
            {/* Trade icon */}
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '16px',
              display: 'grid',
              placeItems: 'center',
              background: getTradeColor(task.trade_tag),
              fontSize: '20px',
            }}>
              {getTradeIcon(task.trade_tag)}
            </div>

            {/* Task info */}
            <div>
              <div style={{ fontWeight: 800, fontSize: '14px', letterSpacing: '-0.02em', color: colors.text }}>
                {task.name}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: colors.muted }}>
                {task.level_tag}{task.trade_tag ? ` · ${task.trade_tag}` : ''}
              </p>
              <p style={{ margin: '1px 0 0', fontSize: '11px', color: colors.mutedLight }}>
                {formatDate(task.start_date)} – {formatDate(task.end_date)}
              </p>
            </div>

            {/* Done ✓ */}
            <button
              onClick={() => handleDone(task)}
              disabled={markingId === task.id}
              style={{
                height: '44px',
                borderRadius: '14px',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 900,
                fontSize: '18px',
                cursor: markingId === task.id ? 'wait' : 'pointer',
                background: colors.greenSoft,
                color: colors.green,
                border: `1px solid #c7ead3`,
              }}
            >
              ✓
            </button>

            {/* Not done × */}
            <button
              onClick={() => navigate(`/task/${task.id}`)}
              disabled={!!markingId}
              style={{
                height: '44px',
                borderRadius: '14px',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 900,
                fontSize: '18px',
                cursor: markingId ? 'not-allowed' : 'pointer',
                background: colors.redSoft,
                color: colors.red,
                border: `1px solid #ffd0d0`,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate('/task/new')}
        style={{
          position: 'absolute',
          bottom: '72px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '58px',
          height: '58px',
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: 'linear-gradient(180deg,#3b82f6,#2563eb)',
          color: '#fff',
          fontSize: '30px',
          boxShadow: '0 12px 28px rgba(37,99,235,.28)',
          cursor: 'pointer',
          border: 'none',
          zIndex: 5,
        }}
      >
        +
      </button>
    </ScreenShell>
  )
}
