import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ScreenShell, { IconBtn } from '../components/ScreenShell'
import { colors, radius, shadow } from '../constants/theme'
import { fetchAllTasks, type Task } from '../api/tasks'

const PROJECT_ID = 1

function getPillStyle(trade: string | null): { bg: string; text: string; solid: string } {
  if (!trade) return { bg: '#f1f5f9', text: '#64748b', solid: '#64748b' }
  const l = trade.toLowerCase()
  if (l.includes('electrical')) return { bg: colors.orangeSoft, text: '#b45309',     solid: colors.orange }
  if (l.includes('plumbing'))   return { bg: colors.blueSoft,   text: colors.blueDeep, solid: colors.blue }
  if (l.includes('concrete'))   return { bg: colors.greenSoft,  text: '#087d35',     solid: colors.green }
  if (l.includes('framing'))    return { bg: '#faf5ff',          text: '#7c3aed',     solid: '#7c3aed' }
  if (l.includes('safety'))     return { bg: colors.redSoft,    text: colors.red,    solid: colors.red }
  return { bg: colors.orangeSoft, text: '#b45309', solid: colors.orange }
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

  const sorted = [...tasks].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  )

  return (
    <ScreenShell
      title="Plans & deliveries"
      subtitle="This week"
      leftAction={<IconBtn onClick={() => navigate(-1)}>‹</IconBtn>}
    >
      {/* Segmented pill tabs */}
      <div style={{ padding: '16px 24px 0' }}>
        <div style={{
          display: 'inline-flex',
          background: colors.surface2,
          border: `1px solid ${colors.line}`,
          borderRadius: '999px',
          padding: '4px',
          gap: '2px',
        }}>
          {TABS.map((tab, i) => {
            const active = activeTab === i
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(i)}
                style={{
                  background: active ? colors.blue : 'transparent',
                  color: active ? colors.surface : colors.muted,
                  border: 'none',
                  borderRadius: '999px',
                  padding: '7px 18px',
                  fontSize: '13px',
                  fontWeight: active ? 800 : 500,
                  cursor: 'pointer',
                  boxShadow: active ? shadow.card : 'none',
                  transition: 'all 0.15s',
                  letterSpacing: active ? '-0.01em' : 0,
                }}
              >
                {tab}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ padding: '14px 24px 0' }}>
        {loading && [0,1,2,3].map(i => (
          <div key={i} className="shimmer" style={{ height: '68px', borderRadius: '20px', marginBottom: '10px' }} />
        ))}

        {error && !loading && (
          <div style={{
            background: colors.redSoft,
            border: `1px solid ${colors.redBorder}`,
            borderRadius: radius.card,
            padding: '16px',
            color: colors.red,
            fontSize: '14px',
          }}>
            {error}
          </div>
        )}

        {!loading && !error && sorted.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '48px 20px',
            gap: '12px',
            textAlign: 'center',
          }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: colors.blueSoft, display: 'grid', placeItems: 'center', fontSize: '36px',
            }}>📅</div>
            <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.04em', color: colors.text }}>
              No schedule yet
            </div>
            <div style={{ fontSize: '14px', color: colors.muted }}>Upload a schedule to get started.</div>
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
              className="fade-up"
              style={{
                display: 'grid',
                gridTemplateColumns: '54px 1fr auto',
                gap: '12px',
                alignItems: 'center',
                padding: '12px',
                border: `1px solid ${colors.line}`,
                borderLeft: `4px solid ${pill.solid}`,
                borderRadius: '20px',
                marginBottom: '10px',
                cursor: 'pointer',
                background: colors.surface,
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = colors.surface2)}
              onMouseLeave={e => (e.currentTarget.style.background = colors.surface)}
            >
              {/* Date box */}
              <div style={{
                height: '52px',
                borderRadius: '16px',
                background: isToday ? colors.blueSoft : colors.surface2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1px',
              }}>
                <span style={{ fontSize: '9px', color: isToday ? colors.blue : colors.muted, fontWeight: 700, letterSpacing: '0.04em' }}>
                  {dow}
                </span>
                <span style={{
                  fontSize: '20px', fontWeight: 900, letterSpacing: '-0.04em',
                  color: isToday ? colors.blue : colors.text, lineHeight: 1,
                }}>
                  {day}
                </span>
              </div>

              {/* Task info */}
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontWeight: 800, fontSize: '14px', letterSpacing: '-0.02em', color: colors.text,
                  marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
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
                  fontSize: '11px', fontWeight: 800, borderRadius: '999px',
                  padding: '7px 9px', background: pill.bg, color: pill.text, whiteSpace: 'nowrap',
                }}>
                  {task.trade_tag}
                </span>
              ) : isToday ? (
                <span style={{
                  fontSize: '11px', fontWeight: 800, borderRadius: '999px',
                  padding: '7px 9px', background: colors.orangeSoft, color: '#b45309',
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
