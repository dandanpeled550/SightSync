import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ScreenShell, { IconBtn } from '../components/ScreenShell'
import MaterialsBlock from '../components/MaterialsBlock'
import SafetyBlock from '../components/SafetyBlock'
import PhotoUploader from '../components/PhotoUploader'
import { colors, radius, animations } from '../constants/theme'
import { fetchTodayLog } from '../api/daily_log'
import { fetchTodayTasks, markTaskDone, type Task } from '../api/tasks'
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


function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Today() {
  const navigate = useNavigate()
  const { currentProject } = useProject()
  const PROJECT_ID = currentProject?.id ?? 1
  const [logId, setLogId]                   = useState<number | null>(null)
  const [tasks, setTasks]                   = useState<Task[]>([])
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState<string | null>(null)
  const [markingId, setMarkingId]           = useState<number | null>(null)
  const [crewPresent, setCrewPresent]       = useState<number>(0)
  const [crewTotal, setCrewTotal]           = useState<number>(0)
  const [pendingDoneTask, setPendingDoneTask] = useState<Task | null>(null)
  const [donePhotoUrl, setDonePhotoUrl]     = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const log = await fetchTodayLog(PROJECT_ID)
        if (cancelled) return
        setLogId(log.id)
        const [todayTasks, attendance] = await Promise.all([
          fetchTodayTasks(PROJECT_ID),
          fetchAttendance(log.id),
        ])
        if (cancelled) return
        setTasks(Array.isArray(todayTasks) ? todayTasks : [])
        setCrewTotal(attendance.length)
        setCrewPresent(attendance.filter(a => a.status === 'present').length)
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

  const today = new Date()
  const dayNum = today.getDate()
  const dayName = today.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const monthName = today.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const yearShort = String(today.getFullYear()).slice(2)


  return (
    <ScreenShell
      title={currentProject?.name ?? 'Today'}
      desktopHideLeft
      leftAction={
        <IconBtn onClick={() => navigate('/onboard')}>☰</IconBtn>
      }
      rightAction={
        <IconBtn onClick={() => navigate('/task/new')}>+</IconBtn>
      }
    >
      {/* Date hero */}
      <div style={{
        padding: '20px 24px 16px',
        display: 'flex',
        alignItems: 'flex-end',
        gap: '14px',
      }}>
        <div style={{
          fontSize: '64px',
          fontWeight: 900,
          letterSpacing: '-0.06em',
          color: colors.text,
          lineHeight: 1,
        }}>
          {dayNum}
        </div>
        <div style={{ paddingBottom: '6px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: colors.primary, letterSpacing: '0.04em' }}>
            {dayName}
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: colors.muted, letterSpacing: '0.02em' }}>
            {monthName} '{yearShort}
          </div>
        </div>
      </div>

      <div style={{ padding: '0 24px 0' }}>
        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <span style={{ fontSize: '13px', fontWeight: 900, color: colors.text, letterSpacing: '-0.01em', flexShrink: 0 }}>
            Today's progress
          </span>
          <div style={{ flex: 1, height: '1px', background: colors.line }} />
        </div>

        {/* Shimmer skeleton */}
        {loading && [0,1,2].map(i => (
          <div
            key={i}
            className="shimmer"
            style={{
              height: '64px',
              borderRadius: '20px',
              marginBottom: '10px',
            }}
          />
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

        {/* Empty state */}
        {!loading && !error && tasks.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '48px 20px',
            gap: '12px',
            textAlign: 'center',
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: colors.greenSoft,
              display: 'grid',
              placeItems: 'center',
              fontSize: '36px',
            }}>
              ✓
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.04em', color: colors.text }}>
              All clear
            </div>
            <div style={{ fontSize: '14px', color: colors.muted, lineHeight: 1.5 }}>
              No tasks scheduled for today.
            </div>
          </div>
        )}

        {/* Task cards */}
        {!loading && !error && tasks.map((task, index) => (
          <div
            key={task.id}
            className="fade-up"
            style={{
              display: 'grid',
              gridTemplateColumns: '42px 1fr 44px 44px',
              gap: '9px',
              alignItems: 'center',
              border: `1px solid ${colors.line}`,
              borderLeft: `4px solid ${colors.primary}`,
              borderRadius: '20px',
              padding: '10px',
              marginBottom: '10px',
              background: colors.surface,
              animationDelay: `${index * animations.delayStep}s`,
            }}
          >
            {/* Trade icon */}
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '16px',
              display: 'grid',
              placeItems: 'center',
              background: getTradeColorSoft(task.trade_tag),
              fontSize: '13px',
              fontWeight: 800,
              letterSpacing: '-0.01em',
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
                border: `1px solid ${colors.greenBorder}`,
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
                border: `1px solid ${colors.redBorder}`,
              }}
            >
              ×
            </button>
          </div>
        ))}


        {/* Crew summary card */}
        {!loading && !error && (
          <button
            onClick={() => navigate('/crew/attendance')}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: crewPresent > 0 ? colors.greenSoft : colors.surface2,
              border: `1px solid ${crewPresent > 0 ? colors.greenBorder : colors.line}`,
              borderRadius: radius.task,
              padding: '14px 16px',
              marginTop: '8px',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '22px', lineHeight: 1 }}>◎</span>
              <span style={{ fontSize: '14px', fontWeight: 800, color: colors.text }}>
                Crew on site
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                fontSize: '16px',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                color: crewPresent > 0 ? colors.green : colors.muted,
              }}>
                {crewPresent} / {crewTotal}
              </span>
              <span style={{ fontSize: '12px', color: colors.mutedLight }}>›</span>
            </div>
          </button>
        )}

        {/* Materials used today */}
        {!loading && !error && logId != null && (
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', fontWeight: 900, color: colors.text, letterSpacing: '-0.01em', flexShrink: 0 }}>
                Materials used today
              </span>
              <div style={{ flex: 1, height: '1px', background: colors.line }} />
            </div>
            <MaterialsBlock logId={logId} />
          </div>
        )}

        {/* Safety incidents */}
        {!loading && !error && logId != null && (
          <div style={{ marginTop: '20px', paddingBottom: '90px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', fontWeight: 900, color: colors.text, letterSpacing: '-0.01em', flexShrink: 0 }}>
                Safety documentation
              </span>
              <div style={{ flex: 1, height: '1px', background: colors.line }} />
              <button
                onClick={() => navigate('/safety')}
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: colors.primary,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                View all →
              </button>
            </div>
            <SafetyBlock logId={logId} />
          </div>
        )}
      </div>

      {/* Task-done photo sheet */}
      {pendingDoneTask && (
        <>
          <div
            onClick={() => setPendingDoneTask(null)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 20 }}
          />
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: colors.surface,
            borderRadius: `${radius.card} ${radius.card} 0 0`,
            padding: '24px 20px 36px',
            zIndex: 21,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
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
                background: colors.green,
                color: '#fff',
                border: 'none',
                borderRadius: radius.btn,
                fontWeight: 900,
                fontSize: '15px',
                cursor: 'pointer',
              }}
            >
              ✓ Confirm done
            </button>
          </div>
        </>
      )}
    </ScreenShell>
  )
}
