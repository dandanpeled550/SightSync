import { useState, useEffect } from 'react'
import ScreenShell from '../components/ScreenShell'
import { colors, radius, shadow } from '../constants/theme'
import { fetchAllProjectIncidents, type IncidentWithDate } from '../api/incidents'
import { useProject } from '../contexts/ProjectContext'

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function SafetyHistory() {
  const { currentProject } = useProject()
  const PROJECT_ID = currentProject?.id ?? 1

  const [incidents, setIncidents] = useState<IncidentWithDate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchAllProjectIncidents(PROJECT_ID)
        if (!cancelled) setIncidents(data)
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load incidents')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [PROJECT_ID])

  return (
    <ScreenShell title="Safety Incidents" subtitle="All recorded incidents">
      <div style={{ padding: '20px 20px 0', paddingBottom: '72px' }}>

        {loading && [0, 1, 2].map(i => (
          <div
            key={i}
            className="shimmer"
            style={{ height: '96px', borderRadius: radius.card, marginBottom: '12px' }}
          />
        ))}

        {error && !loading && (
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
        )}

        {!loading && !error && incidents.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '60px 20px',
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
              🛡
            </div>
            <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.04em', color: colors.text }}>
              No incidents
            </div>
            <div style={{ fontSize: '14px', color: colors.muted, lineHeight: 1.5 }}>
              No safety incidents have been recorded.
            </div>
          </div>
        )}

        {!loading && !error && incidents.map((inc, index) => (
          <div
            key={inc.id}
            className="fade-up"
            style={{
              background: colors.surface,
              border: `1px solid ${colors.redBorder}`,
              borderLeft: `4px solid ${colors.red}`,
              borderRadius: radius.card,
              padding: '14px 16px',
              marginBottom: '12px',
              boxShadow: shadow.card,
              animationDelay: `${index * 0.04}s`,
            }}
          >
            {/* Date + type row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                color: colors.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                {formatDate(inc.date)}
              </span>
              <span style={{
                fontSize: '12px',
                fontWeight: 800,
                color: colors.red,
                background: colors.redSoft,
                borderRadius: radius.pill,
                padding: '3px 10px',
              }}>
                {inc.incident_type}
              </span>
            </div>

            {/* Description */}
            <div style={{ fontSize: '14px', fontWeight: 700, color: colors.text, letterSpacing: '-0.01em', marginBottom: '6px' }}>
              {inc.description}
            </div>

            {/* Optional fields */}
            {inc.people_involved && (
              <div style={{ fontSize: '12px', color: colors.muted, marginBottom: '3px' }}>
                <span style={{ fontWeight: 700 }}>People involved: </span>
                {inc.people_involved}
              </div>
            )}
            {inc.corrective_action && (
              <div style={{ fontSize: '12px', color: colors.muted }}>
                <span style={{ fontWeight: 700 }}>Corrective action: </span>
                {inc.corrective_action}
              </div>
            )}
          </div>
        ))}
      </div>
    </ScreenShell>
  )
}
