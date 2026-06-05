import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ScreenShell from '../components/ScreenShell'
import { colors, radius } from '../constants/theme'
import { fetchAllTasks, type Task } from '../api/tasks'

const PROJECT_ID = 1

function getDotColor(tasks: Task[]): string {
  if (tasks.length === 0) return colors.mutedLight
  const allDone = tasks.every(t => t.status === 'done')
  if (allDone) return '#22c55e'
  const anyBlocked = tasks.some(t => t.status === 'pending')
  if (anyBlocked) return colors.red
  return colors.orange
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Site() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeLevelParam = searchParams.get('level')

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedLevel, setExpandedLevel] = useState<string | null>(activeLevelParam)
  const [selectedLevel, setSelectedLevel] = useState<string | null>(activeLevelParam)

  const levelRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    setLoading(true)
    setError(null)
    async function load() {
      try {
        const all = await fetchAllTasks(PROJECT_ID)
        setTasks(Array.isArray(all) ? all : [])
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load tasks')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Auto-scroll to highlighted level when tasks load
  useEffect(() => {
    if (!activeLevelParam || loading) return
    const el = levelRefs.current.get(activeLevelParam)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeLevelParam, loading])

  // Build level groups preserving order
  const levelGroups: Map<string, Task[]> = new Map()
  for (const task of tasks) {
    if (!levelGroups.has(task.level_tag)) levelGroups.set(task.level_tag, [])
    levelGroups.get(task.level_tag)!.push(task)
  }

  function handleApply() {
    if (selectedLevel) {
      navigate(`/?level=${encodeURIComponent(selectedLevel)}`)
    } else {
      navigate('/')
    }
  }

  return (
    <ScreenShell title="Tower B" subtitle="Choose level">
      <div style={{ padding: '16px', paddingBottom: '80px' }}>

        {loading && (
          <div style={{ textAlign: 'center', color: colors.muted, padding: '40px 0', fontSize: '14px' }}>
            Loading site tree…
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
            No tasks found.
          </div>
        )}

        {!loading && !error && Array.from(levelGroups.entries()).map(([level, levelTasks]) => {
          const totalCnt = levelTasks.length
          const pendingCnt = levelTasks.filter(t => t.status !== 'done').length
          const dotColor = getDotColor(levelTasks)
          const isActive = selectedLevel === level || activeLevelParam === level
          const isExpanded = expandedLevel === level

          return (
            <div
              key={level}
              ref={el => {
                if (el) levelRefs.current.set(level, el)
                else levelRefs.current.delete(level)
              }}
              style={{ marginBottom: '4px' }}
            >
              {/* Level row */}
              <div
                onClick={() => {
                  setSelectedLevel(level)
                  setExpandedLevel(isExpanded ? null : level)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '9px',
                  padding: '12px 14px',
                  borderRadius: isExpanded ? `${radius.task} ${radius.task} 0 0` : radius.task,
                  background: isActive ? colors.blueSoft : colors.surface2,
                  border: `1px solid ${isActive ? '#bfdbfe' : colors.line}`,
                  cursor: 'pointer',
                  fontWeight: isActive ? 900 : 500,
                  color: isActive ? colors.blueDeep : colors.text,
                  fontSize: '13px',
                  transition: 'background 0.15s',
                }}
              >
                <span style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: dotColor,
                  flexShrink: 0,
                }} />
                <span style={{ flex: 1 }}>{level}</span>
                <span style={{ fontSize: '11px', color: colors.muted, fontWeight: 500 }}>
                  {pendingCnt} pending / {totalCnt}
                </span>
                <span style={{
                  fontSize: '14px',
                  color: colors.muted,
                  transform: isExpanded ? 'rotate(90deg)' : 'none',
                  display: 'inline-block',
                  transition: 'transform 0.2s',
                }}>
                  ›
                </span>
              </div>

              {/* Expanded task list */}
              {isExpanded && (
                <div style={{
                  border: `1px solid ${colors.line}`,
                  borderTop: 'none',
                  borderRadius: `0 0 ${radius.task} ${radius.task}`,
                  background: colors.surface,
                  overflow: 'hidden',
                  marginBottom: '4px',
                }}>
                  {levelTasks.map((task, idx) => (
                    <div
                      key={task.id}
                      onClick={() => navigate(`/task/${task.id}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 14px',
                        borderBottom: idx < levelTasks.length - 1 ? `1px solid ${colors.line}` : 'none',
                        cursor: 'pointer',
                        background: colors.surface,
                        fontSize: '13px',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = colors.surface2)}
                      onMouseLeave={e => (e.currentTarget.style.background = colors.surface)}
                    >
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: task.status === 'done'
                          ? '#22c55e'
                          : task.status === 'in_progress'
                            ? colors.blue
                            : colors.mutedLight,
                        flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: colors.text }}>{task.name}</div>
                        {task.trade_tag && (
                          <div style={{ fontSize: '11px', color: colors.muted }}>{task.trade_tag}</div>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: colors.mutedLight, whiteSpace: 'nowrap' }}>
                        {formatDate(task.start_date)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Apply filters button */}
      <div style={{
        position: 'absolute',
        bottom: '72px',
        left: '16px',
        right: '16px',
      }}>
        <button
          onClick={handleApply}
          style={{
            width: '100%',
            height: '52px',
            border: 'none',
            borderRadius: radius.btn,
            background: colors.blueSoft,
            color: colors.blueDeep,
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Apply filters
        </button>
      </div>
    </ScreenShell>
  )
}
