import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ScreenShell from '../components/ScreenShell'
import { colors, radius } from '../constants/theme'
import { fetchAllTasks, type Task } from '../api/tasks'

const PROJECT_ID = 1

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending:     { bg: '#f1f5f9', text: '#64748b', label: 'Pending' },
  in_progress: { bg: colors.blueSoft, text: colors.blueDeep, label: 'In Progress' },
  done:        { bg: colors.greenSoft, text: colors.green, label: 'Done' },
}

const TRADE_COLORS: Record<string, { bg: string; text: string }> = {
  electrical: { bg: colors.orangeSoft, text: '#b45309' },
  plumbing:   { bg: colors.blueSoft, text: colors.blueDeep },
  concrete:   { bg: colors.greenSoft, text: colors.green },
  framing:    { bg: '#faf5ff', text: '#7c3aed' },
  safety:     { bg: colors.redSoft, text: colors.red },
  cleanup:    { bg: '#f0fdf4', text: '#15803d' },
  materials:  { bg: colors.orangeSoft, text: '#b45309' },
  inspection: { bg: colors.blueSoft, text: colors.blueDeep },
}

function getTradePillStyle(trade: string | null): { bg: string; text: string } {
  if (!trade) return { bg: '#f1f5f9', text: '#64748b' }
  const lower = trade.toLowerCase()
  for (const key of Object.keys(TRADE_COLORS)) {
    if (lower.includes(key)) return TRADE_COLORS[key]
  }
  return { bg: '#f1f5f9', text: '#64748b' }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Plans() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchAllTasks(PROJECT_ID)
      .then(all => {
        setTasks(all)
        // auto-expand all groups initially
        const levels = new Set(all.map(t => t.level_tag))
        setExpandedLevels(levels)
      })
      .catch(err => setError(err?.message ?? 'Failed to load tasks'))
      .finally(() => setLoading(false))
  }, [])

  // Group tasks by level_tag preserving insertion order
  const levelGroups: Map<string, Task[]> = new Map()
  for (const task of tasks) {
    if (!levelGroups.has(task.level_tag)) levelGroups.set(task.level_tag, [])
    levelGroups.get(task.level_tag)!.push(task)
  }

  function toggleLevel(level: string) {
    setExpandedLevels(prev => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level)
      else next.add(level)
      return next
    })
  }

  return (
    <ScreenShell title="Plans & Deliveries" subtitle="All tasks">
      <div style={{ padding: '16px' }}>

        {loading && (
          <div style={{ textAlign: 'center', color: colors.muted, padding: '40px 0', fontSize: '14px' }}>
            Loading tasks…
          </div>
        )}

        {error && !loading && (
          <div style={{
            background: colors.redSoft,
            border: `1px solid #ffd0d0`,
            borderRadius: radius.card,
            padding: '16px',
            color: colors.red,
            fontSize: '14px',
          }}>
            {error}
          </div>
        )}

        {!loading && !error && tasks.length === 0 && (
          <div style={{ textAlign: 'center', color: colors.muted, padding: '60px 20px', fontSize: '14px' }}>
            No tasks found. Upload a schedule to get started.
          </div>
        )}

        {!loading && !error && Array.from(levelGroups.entries()).map(([level, levelTasks]) => {
          const isExpanded = expandedLevels.has(level)
          const doneCnt = levelTasks.filter(t => t.status === 'done').length
          const totalCnt = levelTasks.length

          return (
            <div key={level} style={{ marginBottom: '8px' }}>
              {/* Level header */}
              <button
                onClick={() => toggleLevel(level)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '13px 14px',
                  background: isExpanded ? colors.blueSoft : colors.surface2,
                  border: `1px solid ${isExpanded ? '#bfdbfe' : colors.line}`,
                  borderRadius: isExpanded ? `${radius.card} ${radius.card} 0 0` : radius.card,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{ fontSize: '16px' }}>🏗</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '14px', color: isExpanded ? colors.blueDeep : colors.text }}>
                    {level}
                  </div>
                  <div style={{ fontSize: '12px', color: colors.muted }}>
                    {doneCnt}/{totalCnt} done
                  </div>
                </div>
                <span style={{ fontSize: '16px', color: colors.muted, transform: isExpanded ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>›</span>
              </button>

              {/* Task rows */}
              {isExpanded && (
                <div style={{
                  border: `1px solid ${colors.line}`,
                  borderTop: 'none',
                  borderRadius: `0 0 ${radius.card} ${radius.card}`,
                  overflow: 'hidden',
                  background: colors.surface,
                  marginBottom: '4px',
                }}>
                  {levelTasks.map((task, idx) => {
                    const tradePill = getTradePillStyle(task.trade_tag)
                    const statusStyle = STATUS_COLORS[task.status] ?? STATUS_COLORS['pending']

                    return (
                      <div
                        key={task.id}
                        onClick={() => navigate(`/task/${task.id}`)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '12px 14px',
                          borderBottom: idx < levelTasks.length - 1 ? `1px solid ${colors.line}` : 'none',
                          cursor: 'pointer',
                          background: colors.surface,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = colors.surface2)}
                        onMouseLeave={e => (e.currentTarget.style.background = colors.surface)}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '14px', color: colors.text, marginBottom: '4px' }}>
                            {task.name}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {task.trade_tag && (
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                borderRadius: radius.pill,
                                padding: '3px 8px',
                                background: tradePill.bg,
                                color: tradePill.text,
                              }}>
                                {task.trade_tag}
                              </span>
                            )}
                            <span style={{ fontSize: '11px', color: colors.mutedLight }}>
                              {formatDate(task.start_date)} → {formatDate(task.end_date)}
                            </span>
                          </div>
                        </div>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          borderRadius: radius.pill,
                          padding: '5px 9px',
                          background: statusStyle.bg,
                          color: statusStyle.text,
                          whiteSpace: 'nowrap',
                        }}>
                          {statusStyle.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </ScreenShell>
  )
}
