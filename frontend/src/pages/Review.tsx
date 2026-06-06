import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import ScreenShell from '../components/ScreenShell'
import { IconBtn } from '../components/ScreenShell'
import { colors, radius } from '../constants/theme'
import {
  confirmSchedule,
  type ExtractionResult,
  type ExtractedTask,
  type InferredDependency,
} from '../api/tasks'
import { useProject } from '../contexts/ProjectContext'

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface LocationState {
  result: ExtractionResult
}

export default function Review() {
  const navigate = useNavigate()
  const location = useLocation()
  const { currentProject } = useProject()
  const PROJECT_ID = currentProject?.id ?? 1
  const state = location.state as LocationState | null
  const result = state?.result ?? null

  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [activeDeps, setActiveDeps] = useState<InferredDependency[]>([])

  useEffect(() => {
    if (result?.dependencies) {
      setActiveDeps(result.dependencies.filter(d => d.task_index !== d.depends_on_index))
    }
  }, [result])

  // No extraction result — guard screen
  if (!result) {
    return (
      <ScreenShell title="Review Schedule" hideBottomNav>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 24px',
          gap: '20px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px' }}>📋</div>
          <p style={{ margin: 0, fontSize: '16px', color: colors.muted }}>
            No schedule data found. Upload a schedule first.
          </p>
          <button
            onClick={() => navigate('/onboard')}
            style={{
              padding: '14px 32px',
              background: colors.blue,
              color: colors.surface,
              border: 'none',
              borderRadius: radius.btn,
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Upload Schedule
          </button>
        </div>
      </ScreenShell>
    )
  }

  async function handleConfirm() {
    setConfirming(true)
    setConfirmError(null)
    try {
      await confirmSchedule(PROJECT_ID, result!.tasks, activeDeps)
      navigate('/plans')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed. Please try again.'
      setConfirmError(msg)
    } finally {
      setConfirming(false)
    }
  }

  function removeDep(taskIndex: number, dependsOnIndex: number) {
    setActiveDeps(prev =>
      prev.filter(d => !(d.task_index === taskIndex && d.depends_on_index === dependsOnIndex))
    )
  }

  const taskCount = result.tasks.length
  const confidencePct = Math.round(result.confidence * 100)

  const taskByIndex = (idx: number): ExtractedTask | undefined => result.tasks[idx]

  return (
    <ScreenShell
      title="Review Schedule"
      hideBottomNav
      leftAction={
        <IconBtn onClick={() => navigate('/onboard')}>‹</IconBtn>
      }
      rightAction={
        <div style={{
          background: colors.blueSoft,
          color: colors.blue,
          borderRadius: radius.pill,
          padding: '4px 10px',
          fontSize: '12px',
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}>
          {taskCount} task{taskCount !== 1 ? 's' : ''}
        </div>
      }
    >
      {/* Confidence indicator */}
      <div style={{
        margin: '16px 16px 8px',
        padding: '12px 16px',
        background: colors.greenSoft,
        borderRadius: radius.card,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <span style={{ fontSize: '20px' }}>✅</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '14px', color: colors.green }}>
            {confidencePct}% confidence
          </div>
          <div style={{ fontSize: '12px', color: colors.muted }}>
            AI extraction complete — review tasks below
          </div>
        </div>
      </div>


      {/* Task content */}
      <div style={{ padding: '8px 16px 100px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* Flat task list — deps shown inline beneath each task */}
        {result.tasks.map((task: ExtractedTask, idx: number) => {
          const taskDeps = activeDeps.filter(d => d.task_index === idx)
          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <TaskCard task={task} />
              {taskDeps.length > 0 && (
                <div style={{
                  marginLeft: '12px',
                  padding: '8px 12px',
                  background: colors.surface2,
                  borderRadius: radius.card,
                  border: `1px solid ${colors.line}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}>
                  {taskDeps.map((dep, di) => (
                    <DepRow
                      key={di}
                      dep={dep}
                      fromTask={taskByIndex(dep.task_index)}
                      toTask={taskByIndex(dep.depends_on_index)}
                      onRemove={() => removeDep(dep.task_index, dep.depends_on_index)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* Confirm error */}
        {confirmError && (
          <div style={{
            padding: '12px 16px',
            background: colors.redSoft,
            borderRadius: radius.card,
            color: colors.red,
            fontSize: '14px',
            fontWeight: 500,
          }}>
            {confirmError}
          </div>
        )}
      </div>

      {/* Sticky bottom action bar */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        padding: '12px 16px 20px',
        background: 'rgba(255,255,255,0.97)',
        backdropFilter: 'blur(10px)',
        borderTop: `1px solid ${colors.line}`,
        display: 'flex',
        gap: '10px',
        zIndex: 20,
      }}>
        <button
          onClick={() => navigate('/onboard')}
          style={{
            flex: '0 0 auto',
            padding: '14px 18px',
            background: colors.surface2,
            color: colors.text,
            border: `1.5px solid ${colors.line}`,
            borderRadius: radius.btn,
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Re-upload
        </button>
        <button
          onClick={handleConfirm}
          disabled={confirming}
          style={{
            flex: 1,
            padding: '14px 18px',
            background: confirming ? colors.blueDark : colors.blue,
            color: colors.surface,
            border: 'none',
            borderRadius: radius.btn,
            fontSize: '15px',
            fontWeight: 700,
            cursor: confirming ? 'not-allowed' : 'pointer',
            opacity: confirming ? 0.8 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {confirming ? 'Importing...' : 'Confirm & Import'}
        </button>
      </div>
    </ScreenShell>
  )
}

function TaskCard({ task }: { task: ExtractedTask }) {
  return (
    <div className="fade-up" style={{
      background: colors.surface,
      border: `1.5px solid ${colors.line}`,
      borderLeft: `4px solid ${colors.blue}`,
      borderRadius: radius.task,
      padding: '14px 16px',
    }}>
      {/* Task name */}
      <div style={{
        fontWeight: 700,
        fontSize: '15px',
        color: colors.text,
        marginBottom: '8px',
      }}>
        {task.name}
      </div>

      {/* Tags row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
        <span style={{
          background: colors.blueSoft,
          color: colors.blue,
          borderRadius: radius.pill,
          padding: '3px 10px',
          fontSize: '12px',
          fontWeight: 600,
        }}>
          {task.level_tag}
        </span>
        {task.trade_tag && (
          <span style={{
            background: colors.surface2,
            color: colors.muted,
            borderRadius: radius.pill,
            padding: '3px 10px',
            fontSize: '12px',
            fontWeight: 600,
            border: `1px solid ${colors.line}`,
          }}>
            {task.trade_tag}
          </span>
        )}
        {task.apartment_tag && (
          <span style={{
            background: colors.surface2,
            color: colors.muted,
            borderRadius: radius.pill,
            padding: '3px 10px',
            fontSize: '12px',
            fontWeight: 600,
            border: `1px solid ${colors.line}`,
          }}>
            {task.apartment_tag}
          </span>
        )}
        {task.room_tag && (
          <span style={{
            background: colors.surface2,
            color: colors.muted,
            borderRadius: radius.pill,
            padding: '3px 10px',
            fontSize: '12px',
            fontWeight: 600,
            border: `1px solid ${colors.line}`,
          }}>
            {task.room_tag}
          </span>
        )}
      </div>

      {/* Date + duration */}
      <div style={{ fontSize: '13px', color: colors.muted }}>
        {formatDate(task.start_date)} · {task.duration_days} day{task.duration_days !== 1 ? 's' : ''}
      </div>
    </div>
  )
}

function confidenceBadgeColors(confidence: number): { bg: string; color: string } {
  if (confidence >= 0.8) return { bg: colors.greenSoft, color: colors.green }
  if (confidence >= 0.6) return { bg: colors.orangeSoft, color: colors.orange }
  return { bg: colors.redSoft, color: colors.red }
}

function DepRow({
  dep,
  fromTask,
  toTask,
  onRemove,
}: {
  dep: InferredDependency
  fromTask: ExtractedTask | undefined
  toTask: ExtractedTask | undefined
  onRemove: () => void
}) {
  const badge = confidenceBadgeColors(dep.confidence)
  const pct = Math.round(dep.confidence * 100)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '8px',
    }}>
      {/* Arrow icon */}
      <span style={{ fontSize: '14px', color: colors.muted, marginTop: '1px', flexShrink: 0 }}>→</span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', color: colors.text, fontWeight: 600, lineHeight: 1.4 }}>
          <span style={{ color: colors.blue }}>{fromTask?.name ?? `Task ${dep.task_index}`}</span>
          <span style={{ color: colors.muted, fontWeight: 400 }}> depends on </span>
          <span style={{ color: colors.text }}>{toTask?.name ?? `Task ${dep.depends_on_index}`}</span>
        </div>
        {dep.lag_days > 0 && (
          <div style={{ fontSize: '11px', color: colors.muted, marginTop: '2px' }}>
            +{dep.lag_days} day{dep.lag_days !== 1 ? 's' : ''} lag
          </div>
        )}
        {dep.reasoning && (
          <div style={{
            fontSize: '11px',
            color: colors.muted,
            marginTop: '3px',
            fontStyle: 'italic',
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {dep.reasoning}
          </div>
        )}
      </div>

      {/* Confidence badge */}
      <span style={{
        background: badge.bg,
        color: badge.color,
        borderRadius: radius.pill,
        padding: '2px 7px',
        fontSize: '11px',
        fontWeight: 700,
        flexShrink: 0,
        alignSelf: 'center',
      }}>
        {pct}%
      </span>

      {/* Remove button */}
      <button
        onClick={onRemove}
        title="Remove dependency"
        style={{
          flexShrink: 0,
          alignSelf: 'center',
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          border: `1px solid ${colors.line}`,
          background: colors.surface,
          color: colors.muted,
          fontSize: '13px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  )
}
