import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ScreenShell from '../components/ScreenShell'
import { colors, radius, gradients, shadow } from '../constants/theme'
import { fetchTodayLog, submitLog, type DailyLog } from '../api/daily_log'
import { fetchAttendance, type AttendanceRecord } from '../api/crew'
import { fetchTaskEntries, fetchAllTasks, type TaskLogEntry, type Task } from '../api/tasks'
import { fetchMaterials, type Material } from '../api/materials'
import { useProject } from '../contexts/ProjectContext'

function formatTodayLong(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function weatherIcon(conditions: string | null): string {
  if (!conditions) return '🌤'
  const c = conditions.toLowerCase()
  if (c.includes('thunder') || c.includes('storm')) return '⛈'
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return '🌧'
  if (c.includes('snow') || c.includes('sleet') || c.includes('blizzard')) return '❄️'
  if (c.includes('fog') || c.includes('mist')) return '🌫'
  if (c.includes('cloud') || c.includes('overcast')) return '☁️'
  if (c.includes('clear') || c.includes('sunny')) return '☀️'
  return '🌤'
}

interface StatCardProps {
  icon: string
  value: string
  label: string
  loading?: boolean
  accent?: string
  bg?: string
}

function StatCard({ icon, value, label, loading, accent, bg }: StatCardProps) {
  return (
    <div style={{
      background: bg ?? colors.surface,
      borderRadius: radius.card,
      border: `1px solid ${colors.line}`,
      boxShadow: shadow.card,
      padding: '18px 16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '6px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '28px', lineHeight: 1 }}>{icon}</div>
      <div style={{
        fontSize: '26px',
        fontWeight: 900,
        letterSpacing: '-0.04em',
        color: accent ?? colors.text,
        lineHeight: 1,
        minHeight: '32px',
        display: 'flex',
        alignItems: 'center',
      }}>
        {loading ? (
          <span style={{ fontSize: '18px', color: colors.mutedLight }}>…</span>
        ) : value}
      </div>
      <div style={{
        fontSize: '11px',
        fontWeight: 700,
        color: colors.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        {label}
      </div>
    </div>
  )
}

export default function Report() {
  const navigate = useNavigate()
  const { currentProject } = useProject()
  const PROJECT_ID = currentProject?.id ?? 1

  const [log, setLog] = useState<DailyLog | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [taskEntries, setTaskEntries] = useState<TaskLogEntry[]>([])
  const [materials, setMaterials] = useState<Material[]>([])
  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const todayLog = await fetchTodayLog(PROJECT_ID)
        if (cancelled) return
        setLog(todayLog)

        const [att, entries, mats, tasks] = await Promise.all([
          fetchAttendance(todayLog.id),
          fetchTaskEntries(todayLog.id),
          fetchMaterials(todayLog.id),
          fetchAllTasks(PROJECT_ID),
        ])
        if (cancelled) return
        setAttendance(att)
        setTaskEntries(entries)
        setMaterials(mats)
        setAllTasks(tasks)
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load report data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [PROJECT_ID])

  async function handleSubmit() {
    if (!log) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitLog(PROJECT_ID, log.id)
      navigate('/summary')
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Submit failed')
      setSubmitting(false)
    }
  }

  // Computed stats
  const crewPresent = attendance.filter(a => a.status === 'present').length
  const tasksDone = taskEntries.filter(e => e.action === 'done').length
  const tasksDelayed = taskEntries.filter(e => e.action === 'not_done').length
  const materialCount = materials.length

  const weatherVal = (() => {
    if (!log?.weather) return '—'
    const { temp_max, temp_min, conditions } = log.weather
    if (temp_max != null && temp_min != null) {
      return `${Math.round(temp_max)}° / ${Math.round(temp_min)}°`
    }
    if (temp_max != null) return `${Math.round(temp_max)}°`
    return conditions ?? '—'
  })()

  const weatherIco = weatherIcon(log?.weather?.conditions ?? null)

  const doneTasks: Task[] = taskEntries
    .filter(e => e.action === 'done')
    .map(e => allTasks.find(t => t.id === e.task_id))
    .filter((t): t is Task => t !== undefined)

  const notDoneTasks: { task: Task; entry: TaskLogEntry }[] = taskEntries
    .filter(e => e.action === 'not_done')
    .map(e => ({ task: allTasks.find(t => t.id === e.task_id), entry: e }))
    .filter((x): x is { task: Task; entry: TaskLogEntry } => x.task !== undefined)

  const draftBadge = (
    <span style={{
      display: 'inline-block',
      background: colors.orangeSoft,
      color: colors.orange,
      borderRadius: radius.pill,
      padding: '4px 12px',
      fontSize: '12px',
      fontWeight: 800,
      letterSpacing: '-0.01em',
    }}>
      Draft
    </span>
  )

  if (error) {
    return (
      <ScreenShell title="Daily Report" subtitle={formatTodayLong()}>
        <div style={{ padding: '32px 20px' }}>
          <div style={{
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
        </div>
      </ScreenShell>
    )
  }

  return (
    <ScreenShell
      title="Daily Report"
      subtitle={formatTodayLong()}
      rightAction={draftBadge}
    >
      <div style={{ padding: '20px 20px 0', paddingBottom: '72px' }}>
        {/* Stats grid — 2 columns */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '24px',
        }}>
          <StatCard
            icon={weatherIco}
            value={weatherVal}
            label="Weather"
            loading={loading}
          />
          <StatCard
            icon="👷"
            value={String(crewPresent)}
            label="Crew on site"
            loading={loading}
            accent={crewPresent > 0 ? colors.green : colors.muted}
            bg={crewPresent > 0 ? colors.greenSoft : undefined}
          />
          <StatCard
            icon="✅"
            value={String(tasksDone)}
            label="Completed"
            loading={loading}
            accent={tasksDone > 0 ? colors.green : colors.muted}
            bg={tasksDone > 0 ? colors.greenSoft : undefined}
          />
          <StatCard
            icon="❌"
            value={String(tasksDelayed)}
            label="Not done"
            loading={loading}
            accent={tasksDelayed > 0 ? colors.red : colors.muted}
            bg={tasksDelayed > 0 ? colors.redSoft : undefined}
          />
          <StatCard
            icon="📦"
            value={String(materialCount)}
            label="Materials"
            loading={loading}
            accent={materialCount > 0 ? colors.blue : colors.muted}
            bg={materialCount > 0 ? colors.blueSoft : undefined}
          />
          <StatCard
            icon="📷"
            value="0"
            label="Photos"
            loading={false}
            accent={colors.muted}
          />
        </div>

        {/* Completed today */}
        {doneTasks.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 900, color: colors.text, letterSpacing: '-0.01em' }}>
                Completed today
              </span>
              <div style={{ flex: 1, height: '1px', background: colors.line }} />
              <span style={{
                fontSize: '11px', fontWeight: 800, color: colors.green,
                background: colors.greenSoft, borderRadius: radius.pill, padding: '3px 8px',
              }}>
                {doneTasks.length}
              </span>
            </div>
            {doneTasks.map(task => (
              <div
                key={task.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  background: colors.greenSoft,
                  border: `1px solid ${colors.greenBorder}`,
                  borderRadius: radius.card,
                  marginBottom: '8px',
                }}
              >
                <div style={{
                  width: '32px', height: '32px', borderRadius: '10px',
                  background: '#fff', display: 'grid', placeItems: 'center', fontSize: '16px', flexShrink: 0,
                }}>
                  ✅
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: colors.text, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {task.name}
                  </div>
                  <div style={{ fontSize: '11px', color: colors.muted }}>
                    {task.level_tag}{task.trade_tag ? ` · ${task.trade_tag}` : ''}
                  </div>
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: 800, color: colors.green,
                  background: '#fff', borderRadius: radius.pill, padding: '3px 8px', flexShrink: 0,
                }}>
                  Done
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Rescheduled / not done */}
        {notDoneTasks.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 900, color: colors.text, letterSpacing: '-0.01em' }}>
                Rescheduled
              </span>
              <div style={{ flex: 1, height: '1px', background: colors.line }} />
              <span style={{
                fontSize: '11px', fontWeight: 800, color: colors.orange,
                background: colors.orangeSoft, borderRadius: radius.pill, padding: '3px 8px',
              }}>
                {notDoneTasks.length}
              </span>
            </div>
            {notDoneTasks.map(({ task, entry }) => (
              <div
                key={task.id}
                style={{
                  padding: '10px 12px',
                  background: colors.orangeSoft,
                  border: `1px solid ${colors.line}`,
                  borderRadius: radius.card,
                  marginBottom: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '10px',
                    background: '#fff', display: 'grid', placeItems: 'center', fontSize: '16px', flexShrink: 0,
                  }}>
                    🔁
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: colors.text, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {task.name}
                    </div>
                    <div style={{ fontSize: '11px', color: colors.muted }}>
                      {task.level_tag}{task.trade_tag ? ` · ${task.trade_tag}` : ''}
                    </div>
                  </div>
                  {entry.new_date && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '10px', color: colors.muted, textDecoration: 'line-through' }}>
                        {new Date(task.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 800, color: colors.orange }}>
                        → {new Date(entry.new_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  )}
                </div>
                {entry.reason && (
                  <div style={{ fontSize: '11px', color: colors.muted, marginTop: '6px', paddingLeft: '42px' }}>
                    {entry.reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Submit error */}
        {submitError && (
          <div style={{
            padding: '12px 16px',
            borderRadius: radius.card,
            background: colors.redSoft,
            border: `1px solid ${colors.redBorder}`,
            color: colors.red,
            fontSize: '13px',
            marginBottom: '16px',
            textAlign: 'center',
          }}>
            {submitError}
          </div>
        )}

        {/* Generate Report button */}
        <button
          onClick={handleSubmit}
          disabled={submitting || loading}
          style={{
            width: '100%',
            height: '56px',
            border: 'none',
            borderRadius: radius.btn,
            background: submitting || loading ? colors.mutedLight : gradients.bluePrimary,
            color: colors.surface,
            fontWeight: 800,
            fontSize: '16px',
            cursor: submitting || loading ? 'not-allowed' : 'pointer',
            letterSpacing: '-0.02em',
            boxShadow: submitting || loading ? 'none' : '0 10px 20px rgba(37,99,235,.25)',
            transition: 'all 0.2s',
          }}
        >
          {submitting ? 'Generating…' : 'Generate Report'}
        </button>
      </div>
    </ScreenShell>
  )
}
