import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ScreenShell, { IconBtn } from '../components/ScreenShell'
import { colors } from '../constants/theme'
import { fetchAllTasks, type Task } from '../api/tasks'

const PROJECT_ID = 1

function getDotColor(tasks: Task[]): string {
  if (tasks.length === 0)              return colors.mutedLight
  if (tasks.every(t => t.status === 'done'))  return '#22c55e'
  if (tasks.some(t => t.status === 'pending')) return colors.red
  return colors.orange
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Site() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const activeLevelParam = searchParams.get('level')

  const [tasks, setTasks]               = useState<Task[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
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

  useEffect(() => {
    if (!activeLevelParam || loading) return
    const el = levelRefs.current.get(activeLevelParam)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [activeLevelParam, loading])

  const levelGroups: Map<string, Task[]> = new Map()
  for (const task of tasks) {
    if (!levelGroups.has(task.level_tag)) levelGroups.set(task.level_tag, [])
    levelGroups.get(task.level_tag)!.push(task)
  }
  const levels = Array.from(levelGroups.keys())

  function handleApply() {
    if (selectedLevel) {
      navigate(`/?level=${encodeURIComponent(selectedLevel)}`)
    } else {
      navigate('/')
    }
  }

  return (
    <ScreenShell
      title="Tower B"
      subtitle="Choose level"
      leftAction={<IconBtn onClick={() => navigate(-1)}>‹</IconBtn>}
    >
      <div style={{ padding: '4px 18px', paddingBottom: '90px' }}>

        {loading && (
          <div style={{ padding: '48px 0', textAlign: 'center', color: colors.muted, fontSize: '14px' }}>
            Loading…
          </div>
        )}

        {error && !loading && (
          <div style={{
            background: colors.redSoft,
            border: `1px solid #ffd0d0`,
            borderRadius: '22px',
            padding: '16px',
            color: colors.red,
            fontSize: '14px',
          }}>
            {error}
          </div>
        )}

        {!loading && !error && tasks.length === 0 && (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: colors.muted, fontSize: '14px' }}>
            No tasks found.
          </div>
        )}

        {/* Building visualization + level list */}
        {!loading && !error && levels.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 120px',
            gap: '18px',
            alignItems: 'flex-start',
            marginTop: '10px',
          }}>
            {/* Tower graphic */}
            <div style={{
              height: `${Math.max(200, levels.length * 52)}px`,
              border: '2px solid #cbd5e1',
              borderRadius: '16px',
              background: 'repeating-linear-gradient(to bottom, #fff 0, #fff 49px, #e2e8f0 50px, #e2e8f0 52px)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Vertical structural lines */}
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: '33%', width: '2px', background: '#cbd5e1' }} />
              <div style={{ position: 'absolute', top: 0, bottom: 0, right: '33%', width: '2px', background: '#cbd5e1' }} />

              {/* Level highlights for the selected level */}
              {selectedLevel && levels.map((level, idx) => {
                if (level !== selectedLevel) return null
                const floorH = Math.floor((Math.max(200, levels.length * 52)) / levels.length)
                const top = idx * floorH
                return (
                  <div
                    key={level}
                    style={{
                      position: 'absolute',
                      top,
                      left: 0,
                      right: 0,
                      height: floorH,
                      background: 'rgba(37,99,235,0.08)',
                      pointerEvents: 'none',
                    }}
                  />
                )
              })}
            </div>

            {/* Level list */}
            <div>
              {levels.map(level => {
                const levelTasks = levelGroups.get(level) ?? []
                const dotColor   = getDotColor(levelTasks)
                const isActive   = selectedLevel === level || activeLevelParam === level

                return (
                  <div
                    key={level}
                    ref={el => {
                      if (el) levelRefs.current.set(level, el)
                      else levelRefs.current.delete(level)
                    }}
                    onClick={() => {
                      setSelectedLevel(level)
                      setExpandedLevel(expandedLevel === level ? null : level)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '9px',
                      padding: '12px 10px',
                      borderRadius: '16px',
                      background: isActive ? colors.blueSoft : 'transparent',
                      fontWeight: isActive ? 900 : 500,
                      color: isActive ? colors.blueDeep : colors.text,
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'background 0.12s',
                    }}
                  >
                    <span style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: dotColor,
                      flexShrink: 0,
                    }} />
                    {level}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Expanded task list for selected level */}
        {!loading && !error && expandedLevel && levelGroups.has(expandedLevel) && (
          <div style={{ marginTop: '14px' }}>
            <p style={{
              margin: '0 0 8px',
              fontSize: '13px',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              color: colors.text,
            }}>
              {expandedLevel}
            </p>
            <div style={{
              border: `1px solid ${colors.line}`,
              borderRadius: '22px',
              overflow: 'hidden',
              background: '#fff',
            }}>
              {(levelGroups.get(expandedLevel) ?? []).map((task, idx, arr) => (
                <div
                  key={task.id}
                  onClick={() => navigate(`/task/${task.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 14px',
                    borderBottom: idx < arr.length - 1 ? `1px solid ${colors.line}` : 'none',
                    cursor: 'pointer',
                    background: '#fff',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = colors.surface2)}
                  onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
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
                    <div style={{ fontWeight: 600, fontSize: '13px', color: colors.text }}>
                      {task.name}
                    </div>
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
          </div>
        )}
      </div>

      {/* Apply filters button */}
      <div style={{
        position: 'absolute',
        bottom: '72px',
        left: '18px',
        right: '18px',
      }}>
        <button
          onClick={handleApply}
          style={{
            width: '100%',
            height: '52px',
            border: 'none',
            borderRadius: '17px',
            background: colors.blueSoft,
            color: colors.blueDeep,
            fontWeight: 800,
            fontSize: '14px',
            letterSpacing: '-0.01em',
            cursor: 'pointer',
          }}
        >
          Apply filters
        </button>
      </div>
    </ScreenShell>
  )
}
