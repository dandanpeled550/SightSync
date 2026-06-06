import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ScreenShell, { IconBtn } from '../components/ScreenShell'
import CrewAttendanceBlock from '../components/CrewAttendanceBlock'
import { colors, radius } from '../constants/theme'
import { fetchTodayLog } from '../api/daily_log'
import { fetchAttendance } from '../api/crew'
import { useProject } from '../contexts/ProjectContext'

export default function CrewAttendance() {
  const navigate = useNavigate()
  const { currentProject } = useProject()
  const PROJECT_ID = currentProject?.id ?? 1

  const [logId, setLogId]             = useState<number | null>(null)
  const [presentCount, setPresentCount] = useState<number>(0)
  const [totalCount, setTotalCount]     = useState<number>(0)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const log = await fetchTodayLog(PROJECT_ID)
        if (cancelled) return
        setLogId(log.id)
        const attendance = await fetchAttendance(log.id)
        if (cancelled) return
        setTotalCount(attendance.length)
        setPresentCount(attendance.filter(a => a.status === 'present').length)
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load crew data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [PROJECT_ID])

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })

  return (
    <ScreenShell
      title="Crew Attendance"
      subtitle={today}
      leftAction={<IconBtn onClick={() => navigate(-1)}>←</IconBtn>}
    >
      <div style={{ padding: '20px 20px 72px' }}>
        {/* On-site summary pill */}
        {!loading && !error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: presentCount > 0 ? colors.greenSoft : colors.surface2,
            border: `1px solid ${presentCount > 0 ? colors.greenBorder : colors.line}`,
            borderRadius: radius.card,
            padding: '14px 18px',
            marginBottom: '20px',
          }}>
            <span style={{ fontSize: '15px', fontWeight: 800, color: colors.text }}>
              On site today
            </span>
            <span style={{
              fontSize: '20px',
              fontWeight: 900,
              letterSpacing: '-0.04em',
              color: presentCount > 0 ? colors.green : colors.muted,
            }}>
              {presentCount} / {totalCount}
            </span>
          </div>
        )}

        {loading && (
          <div
            className="shimmer"
            style={{ height: '56px', borderRadius: radius.card, marginBottom: '20px' }}
          />
        )}

        {error && (
          <div style={{
            padding: '16px',
            borderRadius: radius.card,
            background: colors.redSoft,
            border: `1px solid ${colors.redBorder}`,
            color: colors.red,
            fontSize: '13px',
            marginBottom: '20px',
          }}>
            {error}
          </div>
        )}

        {logId && <CrewAttendanceBlock logId={logId} />}
      </div>
    </ScreenShell>
  )
}
