import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ScreenShell, { IconBtn } from '../components/ScreenShell'
import { colors, radius } from '../constants/theme'
import { fetchAllTasks, type Task } from '../api/tasks'

const PROJECT_ID = 1

// Pill color per trade
function getPillStyle(trade: string | null): { bg: string; text: string } {
  if (!trade) return { bg: '#f1f5f9', text: '#64748b' }
  const l = trade.toLowerCase()
  if (l.includes('electrical')) return { bg: colors.orangeSoft, text: '#b45309' }
  if (l.includes('plumbing'))   return { bg: colors.blueSoft,   text: colors.blueDeep }
  if (l.includes('concrete'))   return { bg: colors.greenSoft,  text: '#087d35' }
  if (l.includes('framing'))    return { bg: '#faf5ff',          text: '#7c3aed' }
  if (l.includes('safety'))     return { bg: colors.redSoft,    text: colors.red }
  return { bg: colors.orangeSoft, text: '#b45309' }
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const TABS = ['Weekly', 'Monthly', 'Schedule']

export default function Plans() {
  const navigate    = useNavigate()
  const [tasks, setTasks]     = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(0)

  useEffect(() => {
    setLoading(true)
    setError(null)
    async function load() {
      try {
        const all = await fetchAllTasks(PROJECT_ID)
        setTasks(Array.isArray(all) ? all : [])
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load tasks')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Sort by start_date for the timeline view
  const sorted = [...tasks].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  )

  return (
    <ScreenShell
      title="Plans & deliveries"
      subtitle="This week"
      leftAction={<IconBtn onClick={() => navigate(-1)}>‹</IconBtn>}
    >
      {/* Tabs */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        borderBottom: `1px solid ${colors.line}`,
        padding: '0 18px',
      }}>
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            style={{
              background: 'none',
              border: 'none',
              padding: '13px 0',
              fontSize: '13px',
              fontWeight: activeTab === i ? 800 : 500,
              color: activeTab === i ? colors.blueDeep : '#475467',
              borderBottom: `2px solid ${activeTab === i ? colors.blue : 'transparent'}`,
              cursor: 'pointer',
              letterSpacing: activeTab === i ? '-0.01em' : 0,
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ padding: '14px 18px 0' }}>
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

        {!loading && !error && sorted.length === 0 && (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: colors.muted, fontSize: '14px' }}>
            No tasks found. Upload a schedule to get started.
          </div>
        )}

        {/* Timeline events */}
        {!loading && !error && sorted.map(task => {
          const d   = new Date(task.start_date + 'T00:00:00')
          const day = d.getDate()
          const dow = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
          const pill = getPillStyle(task.trade_tag)

          const isToday = task.start_date === new Date().toISOString().split('T')[0]

          return (
            <div
              key={task.id}
              onClick={() => navigate(`/task/${task.id}`)}
              style={{
                display: 'grid',
                gridTemplateColumns: '54px 1fr auto',
                gap: '12px',
                alignItems: 'center',
                padding: '12px',
                border: `1px solid ${colors.line}`,
                borderRadius: '20px',
                marginBottom: '10px',
                cursor: 'pointer',
                background: '#fff',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = colors.surface2)}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              {/* Date box */}
              <div style={{
                height: '52px',
                borderRadius: '16px',
                background: isToday ? colors.blueSoft : '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1px',
              }}>
                <span style={{
                  fontSize: '9px',
                  color: isToday ? colors.blue : colors.muted,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                }}>
                  {dow}
                </span>
                <span style={{
                  fontSize: '20px',
                  fontWeight: 900,
                  letterSpacing: '-0.04em',
                  color: isToday ? colors.blue : colors.text,
                  lineHeight: 1,
                }}>
                  {day}
                </span>
              </div>

              {/* Task info */}
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontWeight: 800,
                  fontSize: '14px',
                  letterSpacing: '-0.02em',
                  color: colors.text,
                  marginBottom: '2px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {task.name}
                </div>
                <div style={{ fontSize: '12px', color: colors.muted }}>
                  {task.level_tag}
                  {task.trade_tag ? ` · ${formatDate(task.start_date)} – ${formatDate(task.end_date)}` : ''}
                </div>
              </div>

              {/* Trade pill */}
              {task.trade_tag ? (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  borderRadius: '999px',
                  padding: '7px 9px',
                  background: pill.bg,
                  color: pill.text,
                  whiteSpace: 'nowrap',
                }}>
                  {task.trade_tag}
                </span>
              ) : isToday ? (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  borderRadius: '999px',
                  padding: '7px 9px',
                  background: colors.orangeSoft,
                  color: '#b45309',
                }}>
                  Today
                </span>
              ) : null}
            </div>
          )
        })}
      </div>
    </ScreenShell>
  )
}
