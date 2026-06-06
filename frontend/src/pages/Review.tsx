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

  const [tasks, setTasks]           = useState<ExtractedTask[]>(result?.tasks ?? [])
  const [confirming, setConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [activeDeps, setActiveDeps] = useState<InferredDependency[]>([])

  useEffect(() => {
    if (result?.dependencies) {
      setActiveDeps(result.dependencies.filter(d => d.task_index !== d.depends_on_index))
    }
  }, [result])

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
          <div style={{ fontSize: '48px' }}>≡</div>
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
      await confirmSchedule(PROJECT_ID, tasks, activeDeps)
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

  function handleDelete(idx: number) {
    setTasks(prev => prev.filter((_, i) => i !== idx))
    // Drop deps that referenced this task index; remap indices above it
    setActiveDeps(prev =>
      prev
        .filter(d => d.task_index !== idx && d.depends_on_index !== idx)
        .map(d => ({
          ...d,
          task_index: d.task_index > idx ? d.task_index - 1 : d.task_index,
          depends_on_index: d.depends_on_index > idx ? d.depends_on_index - 1 : d.depends_on_index,
        }))
    )
  }

  function handleSave(idx: number, updated: ExtractedTask) {
    setTasks(prev => prev.map((t, i) => (i === idx ? updated : t)))
  }

  const taskCount = tasks.length
  const confidencePct = Math.round(result.confidence * 100)

  const sorted = tasks
    .map((task, idx) => ({ task, idx }))
    .sort((a, b) => a.task.start_date.localeCompare(b.task.start_date))

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
        <span style={{ fontSize: '20px' }}>✓</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '14px', color: colors.green }}>
            {confidencePct}% confidence
          </div>
          <div style={{ fontSize: '12px', color: colors.muted }}>
            AI extraction complete — review, edit, or remove tasks below
          </div>
        </div>
      </div>

      <div style={{ padding: '8px 16px 100px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {taskCount === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '40px 20px',
            gap: '10px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '36px' }}>✕</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: colors.text }}>All tasks removed</div>
            <div style={{ fontSize: '13px', color: colors.muted }}>Re-upload to start over.</div>
          </div>
        )}

        {sorted.map(({ task, idx }) => {
          const taskDeps = activeDeps.filter(d => d.task_index === idx)
          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <TaskCard
                task={task}
                onSave={updated => handleSave(idx, updated)}
                onDelete={() => handleDelete(idx)}
              />
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
                      fromTask={tasks[dep.task_index]}
                      toTask={tasks[dep.depends_on_index]}
                      onRemove={() => removeDep(dep.task_index, dep.depends_on_index)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}

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
          disabled={confirming || taskCount === 0}
          style={{
            flex: 1,
            padding: '14px 18px',
            background: confirming ? colors.blueDark : colors.blue,
            color: colors.surface,
            border: 'none',
            borderRadius: radius.btn,
            fontSize: '15px',
            fontWeight: 700,
            cursor: (confirming || taskCount === 0) ? 'not-allowed' : 'pointer',
            opacity: (confirming || taskCount === 0) ? 0.5 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {confirming ? 'Importing...' : 'Confirm & Import'}
        </button>
      </div>
    </ScreenShell>
  )
}

// ─── TaskCard ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: ExtractedTask
  onSave: (updated: ExtractedTask) => void
  onDelete: () => void
}

function TaskCard({ task, onSave, onDelete }: TaskCardProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState<ExtractedTask>(task)

  function handleEdit() {
    setDraft(task)
    setEditing(true)
  }

  function handleSave() {
    onSave(draft)
    setEditing(false)
  }

  function handleCancel() {
    setDraft(task)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="fade-up" style={{
        background: colors.surface,
        border: `1.5px solid ${colors.blue}`,
        borderLeft: `4px solid ${colors.blue}`,
        borderRadius: radius.task,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        <FieldRow label="Name">
          <input
            value={draft.name}
            onChange={e => setDraft(p => ({ ...p, name: e.target.value }))}
            style={inputStyle}
          />
        </FieldRow>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <FieldRow label="Start date">
            <input
              type="date"
              value={draft.start_date}
              onChange={e => setDraft(p => ({ ...p, start_date: e.target.value }))}
              style={inputStyle}
            />
          </FieldRow>
          <FieldRow label="Duration (days)">
            <input
              type="number"
              min={1}
              value={draft.duration_days}
              onChange={e => setDraft(p => ({ ...p, duration_days: Number(e.target.value) }))}
              style={inputStyle}
            />
          </FieldRow>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <FieldRow label="Level">
            <input
              value={draft.level_tag}
              onChange={e => setDraft(p => ({ ...p, level_tag: e.target.value }))}
              style={inputStyle}
            />
          </FieldRow>
          <FieldRow label="Trade">
            <input
              value={draft.trade_tag ?? ''}
              onChange={e => setDraft(p => ({ ...p, trade_tag: e.target.value || null }))}
              style={inputStyle}
            />
          </FieldRow>
          <FieldRow label="Apartment">
            <input
              value={draft.apartment_tag ?? ''}
              onChange={e => setDraft(p => ({ ...p, apartment_tag: e.target.value || null }))}
              style={inputStyle}
            />
          </FieldRow>
          <FieldRow label="Room">
            <input
              value={draft.room_tag ?? ''}
              onChange={e => setDraft(p => ({ ...p, room_tag: e.target.value || null }))}
              style={inputStyle}
            />
          </FieldRow>
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '2px' }}>
          <button onClick={handleCancel} style={cancelBtnStyle}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!draft.name.trim()}
            style={{ ...saveBtnStyle, opacity: draft.name.trim() ? 1 : 0.4, cursor: draft.name.trim() ? 'pointer' : 'not-allowed' }}
          >
            Save
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-up" style={{
      background: colors.surface,
      border: `1.5px solid ${colors.line}`,
      borderLeft: `4px solid ${colors.blue}`,
      borderRadius: radius.task,
      padding: '14px 16px',
    }}>
      {/* Top row: name + action buttons */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
        <div style={{
          flex: 1,
          fontWeight: 700,
          fontSize: '15px',
          color: colors.text,
        }}>
          {task.name}
        </div>
        <button
          onClick={handleEdit}
          title="Edit task"
          style={iconActionStyle}
        >
          ✎
        </button>
        <button
          onClick={onDelete}
          title="Delete task"
          style={{ ...iconActionStyle, color: colors.red, borderColor: colors.redBorder }}
        >
          ✕
        </button>
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

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <label style={{ fontSize: '11px', fontWeight: 700, color: colors.muted, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  border: `1.5px solid ${colors.line}`,
  borderRadius: radius.card,
  fontSize: '13px',
  color: colors.text,
  background: colors.surface2,
  outline: 'none',
  boxSizing: 'border-box',
}

const iconActionStyle: React.CSSProperties = {
  flexShrink: 0,
  width: '28px',
  height: '28px',
  borderRadius: '8px',
  border: `1px solid ${colors.line}`,
  background: colors.surface2,
  fontSize: '13px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
}

const saveBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  background: colors.blue,
  color: colors.surface,
  border: 'none',
  borderRadius: radius.btn,
  fontSize: '13px',
  fontWeight: 700,
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: colors.surface2,
  color: colors.text,
  border: `1.5px solid ${colors.line}`,
  borderRadius: radius.btn,
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
}

// ─── DepRow ──────────────────────────────────────────────────────────────────

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
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
      <span style={{ fontSize: '14px', color: colors.muted, marginTop: '1px', flexShrink: 0 }}>→</span>
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
