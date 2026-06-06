import { useState, useEffect, useRef } from 'react'
import ScreenShell from '../components/ScreenShell'
import { colors, radius, shadow } from '../constants/theme'
import {
  fetchAllTasks,
  fetchTaskEntries,
  fetchAlerts,
  type Task,
  type TaskLogEntry,
  type Alert,
} from '../api/tasks'
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

function getTypeIcon(type: string): string {
  if (type === 'risk')    return '!'
  if (type === 'pattern') return '△'
  return '◷'
}

function getTypeColor(type: string): string {
  if (type === 'risk')    return colors.red
  if (type === 'pattern') return colors.orange
  return colors.blue
}

function getTypeBg(type: string): string {
  if (type === 'risk')    return colors.redSoft
  if (type === 'pattern') return colors.orangeSoft
  return colors.blueSoft
}

function getTypeBorder(type: string): string {
  if (type === 'risk')    return colors.redBorder
  if (type === 'pattern') return colors.orangeBorder
  return colors.blueBorder
}

function getTypeLabel(type: string): string {
  if (type === 'reminder') return 'Reminder'
  return 'Alert'
}

function getSeverityColor(severity: string): string {
  if (severity === 'high')   return colors.red
  if (severity === 'medium') return colors.orange
  return colors.blue
}

function getSeverityBg(severity: string): string {
  if (severity === 'high')   return colors.redSoft
  if (severity === 'medium') return colors.orangeSoft
  return colors.blueSoft
}

interface DelayedTask {
  entry: TaskLogEntry
  taskName: string
  originalDate: string
  newDate: string
}

const TAB_LABELS: Record<string, string> = {
  upcoming: 'Upcoming',
  insights: 'AI Insights',
  past: 'Past',
}

export default function Alerts() {
  const { currentProject } = useProject()
  const PROJECT_ID = currentProject?.id ?? 1

  const [activeTab, setActiveTab] = useState<'upcoming' | 'insights' | 'past'>('upcoming')
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([])
  const [delayedTasks, setDelayedTasks] = useState<DelayedTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [alerts, setAlerts] = useState<Alert[]>([])
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [alertsError, setAlertsError] = useState<string | null>(null)
  const hasFetchedInsights = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [allTasks, log] = await Promise.all([
          fetchAllTasks(PROJECT_ID),
          fetchTodayLog(PROJECT_ID),
        ])
        if (cancelled) return

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

        const entries = await fetchTaskEntries(log.id)
        if (cancelled) return

        const notDoneEntries = entries.filter(e => e.action === 'not_done')
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

  useEffect(() => {
    if (activeTab !== 'insights' || hasFetchedInsights.current) return
    hasFetchedInsights.current = true
    let cancelled = false
    async function loadInsights() {
      setAlertsLoading(true)
      setAlertsError(null)
      try {
        const data = await fetchAlerts(PROJECT_ID)
        if (!cancelled) setAlerts(data)
      } catch (err: unknown) {
        if (!cancelled) setAlertsError(err instanceof Error ? err.message : 'Failed to load insights')
      } finally {
        if (!cancelled) setAlertsLoading(false)
      }
    }
    loadInsights()
    return () => { cancelled = true }
  }, [activeTab, PROJECT_ID])

  const tabBar = (
    <div style={{
      display: 'flex',
      gap: '4px',
      padding: '0 20px 16px',
      borderBottom: `1px solid ${colors.line}`,
      marginBottom: '4px',
    }}>
      {(['upcoming', 'insights', 'past'] as const).map(tab => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          style={{
            padding: '8px 14px',
            borderRadius: radius.pill,
            border: 'none',
            background: activeTab === tab ? colors.text : colors.surface2,
            color: activeTab === tab ? colors.surface : colors.muted,
            fontWeight: 700,
            fontSize: '12px',
            cursor: 'pointer',
            letterSpacing: '-0.01em',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          {TAB_LABELS[tab]}
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

        {activeTab === 'insights' && (
          <div style={{ padding: '8px 20px' }}>
            {alertsLoading ? (
              <InsightShimmer />
            ) : alertsError ? (
              <div style={{
                margin: '16px 0',
                padding: '16px',
                borderRadius: radius.card,
                background: colors.redSoft,
                border: `1px solid ${colors.redBorder}`,
                color: colors.red,
                fontSize: '13px',
                textAlign: 'center',
              }}>
                {alertsError}
              </div>
            ) : alerts.length === 0 ? (
              <EmptyState
                icon="◎"
                title="No patterns detected yet"
                body="Keep logging daily data — AI Insights will appear once enough delay history is available."
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
                  {alerts.length} insight{alerts.length !== 1 ? 's' : ''} detected
                </div>
                {alerts.map(alert => (
                  <InsightCard
                    key={alert.id}
                    alert={alert}
                    taskMap={new Map(upcomingTasks.map(t => [t.id, t]))}
                  />
                ))}
              </>
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
          <span style={{ fontSize: '11px', color: colors.muted }}>
            {formatDateShort(task.start_date)}
          </span>
        </div>
      </div>

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

function InsightCard({ alert, taskMap }: { alert: Alert; taskMap: Map<number, Task> }) {
  const [expanded, setExpanded] = useState(false)
  const affectedNames = alert.affected_task_ids
    .map(id => taskMap.get(id)?.name ?? `Task #${id}`)

  return (
    <div style={{
      background: colors.surface,
      borderRadius: radius.task,
      border: `1px solid ${getTypeBorder(alert.type)}`,
      boxShadow: shadow.card,
      padding: '14px 16px',
      marginBottom: '10px',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* Type icon */}
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: radius.icon,
          background: getTypeBg(alert.type),
          display: 'grid',
          placeItems: 'center',
          fontSize: '18px',
          fontWeight: 900,
          color: getTypeColor(alert.type),
          flexShrink: 0,
        }}>
          {getTypeIcon(alert.type)}
        </div>

        {/* Title + badges */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 800,
            color: colors.text,
            letterSpacing: '-0.02em',
            marginBottom: '6px',
            lineHeight: 1.3,
          }}>
            {alert.title}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              color: getSeverityColor(alert.severity),
              background: getSeverityBg(alert.severity),
              borderRadius: radius.pill,
              padding: '2px 8px',
            }}>
              {alert.severity.toUpperCase()}
            </span>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              color: getTypeColor(alert.type),
              background: getTypeBg(alert.type),
              borderRadius: radius.pill,
              padding: '2px 8px',
            }}>
              {getTypeLabel(alert.type)}
            </span>
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: colors.muted,
            fontSize: '14px',
            padding: '4px',
            flexShrink: 0,
            lineHeight: 1,
          }}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Message — always visible */}
      <div style={{
        fontSize: '13px',
        color: colors.muted,
        lineHeight: 1.55,
        marginTop: '10px',
      }}>
        {alert.message}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{
          marginTop: '12px',
          borderTop: `1px solid ${colors.line}`,
          paddingTop: '12px',
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 900,
            color: colors.muted,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: '6px',
          }}>
            Recommendation
          </div>
          <div style={{
            fontSize: '13px',
            color: colors.text,
            lineHeight: 1.5,
            marginBottom: affectedNames.length > 0 ? '12px' : 0,
          }}>
            {alert.recommendation}
          </div>
          {affectedNames.length > 0 && (
            <>
              <div style={{
                fontSize: '11px',
                fontWeight: 900,
                color: colors.muted,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginBottom: '6px',
              }}>
                Affected Tasks
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {affectedNames.map(name => (
                  <span key={name} style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: colors.blue,
                    background: colors.blueSoft,
                    borderRadius: radius.pill,
                    padding: '2px 8px',
                  }}>
                    {name}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function InsightShimmer() {
  return (
    <div style={{ padding: '16px 0' }}>
      <style>{`@keyframes ss-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            height: '100px',
            borderRadius: radius.task,
            background: `linear-gradient(90deg,${colors.surface2} 25%,${colors.bg} 50%,${colors.surface2} 75%)`,
            backgroundSize: '200% 100%',
            animation: `ss-shimmer 1.5s infinite`,
            animationDelay: `${i * 0.15}s`,
            marginBottom: '10px',
          }}
        />
      ))}
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
