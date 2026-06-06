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
            border: `1px solid ${colors.line}`,
            borderRadius: radius.card,
            marginBottom: '10px',
            overflow: 'hidden',
          }}
        >
          {/* Root task — the task that was marked not done */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            padding: '12px 12px 10px',
            background: colors.orangeSoft,
          }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '10px',
              background: '#fff', display: 'grid', placeItems: 'center',
              fontSize: '16px', flexShrink: 0, marginTop: '1px',
            }}>
              !
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '13px', fontWeight: 800, color: colors.text,
                letterSpacing: '-0.02em', marginBottom: '3px',
              }}>
                {group.trigger_task_name}
              </div>
              {group.reason && (
                <div style={{ fontSize: '11px', color: colors.muted, marginBottom: '5px' }}>
                  {group.reason}
                </div>
              )}
              {/* Date range row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                {group.old_date && (
                  <>
                    <span style={{ fontSize: '11px', color: colors.muted, textDecoration: 'line-through' }}>
                      {fmt(group.old_date)}
                    </span>
                    <span style={{ fontSize: '10px', color: colors.mutedLight }}>→</span>
                  </>
                )}
                <span style={{ fontSize: '11px', fontWeight: 800, color: colors.orange }}>
                  {fmt(group.new_date)}
                </span>
              </div>
            </div>
            {/* Days delayed badge */}
            {group.days_shifted != null && group.days_shifted > 0 && (
              <div style={{
                background: colors.orange,
                color: '#fff',
                borderRadius: radius.pill,
                padding: '4px 9px',
                fontSize: '12px',
                fontWeight: 900,
                flexShrink: 0,
                letterSpacing: '-0.02em',
              }}>
                +{group.days_shifted}d
              </div>
            )}
          </div>

          {/* Effect chain */}
          {group.impacts.length > 0 && (
            <div style={{ background: colors.surface }}>
              {/* Chain label */}
              <div style={{
                padding: '7px 12px 6px 54px',
                borderTop: `1px solid ${colors.line}`,
                fontSize: '10px', fontWeight: 800, color: colors.muted,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                Effect chain — {group.impacts.length} task{group.impacts.length > 1 ? 's' : ''} pushed
              </div>

              {group.impacts.map((impact, i) => (
                <div
                  key={impact.task_id ?? i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px 8px 54px',
                    borderTop: `1px solid ${colors.line}`,
                  }}
                >
                  {/* Connector */}
                  <span style={{ fontSize: '12px', color: colors.mutedLight, flexShrink: 0 }}>↳</span>

                  {/* Task name */}
                  <span style={{
                    fontSize: '12px', fontWeight: 700, color: colors.text,
                    flex: 1, minWidth: 0,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {impact.task_name}
                  </span>

                  {/* Date range */}
                  <span style={{
                    fontSize: '11px', color: colors.muted,
                    flexShrink: 0, whiteSpace: 'nowrap',
                  }}>
                    {fmt(impact.old_start_date)} → {fmt(impact.new_start_date)}
                  </span>

                  {/* Days badge */}
                  <span style={{
                    fontSize: '11px', fontWeight: 800, color: colors.orange,
                    background: colors.orangeSoft, borderRadius: radius.pill,
                    padding: '2px 7px', flexShrink: 0,
                  }}>
                    +{impact.days_shifted}d
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
