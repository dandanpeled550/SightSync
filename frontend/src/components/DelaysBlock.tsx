import { useState, useEffect } from 'react'
import { colors, radius } from '../constants/theme'
import { fetchDelays, type DelayGroup } from '../api/tasks'

interface Props {
  logId: number
  readOnly?: boolean
}

function fmt(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function DelaysBlock({ logId }: Props) {
  const [groups, setGroups] = useState<DelayGroup[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchDelays(logId)
      .then(setGroups)
      .catch(() => setGroups([]))
      .finally(() => setLoading(false))
  }, [logId])

  if (loading) return null
  if (groups.length === 0) return null

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 900, color: colors.text, letterSpacing: '-0.01em' }}>
          Delays
        </span>
        <div style={{ flex: 1, height: '1px', background: colors.line }} />
        <span style={{
          fontSize: '11px', fontWeight: 800, color: colors.orange,
          background: colors.orangeSoft, borderRadius: radius.pill, padding: '3px 8px',
        }}>
          {groups.length}
        </span>
      </div>

      {groups.map(group => (
        <div
          key={group.triggering_entry_id}
          style={{
            background: colors.orangeSoft,
            border: `1px solid ${colors.line}`,
            borderRadius: radius.card,
            marginBottom: '8px',
            overflow: 'hidden',
          }}
        >
          {/* Root task row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '10px',
              background: '#fff', display: 'grid', placeItems: 'center',
              fontSize: '16px', flexShrink: 0,
            }}>
              ⚠️
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '13px', fontWeight: 800, color: colors.text,
                letterSpacing: '-0.02em', whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {group.trigger_task_name}
              </div>
              {group.reason && (
                <div style={{ fontSize: '11px', color: colors.muted, marginTop: '1px' }}>
                  {group.reason}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: colors.orange }}>
                → {fmt(group.new_date)}
              </div>
              <span style={{
                fontSize: '10px', fontWeight: 800, color: colors.orange,
                background: '#fff', borderRadius: radius.pill, padding: '2px 6px',
              }}>
                Delayed
              </span>
            </div>
          </div>

          {/* Cascade impact rows */}
          {group.impacts.length > 0 && (
            <div style={{
              borderTop: `1px solid ${colors.line}`,
              background: '#fff',
              padding: '6px 12px 6px 54px',
            }}>
              {group.impacts.map((impact, i) => (
                <div
                  key={impact.task_id ?? i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    paddingTop: '5px', paddingBottom: '5px',
                    borderBottom: i < group.impacts.length - 1 ? `1px solid ${colors.line}` : 'none',
                  }}
                >
                  <span style={{ fontSize: '11px', color: colors.mutedLight, flexShrink: 0 }}>↳</span>
                  <span style={{
                    fontSize: '12px', color: colors.muted, flex: 1, minWidth: 0,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {impact.task_name}
                  </span>
                  <span style={{
                    fontSize: '11px', fontWeight: 800, color: colors.orange,
                    background: colors.orangeSoft, borderRadius: radius.pill,
                    padding: '2px 6px', flexShrink: 0,
                  }}>
                    +{impact.days_shifted}d
                  </span>
                  <span style={{ fontSize: '11px', color: colors.muted, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {fmt(impact.old_start_date)} → {fmt(impact.new_start_date)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
