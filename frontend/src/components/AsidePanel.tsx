import { useState, useEffect } from 'react'
import { colors } from '../constants/theme'
import { fetchTodayLog } from '../api/daily_log'
import { fetchAllTasks, type Task } from '../api/tasks'
import { fetchAttendance, type AttendanceRecord } from '../api/crew'
import { fetchWeather, type DailyForecast } from '../api/weather'
import { useProject } from '../contexts/ProjectContext'

const WMO_LABEL: Record<number, string> = {
  0: 'Sun', 1: 'Clr', 2: 'PC', 3: 'Cld',
  51: 'Driz', 61: 'Rain', 71: 'Snow', 95: 'Tstm',
}
function weatherLabel(code: number): string {
  return WMO_LABEL[code] ?? '—'
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

const AVATAR_COLORS = [colors.blue, '#7c3aed', '#0891b2', '#059669', '#d97706']

export default function AsidePanel() {
  const { currentProject } = useProject()
  const projectId = currentProject?.id ?? 1
  const projectCity = currentProject?.location_city ?? 'Tel Aviv'

  const [forecast, setForecast]     = useState<DailyForecast[]>([])
  const [allTodayTasks, setAllTodayTasks] = useState<Task[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      // Tasks + attendance — critical; weather is optional and must not block these
      try {
        const log = await fetchTodayLog(projectId)
        if (cancelled) return
        const todayStr = new Date().toISOString().split('T')[0]
        const [allTasks, att] = await Promise.all([
          fetchAllTasks(projectId),
          fetchAttendance(log.id),
        ])
        if (cancelled) return
        // Filter all tasks to those active today (includes done ones for accurate progress)
        const activeTodayTasks = Array.isArray(allTasks)
          ? allTasks.filter(t => t.start_date <= todayStr && t.end_date >= todayStr)
          : []
        setAllTodayTasks(activeTodayTasks)
        setAttendance(Array.isArray(att) ? att : [])
      } catch {
        // non-blocking
      }
      // Weather in its own try/catch so a failure never zeros out task/crew data
      try {
        const wx = await fetchWeather(projectCity)
        if (!cancelled) setForecast(wx.forecast.slice(0, 4))
      } catch {
        // weather unavailable — panel still renders without forecast
      }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [projectId, projectCity])

  const doneCount    = allTodayTasks.filter(t => t.status === 'done').length
  const totalCount   = allTodayTasks.length
  const pct          = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0
  const presentCount = attendance.filter(a => a.status === 'present').length

  const cardStyle = {
    background: colors.surface,
    border: `1px solid ${colors.line}`,
    borderRadius: '20px',
    padding: '14px',
    marginBottom: '12px',
  } as const

  const sectionLabel = {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    color: colors.mutedLight,
    marginBottom: '10px',
  }

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        background: colors.surface2,
        borderLeft: `1px solid ${colors.line}`,
        padding: '20px 16px',
        overflowY: 'auto',
      }}>
        {[1,2,3].map(i => (
          <div key={i} className="shimmer" style={{ height: '90px', borderRadius: '20px', marginBottom: '12px' }} />
        ))}
      </div>
    )
  }

  return (
    <div style={{
      height: '100vh',
      background: colors.surface2,
      borderLeft: `1px solid ${colors.line}`,
      padding: '20px 16px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Weather */}
      <div style={cardStyle}>
        <div style={sectionLabel}>Weather · {projectCity}</div>
        {forecast.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {forecast.map(day => {
              const d = new Date(day.date + 'T00:00:00')
              const dow = d.toLocaleDateString('en-US', { weekday: 'short' })
              return (
                <div key={day.date} style={{
                  background: colors.surface2,
                  borderRadius: '12px',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: colors.muted }}>{dow}</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: colors.muted }}>{weatherLabel(day.weather_code)}</span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: colors.text, letterSpacing: '-0.02em' }}>
                    {Math.round(day.max_temp)}°
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: colors.muted }}>No forecast available</div>
        )}
      </div>

      {/* Progress */}
      <div style={cardStyle}>
        <div style={sectionLabel}>Today's Progress</div>
        <div style={{ fontSize: '14px', fontWeight: 800, color: colors.text, marginBottom: '8px', letterSpacing: '-0.02em' }}>
          {totalCount === 0 ? 'No tasks today' : `${doneCount} of ${totalCount} tasks · ${pct}%`}
        </div>
        {totalCount > 0 && (
          <div style={{ height: '6px', background: colors.line, borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${pct}%`,
              background: pct === 100 ? colors.green : colors.primary,
              borderRadius: '999px',
              transition: 'width 0.4s ease',
            }} />
          </div>
        )}
      </div>

      {/* Crew */}
      {attendance.length > 0 && (
        <div style={cardStyle}>
          <div style={sectionLabel}>Crew · {presentCount}/{attendance.length} present</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {attendance.slice(0, 3).map((member, i) => (
              <div key={member.crew_member_id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '9px',
                  background: AVATAR_COLORS[i % AVATAR_COLORS.length],
                  color: colors.surface,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '10px',
                  fontWeight: 800,
                  flexShrink: 0,
                }}>
                  {initials(member.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: colors.text, letterSpacing: '-0.01em' }}>
                    {member.name}
                  </div>
                  {member.profession && (
                    <div style={{ fontSize: '10px', color: colors.muted }}>{member.profession}</div>
                  )}
                </div>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: member.status === 'present' ? colors.green
                    : member.status === 'partial'  ? colors.orange
                    : colors.mutedLight,
                  flexShrink: 0,
                }} />
              </div>
            ))}
            {attendance.length > 3 && (
              <div style={{ fontSize: '11px', color: colors.muted, textAlign: 'center' }}>
                +{attendance.length - 3} more
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
