import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ScreenShell, { IconBtn } from '../components/ScreenShell'
import MaterialsBlock from '../components/MaterialsBlock'
import SafetyBlock from '../components/SafetyBlock'
import PhotoUploader from '../components/PhotoUploader'
import { colors, radius, shadow, animations, desktop } from '../constants/theme'
import { useWindowSize } from '../hooks/useWindowSize'
import { fetchTodayLog } from '../api/daily_log'
import { fetchTodayTasks, fetchAllTasks, markTaskDone, type Task } from '../api/tasks'
import { fetchAttendance } from '../api/crew'
import { useProject } from '../contexts/ProjectContext'

function getTradeIcon(trade: string | null): string {
  if (!trade) return '?'
  const l = trade.toLowerCase()
  if (l.includes('electrical'))  return 'E'
  if (l.includes('plumbing'))    return 'P'
  if (l.includes('concrete'))    return 'C'
  if (l.includes('framing'))     return 'F'
  if (l.includes('safety'))      return 'S'
  if (l.includes('cleanup'))     return 'CL'
  if (l.includes('materials'))   return 'M'
  if (l.includes('inspection'))  return 'I'
  return trade.slice(0, 2).toUpperCase()
}

function getTradeColorSoft(trade: string | null): string {
  if (!trade) return colors.orangeSoft
  const l = trade.toLowerCase()
  if (l.includes('electrical'))                          return colors.orangeSoft
  if (l.includes('safety'))                              return colors.blueSoft
  if (l.includes('concrete') || l.includes('framing'))  return colors.greenSoft
  if (l.includes('plumbing'))                            return colors.blueSoft
  return colors.orangeSoft
}

function getTradeTextColor(trade: string | null): string {
  if (!trade) return colors.primary
  const l = trade.toLowerCase()
  if (l.includes('safety') || l.includes('plumbing')) return colors.blue
  if (l.includes('concrete') || l.includes('framing')) return colors.green
  return colors.primary
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Shared card styles ────────────────────────────────────────────────────────

const sectionCard: React.CSSProperties = {
  background: colors.surface,
  border: `1px solid #e8edf5`,
  borderRadius: radius.card,
  boxShadow: shadow.card,
  marginBottom: '16px',
  overflow: 'hidden',
}

const sectionCardHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '18px 22px 16px',
  borderBottom: `1px solid #f0f2f5`,
}

const sectionCardTitle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 900,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  color: colors.text,
}

const sectionCardSub: React.CSSProperties = {
  fontSize: '12px',
  color: colors.mutedLight,
  marginTop: '2px',
}

const sectionCardBody: React.CSSProperties = {
  padding: '16px 22px',
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Today() {
  const navigate = useNavigate()
  const { currentProject } = useProject()
  const PROJECT_ID = currentProject?.id ?? 1
  const isMobile = useWindowSize() < desktop.breakpoint

  const [logId, setLogId]                     = useState<number | null>(null)
  const [tasks, setTasks]                     = useState<Task[]>([])
  const [loading, setLoading]                 = useState(true)
  const [error, setError]                     = useState<string | null>(null)
  const [markingId, setMarkingId]             = useState<number | null>(null)
  const [crewPresent, setCrewPresent]         = useState<number>(0)
  const [crewTotal, setCrewTotal]             = useState<number>(0)
  const [pendingDoneTask, setPendingDoneTask] = useState<Task | null>(null)
  const [donePhotoUrl, setDonePhotoUrl]       = useState<string | null>(null)
  const [doneCount, setDoneCount]             = useState<number>(0)
  const [totalCount, setTotalCount]           = useState<number>(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const log = await fetchTodayLog(PROJECT_ID)
        if (cancelled) return
        setLogId(log.id)
        const todayStr = new Date().toISOString().split('T')[0]
        const [todayTasks, allTasks, attendance] = await Promise.all([
          fetchTodayTasks(PROJECT_ID),
          fetchAllTasks(PROJECT_ID),
          fetchAttendance(log.id),
        ])
        if (cancelled) return
        setTasks(Array.isArray(todayTasks) ? [...todayTasks].sort((a, b) => a.start_date.localeCompare(b.start_date)) : [])
        setCrewTotal(attendance.length)
        setCrewPresent(attendance.filter(a => a.status === 'present').length)
        const active = Array.isArray(allTasks)
          ? allTasks.filter(t => t.start_date <= todayStr && t.end_date >= todayStr)
          : []
        setTotalCount(active.length)
        setDoneCount(active.filter(t => t.status === 'done').length)
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

  function handleDone(task: Task) {
    if (!logId || markingId) return
    setDonePhotoUrl(null)
    setPendingDoneTask(task)
  }

  async function confirmDone() {
    if (!logId || !pendingDoneTask) return
    const task = pendingDoneTask
    setPendingDoneTask(null)
    setMarkingId(task.id)
    setTasks(prev => prev.filter(t => t.id !== task.id))
    try {
      await markTaskDone(logId, task.id, { photo_url: donePhotoUrl ?? undefined })
    } catch {
      setTasks(prev => [task, ...prev])
    } finally {
      setMarkingId(null)
      setDonePhotoUrl(null)
    }
  }

  const today    = new Date()
  const allDone  = totalCount > 0 && doneCount === totalCount
  const pct      = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).toUpperCase()

  return (
    <ScreenShell
      title={currentProject?.name ?? 'Today'}
      desktopHideLeft
      desktopHideTopBar
      leftAction={<IconBtn onClick={() => navigate('/onboard')}>☰</IconBtn>}
      rightAction={<IconBtn onClick={() => navigate('/task/new')}>+</IconBtn>}
    >
      <div style={{ padding: isMobile ? '16px 16px 90px' : '28px 32px 80px' }}>

        {/* ── Page header ────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '24px',
          gap: '16px',
        }}>
          <div>
            <div style={{
              fontSize: isMobile ? '32px' : '48px',
              fontWeight: 900,
              color: colors.text,
              letterSpacing: '-0.05em',
              lineHeight: 1,
              marginBottom: '8px',
              textTransform: 'uppercase',
            }}>
              {currentProject?.name ?? 'Today'}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 700,
              color: colors.mutedLight,
              letterSpacing: '0.05em',
            }}>
              <span>📅</span>
              <span>{dateStr}</span>
            </div>
          </div>

          {/* Desktop: action buttons in header */}
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, paddingTop: '4px' }}>
              <button
                onClick={() => navigate('/task/new')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: colors.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 20px',
                  fontSize: '13px',
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                + ADD TASK
              </button>
              <button style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                border: `1.5px solid ${colors.line}`,
                background: colors.surface,
                boxShadow: shadow.card,
                display: 'grid',
                placeItems: 'center',
                fontSize: '18px',
                color: colors.muted,
                cursor: 'pointer',
              }}>···</button>
            </div>
          )}
        </div>

        {/* ── Status / KPI hero card ──────────────────────────── */}
        {!loading && !error && (
          <div style={{ ...sectionCard, marginBottom: '20px' }}>
            {/* Status body */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? '16px' : '28px',
              padding: isMobile ? '20px 18px' : '28px 28px 24px',
              borderBottom: `1px solid #f0f2f5`,
            }}>
              <div style={{
                flexShrink: 0,
                width: isMobile ? '72px' : '100px',
                height: isMobile ? '72px' : '100px',
                borderRadius: '50%',
                border: `3px solid ${allDone ? colors.greenBorder : colors.orangeBorder}`,
                display: 'grid',
                placeItems: 'center',
                fontSize: isMobile ? '28px' : '40px',
              }}>
                {allDone ? '✅' : totalCount === 0 ? '📋' : '⏳'}
              </div>
              <div>
                <div style={{
                  fontSize: isMobile ? '22px' : '30px',
                  fontWeight: 900,
                  letterSpacing: '-0.04em',
                  color: colors.text,
                  marginBottom: '8px',
                }}>
                  {allDone ? 'ALL CLEAR' : totalCount === 0 ? 'NO TASKS' : 'IN PROGRESS'}
                </div>
                <div style={{ fontSize: '14px', color: colors.muted, lineHeight: 1.6 }}>
                  {allDone
                    ? 'All tasks completed for today.\nGreat work. You\'re all caught up.'
                    : totalCount === 0
                    ? 'No tasks scheduled for today.'
                    : `${totalCount - doneCount} task${totalCount - doneCount !== 1 ? 's' : ''} remaining. Keep going.`}
                </div>
              </div>
            </div>

            {/* KPI stats row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              padding: isMobile ? '16px 18px' : '20px 28px',
              gap: isMobile ? '16px' : '0',
            }}>
              {[
                { icon: '✅', value: `${doneCount} OF ${totalCount}`, label: 'Tasks Completed', color: colors.green },
                { icon: '👥', value: String(crewPresent),             label: 'Crew on Site',    color: colors.blue  },
                { icon: '📦', value: '—',                             label: 'Materials Logged', color: colors.orange },
                { icon: '🛡', value: '—',                             label: 'Safety Alerts',   color: colors.red   },
              ].map((kpi, i) => (
                <div key={i} style={{
                  paddingLeft: !isMobile && i > 0 ? '20px' : '0',
                  paddingRight: !isMobile && i < 3 ? '20px' : '0',
                  borderRight: !isMobile && i < 3 ? `1px solid #f0f2f5` : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '20px' }}>{kpi.icon}</span>
                    <span style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.04em', color: kpi.color }}>{kpi.value}</span>
                  </div>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.06em',
                    color: colors.mutedLight,
                    paddingLeft: '30px',
                  }}>
                    {kpi.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading shimmer */}
        {loading && [80, 64, 64].map((h, i) => (
          <div key={i} className="shimmer" style={{ height: `${h}px`, borderRadius: radius.task, marginBottom: '10px' }} />
        ))}

        {/* Error state */}
        {error && !loading && (
          <div style={{
            background: colors.redSoft,
            border: `1px solid ${colors.redBorder}`,
            borderRadius: radius.card,
            padding: '16px',
            color: colors.red,
            fontSize: '14px',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        {/* ── Today's tasks section card ──────────────────────── */}
        {!loading && !error && (
          <div style={sectionCard}>
            <div style={sectionCardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}>📋</span>
                <div>
                  <div style={sectionCardTitle}>Today's Tasks</div>
                  <div style={sectionCardSub}>
                    {tasks.length === 0
                      ? 'All tasks done for today'
                      : `${tasks.length} task${tasks.length !== 1 ? 's' : ''} remaining`}
                  </div>
                </div>
              </div>
              {pct > 0 && (
                <div style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: allDone ? colors.green : colors.primary,
                  background: allDone ? colors.greenSoft : colors.primarySoft,
                  padding: '4px 12px',
                  borderRadius: '999px',
                }}>
                  {pct}%
                </div>
              )}
            </div>

            <div style={{ padding: tasks.length === 0 ? '24px 22px' : '12px 16px' }}>
              {tasks.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '50%',
                    background: colors.greenSoft,
                    display: 'grid', placeItems: 'center', fontSize: '24px', flexShrink: 0,
                  }}>✓</div>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 900, letterSpacing: '-0.03em', color: colors.text }}>All clear</div>
                    <div style={{ fontSize: '13px', color: colors.muted, marginTop: '2px' }}>No tasks scheduled for today.</div>
                  </div>
                </div>
              ) : (
                tasks.map((task, index) => (
                  <div
                    key={task.id}
                    className="fade-up"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile ? '40px 1fr 44px' : '40px 1fr 44px 44px',
                      gap: '10px',
                      alignItems: 'center',
                      background: colors.surface,
                      border: `1.5px solid ${colors.line}`,
                      borderLeft: `4px solid ${colors.primary}`,
                      borderRadius: radius.task,
                      boxShadow: shadow.card,
                      padding: '10px 10px 10px 8px',
                      marginBottom: '10px',
                      animationDelay: `${index * animations.delayStep}s`,
                    }}
                  >
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '14px',
                      display: 'grid', placeItems: 'center',
                      background: getTradeColorSoft(task.trade_tag),
                      color: getTradeTextColor(task.trade_tag),
                      fontSize: '12px', fontWeight: 800, letterSpacing: '-0.01em',
                    }}>
                      {getTradeIcon(task.trade_tag)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '14px', letterSpacing: '-0.02em', color: colors.text }}>
                        {task.name}
                      </div>
                      <div style={{ fontSize: '12px', color: colors.muted, marginTop: '2px' }}>
                        {task.level_tag}{task.trade_tag ? ` · ${task.trade_tag}` : ''}
                      </div>
                      <div style={{ fontSize: '11px', color: colors.mutedLight, marginTop: '1px' }}>
                        {formatDate(task.start_date)} – {formatDate(task.end_date)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDone(task)}
                      disabled={markingId === task.id}
                      style={{
                        height: '44px', borderRadius: '12px',
                        display: 'grid', placeItems: 'center',
                        fontWeight: 900, fontSize: '18px',
                        cursor: markingId === task.id ? 'wait' : 'pointer',
                        background: colors.greenSoft, color: colors.green,
                        border: `1px solid ${colors.greenBorder}`,
                      }}
                    >✓</button>
                    {!isMobile && (
                      <button
                        onClick={() => navigate(`/task/${task.id}`)}
                        disabled={!!markingId}
                        style={{
                          height: '44px', borderRadius: '12px',
                          display: 'grid', placeItems: 'center',
                          fontWeight: 900, fontSize: '18px',
                          cursor: markingId ? 'not-allowed' : 'pointer',
                          background: colors.redSoft, color: colors.red,
                          border: `1px solid ${colors.redBorder}`,
                        }}
                      >×</button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Crew on site section card ───────────────────────── */}
        {!loading && !error && (
          <div style={sectionCard}>
            <div style={sectionCardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}>👥</span>
                <div>
                  <div style={sectionCardTitle}>Crew on Site</div>
                  <div style={sectionCardSub}>
                    {crewPresent === 0
                      ? '0 people currently checked in'
                      : `${crewPresent} people currently checked in`}
                  </div>
                </div>
              </div>
              {!isMobile && (
                <button
                  onClick={() => navigate('/crew/attendance')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: colors.surface2,
                    border: `1px solid ${colors.line}`,
                    borderRadius: '10px',
                    padding: '8px 14px',
                    fontSize: '12px', fontWeight: 800,
                    color: colors.text, letterSpacing: '0.04em',
                    textTransform: 'uppercase' as const,
                    cursor: 'pointer',
                  }}
                >
                  Manage Crew ›
                </button>
              )}
            </div>
            <div style={{ ...sectionCardBody, padding: '14px 22px' }}>
              {crewPresent === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: colors.muted, fontSize: '13px' }}>
                  <span>ℹ️</span>
                  <span>No crew members are checked in for today.</span>
                </div>
              ) : (
                <div style={{ fontSize: '14px', fontWeight: 700, color: colors.text }}>
                  <span style={{ color: colors.green, fontWeight: 900 }}>{crewPresent}</span>
                  <span style={{ color: colors.muted }}> of {crewTotal} crew members on site today</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Materials section card ──────────────────────────── */}
        {!loading && !error && logId != null && (
          <div style={sectionCard}>
            <div style={sectionCardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}>📦</span>
                <div>
                  <div style={sectionCardTitle}>Materials Used Today</div>
                  <div style={sectionCardSub}>Log materials used from inventory or enter custom materials manually.</div>
                </div>
              </div>
            </div>
            <div style={sectionCardBody}>
              <MaterialsBlock logId={logId} />
            </div>
          </div>
        )}

        {/* ── Safety documentation section card ──────────────── */}
        {!loading && !error && logId != null && (
          <div style={sectionCard}>
            <div style={sectionCardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '20px' }}>🛡️</span>
                <div>
                  <div style={sectionCardTitle}>Safety Documentation</div>
                  <div style={sectionCardSub}>Record incidents, near-misses, and corrective actions for today.</div>
                </div>
              </div>
              <button
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: colors.redSoft,
                  border: `1px solid ${colors.redBorder}`,
                  borderRadius: '10px',
                  padding: '8px 14px',
                  fontSize: '12px', fontWeight: 800,
                  color: colors.red, letterSpacing: '0.02em',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                + Report Incident
              </button>
            </div>
            <div style={sectionCardBody}>
              <SafetyBlock logId={logId} />
            </div>
          </div>
        )}

      </div>

      {/* ── Task-done photo sheet (unchanged) ──────────────────── */}
      {pendingDoneTask && (
        <>
          <div
            onClick={() => setPendingDoneTask(null)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 20 }}
          />
          <div style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            background: colors.surface,
            borderRadius: `${radius.card} ${radius.card} 0 0`,
            padding: '24px 20px calc(36px + env(safe-area-inset-bottom))',
            zIndex: 21,
            display: 'flex', flexDirection: 'column', gap: '16px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: colors.text, letterSpacing: '-0.02em' }}>
                  Mark as done
                </div>
                <div style={{ fontSize: '13px', color: colors.muted, marginTop: '2px' }}>
                  {pendingDoneTask.name}
                </div>
              </div>
              <button
                onClick={() => setPendingDoneTask(null)}
                style={{ background: 'none', border: 'none', fontSize: '22px', color: colors.muted, cursor: 'pointer', lineHeight: 1, padding: 0 }}
              >×</button>
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: colors.text, marginBottom: '8px' }}>
                Attach completion photo (optional)
              </div>
              <PhotoUploader value={donePhotoUrl} onChange={setDonePhotoUrl} />
            </div>
            <button
              onClick={confirmDone}
              style={{
                padding: '14px',
                background: colors.green, color: '#fff',
                border: 'none', borderRadius: radius.btn,
                fontWeight: 900, fontSize: '15px', cursor: 'pointer',
              }}
            >✓ Confirm done</button>
          </div>
        </>
      )}
    </ScreenShell>
  )
}
