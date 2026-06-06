import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { colors, shadow, radius } from '../constants/theme'
import { fetchTodayLog } from '../api/daily_log'
import { fetchAllTasks, type Task } from '../api/tasks'
import { fetchAttendance, type AttendanceRecord } from '../api/crew'
import { fetchWeather, type DailyForecast } from '../api/weather'
import { useProject } from '../contexts/ProjectContext'

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function wmoToEmoji(code: number): string {
  if (code === 0)              return '☀️'
  if (code <= 2)               return '⛅'
  if (code === 3)              return '☁️'
  if (code >= 51 && code <= 67) return '🌧️'
  if (code >= 71 && code <= 77) return '❄️'
  if (code >= 80 && code <= 82) return '🌦️'
  if (code >= 95)              return '⛈️'
  return '🌤️'
}

function wmoToLabel(code: number): string {
  if (code === 0)               return 'Sunny'
  if (code <= 2)                return 'Partly Cloudy'
  if (code === 3)               return 'Cloudy'
  if (code >= 51 && code <= 67) return 'Rainy'
  if (code >= 71 && code <= 77) return 'Snow'
  if (code >= 80 && code <= 82) return 'Showers'
  if (code >= 95)               return 'Thunderstorm'
  return 'Mixed'
}

const AVATAR_COLORS = [colors.blue, '#7c3aed', '#0891b2', '#059669', '#d97706']

export default function AsidePanel() {
  const navigate = useNavigate()
  const { currentProject } = useProject()
  const projectId   = currentProject?.id ?? 1
  const projectCity = currentProject?.location_city ?? 'Tel Aviv'

  const [forecast, setForecast]         = useState<DailyForecast[]>([])
  const [allTodayTasks, setAllTodayTasks] = useState<Task[]>([])
  const [attendance, setAttendance]     = useState<AttendanceRecord[]>([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const log = await fetchTodayLog(projectId)
        if (cancelled) return
        const todayStr = new Date().toISOString().split('T')[0]
        const [allTasks, att] = await Promise.all([
          fetchAllTasks(projectId),
          fetchAttendance(log.id),
        ])
        if (cancelled) return
        const active = Array.isArray(allTasks)
          ? allTasks.filter(t => t.start_date <= todayStr && t.end_date >= todayStr)
          : []
        setAllTodayTasks(active)
        setAttendance(Array.isArray(att) ? att : [])
      } catch { /* non-blocking */ }
      try {
        const wx = await fetchWeather(projectCity)
        if (!cancelled) setForecast(wx.forecast.slice(0, 4))
      } catch { /* weather unavailable */ }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [projectId, projectCity])

  const doneCount    = allTodayTasks.filter(t => t.status === 'done').length
  const totalCount   = allTodayTasks.length
  const pct          = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0
  const presentCount = attendance.filter(a => a.status === 'present').length

  // SVG donut constants
  const R = 28
  const circumference = 2 * Math.PI * R
  const fillLen = circumference * pct / 100
  const donutColor = pct === 100 ? colors.green : colors.primary

  const today = forecast[0]

  const asideCard: React.CSSProperties = {
    background: colors.surface,
    border: `1px solid #e8edf5`,
    borderRadius: radius.card,
    boxShadow: shadow.card,
    overflow: 'hidden',
  }

  const cardLabel: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: colors.mutedLight,
    padding: '16px 18px 0',
    display: 'block',
    marginBottom: '12px',
  }

  const linkRow: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 18px 14px',
    borderTop: `1px solid #f0f2f5`,
    fontSize: '12px',
    fontWeight: 700,
    color: colors.muted,
    cursor: 'pointer',
  }

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        background: colors.surface,
        borderLeft: `1px solid ${colors.line}`,
        padding: '28px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        overflowY: 'auto',
      }}>
        {[90, 200, 140].map((h, i) => (
          <div key={i} className="shimmer" style={{ height: `${h}px`, borderRadius: radius.card }} />
        ))}
      </div>
    )
  }

  return (
    <div style={{
      height: '100vh',
      background: colors.surface,
      borderLeft: `1px solid ${colors.line}`,
      padding: '28px 20px 60px',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
    }}>

      {/* ── Weather card ── */}
      <div style={asideCard}>
        <span style={cardLabel}>Weather · {projectCity}</span>

        {today ? (
          <>
            {/* Hero: big emoji + temp */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '0 18px 14px',
              borderBottom: `1px solid #f0f2f5`,
            }}>
              <span style={{ fontSize: '40px', lineHeight: 1 }}>{wmoToEmoji(today.weather_code)}</span>
              <div>
                <div style={{ fontSize: '36px', fontWeight: 900, color: colors.text, letterSpacing: '-0.05em', lineHeight: 1 }}>
                  {Math.round(today.max_temp)}°
                </div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: colors.text, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '3px' }}>
                  {wmoToLabel(today.weather_code)}
                </div>
              </div>
            </div>

            {/* 4-day forecast grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              padding: '14px 18px 6px',
            }}>
              {forecast.map(day => {
                const d = new Date(day.date + 'T00:00:00')
                const dow = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
                return (
                  <div key={day.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: colors.mutedLight, letterSpacing: '0.04em' }}>{dow}</span>
                    <span style={{ fontSize: '20px', lineHeight: 1 }}>{wmoToEmoji(day.weather_code)}</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: colors.text, letterSpacing: '-0.02em' }}>{Math.round(day.max_temp)}°</span>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: colors.mutedLight, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                      {wmoToLabel(day.weather_code).split(' ')[0]}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div style={{ padding: '0 18px 16px', fontSize: '13px', color: colors.muted }}>No forecast available</div>
        )}

        <div style={linkRow} onClick={() => navigate('/plans')}>
          View Full Forecast
          <span style={{ color: colors.mutedLight }}>›</span>
        </div>
      </div>

      {/* ── Progress card ── */}
      <div style={asideCard}>
        <span style={cardLabel}>Today's Progress</span>
        <div style={{ padding: '0 18px 6px' }}>

          {/* Donut + label row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '14px' }}>
            <div style={{ position: 'relative', width: '72px', height: '72px', flexShrink: 0 }}>
              <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="36" cy="36" r={R} fill="none" stroke="#f0f2f5" strokeWidth="8" />
                <circle
                  cx="36" cy="36" r={R}
                  fill="none"
                  stroke={donutColor}
                  strokeWidth="8"
                  strokeDasharray={`${fillLen} ${circumference}`}
                  strokeLinecap="round"
                />
              </svg>
              <div style={{
                position: 'absolute', inset: 0,
                display: 'grid', placeItems: 'center',
                fontSize: '13px', fontWeight: 900,
                color: colors.text, letterSpacing: '-0.02em',
              }}>
                {pct}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: colors.text, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {totalCount === 0 ? 'No tasks' : `${doneCount} OF ${totalCount} TASKS`}
              </div>
              {totalCount > 0 && (
                <div style={{ fontSize: '10px', fontWeight: 700, color: colors.mutedLight, letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: '4px' }}>
                  {pct === 100 ? 'Completed ✓' : 'Completed'}
                </div>
              )}
            </div>
          </div>

          {/* Bar */}
          {totalCount > 0 && (
            <>
              <div style={{ height: '8px', background: '#f0f2f5', borderRadius: '999px', overflow: 'hidden', marginBottom: '10px' }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: donutColor,
                  borderRadius: '999px',
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <div style={{ fontSize: '12px', color: colors.muted, paddingBottom: '4px' }}>
                {pct === 100 ? 'Great job! All tasks complete.' : `${totalCount - doneCount} task${totalCount - doneCount !== 1 ? 's' : ''} remaining.`}
              </div>
            </>
          )}
        </div>
        <div style={linkRow} onClick={() => navigate('/')}>
          View Today's Tasks
          <span style={{ color: colors.mutedLight }}>›</span>
        </div>
      </div>

      {/* ── Crew card ── */}
      {attendance.length > 0 && (
        <div style={asideCard}>
          <span style={cardLabel}>Crew · {presentCount}/{attendance.length} present</span>
          <div style={{ display: 'flex', flexDirection: 'column', padding: '0 18px 14px', gap: '0' }}>
            {attendance.slice(0, 4).map((member, i) => (
              <div key={member.crew_member_id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 0',
                borderBottom: i < Math.min(attendance.length, 4) - 1 ? `1px solid #f7f8fa` : 'none',
              }}>
                <div style={{
                  width: '30px',
                  height: '30px',
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
                  <div style={{ fontSize: '12px', fontWeight: 700, color: colors.text, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {member.name}
                  </div>
                  {member.profession && (
                    <div style={{ fontSize: '10px', color: colors.muted }}>{member.profession}</div>
                  )}
                </div>
                {/* Status badge pill */}
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '999px',
                  whiteSpace: 'nowrap',
                  ...(member.status === 'present'
                    ? { background: colors.greenSoft, color: colors.green }
                    : member.status === 'partial'
                    ? { background: colors.orangeSoft, color: colors.orange }
                    : { background: colors.surface2, color: colors.mutedLight }),
                }}>
                  {member.status === 'present' ? 'Present' : member.status === 'partial' ? 'Partial' : 'Absent'}
                </span>
              </div>
            ))}
            {attendance.length > 4 && (
              <div style={{ fontSize: '11px', color: colors.muted, textAlign: 'center', paddingTop: '8px' }}>
                +{attendance.length - 4} more
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
