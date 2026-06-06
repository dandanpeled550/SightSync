import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import ScreenShell from '../components/ScreenShell'
import { IconBtn } from '../components/ScreenShell'
import { colors, radius } from '../constants/theme'
import { confirmSchedule, type ExtractionResult, type ExtractedTask } from '../api/tasks'
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
      await confirmSchedule(result!.tasks, PROJECT_ID)
      navigate('/plans')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed. Please try again.'
      setConfirmError(msg)
    } finally {
      setConfirming(false)
    }
  }

  const taskCount = result.tasks.length
  const confidencePct = Math.round(result.confidence * 100)

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

      {/* Task list */}
      <div style={{ padding: '8px 16px 100px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {result.tasks.map((task: ExtractedTask, idx: number) => (
          <TaskCard key={idx} task={task} />
        ))}

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
      </div>

      {/* Date + duration */}
      <div style={{ fontSize: '13px', color: colors.muted }}>
        {formatDate(task.start_date)} · {task.duration_days} day{task.duration_days !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
