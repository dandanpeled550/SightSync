import { useState, useEffect } from 'react'
import ScreenShell from '../components/ScreenShell'
import { colors, radius, shadow } from '../constants/theme'
import { fetchAllTasks, fetchTaskEntries, type Task, type TaskLogEntry } from '../api/tasks'
import { fetchTodayLog } from '../api/daily_log'
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

function formatDateShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function daysUntil(iso: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(iso + 'T00:00:00')
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getDaysLabel(days: number): string {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

function getDaysColor(days: number): string {
  if (days <= 1) return colors.primary
  if (days <= 3) return colors.orange
  return colors.blue
}

function getDaysBg(days: number): string {
  if (days <= 1) return colors.primarySoft
  if (days <= 3) return colors.orangeSoft
  return colors.blueSoft
}

interface DelayedTask {
  entry: TaskLogEntry
  taskName: string
  originalDate: string
  newDate: string
}

export default function Alerts() {
  const { currentProject } = useProject()
  const PROJECT_ID = currentProject?.id ?? 1

  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming')
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([])
  const [delayedTasks, setDelayedTasks] = useState<DelayedTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        // Fetch all tasks and today's log in parallel
        const [allTasks, log] = await Promise.all([
          fetchAllTasks(PROJECT_ID),
          fetchTodayLog(PROJECT_ID),
        ])
        if (cancelled) return

        // Filter upcoming: start_date within next 7 days
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const in7 = new Date(today)
        in7.setDate(in7.getDate() + 7)

        const upcoming = allTasks.filter(t => {
          const start = new Date(t.start_date + 'T00:00:00')
          return start >= today && start <= in7
        })
        upcoming.sort((a, b) => a.start_date.localeCompare(b.start_date))
        if (!cancelled) setUpcomingTasks(upcoming)

        // Fetch task entries for "not_done" (delayed)
        const entries = await fetchTaskEntries(log.id)
        if (cancelled) return

        const notDoneEntries = entries.filter(e => e.action === 'not_done')
        // Build task map for names/original dates
        const taskMap = new Map(allTasks.map(t => [t.id, t]))
        const delayed: DelayedTask[] = notDoneEntries.map(e => {
          const task = taskMap.get(e.task_id)
          return {
            entry: e,
            taskName: task?.name ?? `Task #${e.task_id}`,
            originalDate: task?.start_date ?? '',
            newDate: e.new_date ?? '',
          }
        })
        if (!cancelled) setDelayedTasks(delayed)
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load alerts')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [PROJECT_ID])

  const tabBar = (
    <div style={{
      display: 'flex',
      gap: '4px',
      padding: '0 20px 16px',
      borderBottom: `1px solid ${colors.line}`,
      marginBottom: '4px',
    }}>
      {(['upcoming', 'past'] as const).map(tab => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          style={{
            padding: '8px 18px',
            borderRadius: radius.pill,
            border: 'none',
            background: activeTab === tab ? colors.text : colors.surface2,
            color: activeTab === tab ? colors.surface : colors.muted,
            fontWeight: 700,
            fontSize: '13px',
            cursor: 'pointer',
            letterSpacing: '-0.01em',
            transition: 'all 0.15s',
          }}
        >
          {tab === 'upcoming' ? 'Upcoming' : 'Past'}
        </button>
      ))}
    </div>
  )

  if (loading) {
    return (
      <ScreenShell title="Alerts" subtitle="Lookahead">
        <div style={{ padding: '20px 20px 0' }}>{tabBar}</div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '200px',
          color: colors.muted,
          fontSize: '14px',
        }}>
          Loading alerts…
        </div>
      </ScreenShell>
    )
  }

  if (error) {
    return (
      <ScreenShell title="Alerts" subtitle="Lookahead">
        <div style={{ padding: '20px 20px 0' }}>{tabBar}</div>
        <div style={{
          margin: '32px 20px',
          padding: '16px',
          borderRadius: radius.card,
          background: colors.redSoft,
          border: `1px solid ${colors.redBorder}`,
          color: colors.red,
          fontSize: '13px',
          textAlign: 'center',
        }}>
          {error}
        </div>
      </ScreenShell>
    )
  }

  return (
    <ScreenShell title="Alerts" subtitle="Lookahead">
      <div style={{ paddingBottom: '72px' }}>
        <div style={{ padding: '16px 20px 0' }}>
          {tabBar}
        </div>

        {activeTab === 'upcoming' && (
          <div style={{ padding: '8px 20px' }}>
            {upcomingTasks.length === 0 ? (
              <EmptyState
                icon="△"
                title="No upcoming tasks"
                body="Tasks starting within the next 7 days will appear here."
              />
            ) : (
              (() => {
                // Group by "Today", "Tomorrow", "This week"
                const groups: { label: string; tasks: Task[] }[] = []
                const today: Task[] = []
                const tomorrow: Task[] = []
                const week: Task[] = []
                for (const t of upcomingTasks) {
                  const d = daysUntil(t.start_date)
                  if (d === 0) today.push(t)
                  else if (d === 1) tomorrow.push(t)
                  else week.push(t)
                }
                if (today.length)    groups.push({ label: 'Today', tasks: today })
                if (tomorrow.length) groups.push({ label: 'Tomorrow', tasks: tomorrow })
                if (week.length)     groups.push({ label: 'This week', tasks: week })

                return groups.map(group => (
                  <div key={group.label} style={{ marginBottom: '8px' }}>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 900,
                      color: colors.muted,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase',
                      marginBottom: '8px',
                      marginTop: '16px',
                    }}>
                      {group.label}
                    </div>
                    {group.tasks.map(task => (
                      <UpcomingCard key={task.id} task={task} />
                    ))}
                  </div>
                ))
              })()
            )}
          </div>
        )}

        {activeTab === 'past' && (
          <div style={{ padding: '8px 20px' }}>
            {delayedTasks.length === 0 ? (
              <EmptyState
                icon="✓"
                title="No delayed tasks"
                body="Tasks marked as not done will appear here with their new schedule."
              />
            ) : (
              <>
                <div style={{
                  fontSize: '12px',
                  fontWeight: 900,
                  color: colors.muted,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                  marginTop: '16px',
                }}>
                  Delayed
                </div>
                {delayedTasks.map(d => (
                  <DelayedCard key={d.entry.id} delayed={d} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </ScreenShell>
  )
}

function UpcomingCard({ task }: { task: Task }) {
  const days = daysUntil(task.start_date)
  return (
    <div style={{
      background: colors.surface,
      borderRadius: radius.task,
      border: `1px solid ${colors.line}`,
      boxShadow: shadow.card,
      padding: '14px 16px',
      marginBottom: '10px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}>
      {/* Trade icon */}
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: radius.icon,
        background: colors.surface2,
        display: 'grid',
        placeItems: 'center',
        fontSize: '20px',
        flexShrink: 0,
      }}>
        {getTradeIcon(task.trade_tag)}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '14px',
          fontWeight: 800,
          color: colors.text,
          letterSpacing: '-0.02em',
          marginBottom: '4px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {task.name}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {task.trade_tag && (
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              color: colors.muted,
              background: colors.surface2,
              borderRadius: radius.pill,
              padding: '2px 8px',
            }}>
              {task.trade_tag}
            </span>
          )}
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            color: colors.blue,
            background: colors.blueSoft,
            borderRadius: radius.pill,
            padding: '2px 8px',
          }}>
            {task.level_tag}
          </span>
          <span style={{
            fontSize: '11px',
            color: colors.muted,
          }}>
            {formatDateShort(task.start_date)}
          </span>
        </div>
      </div>

      {/* Days pill */}
      <div style={{
        flexShrink: 0,
        background: getDaysBg(days),
        color: getDaysColor(days),
        borderRadius: radius.pill,
        padding: '4px 10px',
        fontSize: '11px',
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}>
        {getDaysLabel(days)}
      </div>
    </div>
  )
}

function DelayedCard({ delayed }: { delayed: DelayedTask }) {
  return (
    <div style={{
      background: colors.surface,
      borderRadius: radius.task,
      border: `1px solid ${colors.redBorder}`,
      boxShadow: shadow.card,
      padding: '14px 16px',
      marginBottom: '10px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}>
      {/* Warning icon */}
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: radius.icon,
        background: colors.redSoft,
        display: 'grid',
        placeItems: 'center',
        fontSize: '20px',
        flexShrink: 0,
      }}>
        !
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '14px',
          fontWeight: 800,
          color: colors.text,
          letterSpacing: '-0.02em',
          marginBottom: '4px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {delayed.taskName}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {delayed.originalDate && (
            <span style={{ fontSize: '11px', color: colors.mutedLight, textDecoration: 'line-through' }}>
              {formatDateShort(delayed.originalDate)}
            </span>
          )}
          {delayed.newDate && (
            <span style={{ fontSize: '11px', fontWeight: 700, color: colors.red }}>
              → {formatDateShort(delayed.newDate)}
            </span>
          )}
          {delayed.entry.reason && (
            <span style={{
              fontSize: '11px',
              color: colors.muted,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '120px',
            }}>
              {delayed.entry.reason}
            </span>
          )}
        </div>
      </div>

      {/* Delayed badge */}
      <div style={{
        flexShrink: 0,
        background: colors.redSoft,
        color: colors.red,
        borderRadius: radius.pill,
        padding: '4px 10px',
        fontSize: '11px',
        fontWeight: 800,
      }}>
        Delayed
      </div>
    </div>
  )
}

function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '60px 24px',
      gap: '14px',
      textAlign: 'center',
    }}>
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: colors.surface2,
        display: 'grid',
        placeItems: 'center',
        fontSize: '36px',
      }}>
        {icon}
      </div>
      <div style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '-0.04em', color: colors.text }}>
        {title}
      </div>
      <div style={{ fontSize: '14px', color: colors.muted, lineHeight: 1.5, maxWidth: '240px' }}>
        {body}
      </div>
    </div>
  )
}
