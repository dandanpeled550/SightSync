import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ScreenShell, { IconBtn } from '../components/ScreenShell'
import { colors, radius, gradients } from '../constants/theme'
import { fetchTodayLog } from '../api/daily_log'
import {
  fetchAllTasks,
  markTaskDone,
  markTaskNotDone,
  fetchCascadePreview,
  updateTask,
  type Task,
  type CascadeResult,
} from '../api/tasks'
import { useProject } from '../contexts/ProjectContext'

const REASON_CODES = [
  'Weather delay',
  'Material shortage',
  'Equipment failure',
  'Labor shortage',
  'Other',
]

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '44px',
  border: `1px solid ${colors.line}`,
  borderRadius: radius.btn,
  padding: '10px 12px',
  color: colors.text,
  fontSize: '14px',
  background: colors.surface,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

export default function TaskPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const { currentProject } = useProject()
  const PROJECT_ID = currentProject?.id ?? 1
  const numId = Number(taskId)

  const [logId, setLogId] = useState<number | null>(null)
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Editable fields — initialised from task once loaded
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editLevelTag, setEditLevelTag] = useState('')
  const [editTradeTag, setEditTradeTag] = useState('')
  const [editAptTag, setEditAptTag] = useState('')
  const [editRoomTag, setEditRoomTag] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editNotes, setEditNotes] = useState('')

  // Today's status (optional)
  const [statusAction, setStatusAction] = useState<'done' | 'not_done' | null>(null)
  const [selectedReason, setSelectedReason] = useState<string | null>(null)

  // Cascade preview
  const [cascade, setCascade] = useState<CascadeResult[]>([])
  const [cascadeLoading, setCascadeLoading] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Load today's log id
  useEffect(() => {
    fetchTodayLog()
      .then(log => setLogId(log.id))
      .catch(() => {})
  }, [])

  // Load task and pre-fill fields
  useEffect(() => {
    if (isNaN(numId)) {
      setLoadError('Invalid task ID')
      setLoading(false)
      return
    }
    setLoading(true)
    fetchAllTasks(PROJECT_ID)
      .then(all => {
        const found = (Array.isArray(all) ? all : []).find(t => t.id === numId) ?? null
        setTask(found)
        if (found) {
          setEditName(found.name)
          setEditDescription(found.description ?? '')
          setEditLevelTag(found.level_tag)
          setEditTradeTag(found.trade_tag ?? '')
          setEditAptTag(found.apartment_tag ?? '')
          setEditRoomTag(found.room_tag ?? '')
          setEditStartDate(found.start_date)
          setEditEndDate(found.end_date)
          setEditNotes(found.notes ?? '')
        } else {
          setLoadError('Task not found')
        }
      })
      .catch(err => setLoadError(err instanceof Error ? err.message : 'Failed to load task'))
      .finally(() => setLoading(false))
  }, [taskId])

  // Cascade preview — triggers when start date changes and action is not_done
  useEffect(() => {
    if (!task || statusAction !== 'not_done' || !editStartDate || editStartDate === task.start_date) {
      setCascade([])
      return
    }
    setCascadeLoading(true)
    fetchCascadePreview(numId, editStartDate)
      .then(r => setCascade(r))
      .catch(() => setCascade([]))
      .finally(() => setCascadeLoading(false))
  }, [editStartDate, statusAction, task])

  const computedDuration = editStartDate && editEndDate
    ? Math.max(1, Math.round((new Date(editEndDate + 'T00:00:00').getTime() - new Date(editStartDate + 'T00:00:00').getTime()) / 86400000))
    : null

  const downstreamCascade = cascade.filter(item => item.task_id !== numId)

  const hasFieldChanges = task && (
    editName !== task.name ||
    editDescription !== (task.description ?? '') ||
    editLevelTag !== task.level_tag ||
    editTradeTag !== (task.trade_tag ?? '') ||
    editAptTag !== (task.apartment_tag ?? '') ||
    editRoomTag !== (task.room_tag ?? '') ||
    editStartDate !== task.start_date ||
    editEndDate !== task.end_date ||
    editNotes !== (task.notes ?? '')
  )

  const canSave = !saving && (
    hasFieldChanges ||
    statusAction === 'done' ||
    (statusAction === 'not_done' && !!selectedReason)
  )

  async function handleSave() {
    if (!task || isNaN(numId)) return
    setSaving(true)
    setSaveError(null)
    try {
      // 1. Persist field edits if anything changed
      if (hasFieldChanges) {
        const newDuration = computedDuration ?? task.duration_days
        await updateTask(numId, {
          name: editName || undefined,
          description: editDescription || undefined,
          level_tag: editLevelTag || undefined,
          trade_tag: editTradeTag || undefined,
          apartment_tag: editAptTag || undefined,
          room_tag: editRoomTag || undefined,
          start_date: editStartDate || undefined,
          duration_days: newDuration,
        })
      }

      // 2. Log today's status if chosen
      if (logId && statusAction === 'done') {
        await markTaskDone(logId, numId)
      } else if (logId && statusAction === 'not_done' && selectedReason) {
        await markTaskNotDone(logId, numId, editStartDate, selectedReason)
      }

      navigate(-1)
    } catch (err: unknown) {
      setSaveError((err as { message?: string })?.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ScreenShell title="Task" hideBottomNav leftAction={<IconBtn onClick={() => navigate(-1)}>‹</IconBtn>}>
        <div style={{ textAlign: 'center', color: colors.muted, padding: '60px 0', fontSize: '14px' }}>Loading…</div>
      </ScreenShell>
    )
  }

  if (loadError || !task) {
    return (
      <ScreenShell title="Task" hideBottomNav leftAction={<IconBtn onClick={() => navigate(-1)}>‹</IconBtn>}>
        <div style={{ margin: '24px', padding: '16px', background: colors.redSoft, borderRadius: radius.card, color: colors.red, fontSize: '14px' }}>
          {loadError ?? 'Task not found'}
        </div>
      </ScreenShell>
    )
  }

  return (
    <ScreenShell
      title={task.name}
      subtitle={task.level_tag}
      leftAction={<IconBtn onClick={() => navigate(-1)}>‹</IconBtn>}
      hideBottomNav
    >
      <div style={{ padding: '16px 20px 100px', maxWidth: '720px' }}>

        {/* ── Task details ── */}
        <div style={{
          background: colors.surface,
          border: `1.5px solid ${colors.line}`,
          borderRadius: radius.card,
          padding: '16px',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
            Task details
          </div>

          <Field label="Name">
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label="Description">
            <textarea
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              rows={2}
              placeholder="Optional description…"
              style={{ ...inputStyle, resize: 'vertical', minHeight: '64px' }}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Field label="Level">
              <input value={editLevelTag} onChange={e => setEditLevelTag(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Trade">
              <input value={editTradeTag} onChange={e => setEditTradeTag(e.target.value)} placeholder="e.g. Electrical" style={inputStyle} />
            </Field>
            <Field label="Apartment">
              <input value={editAptTag} onChange={e => setEditAptTag(e.target.value)} placeholder="Optional" style={inputStyle} />
            </Field>
            <Field label="Room">
              <input value={editRoomTag} onChange={e => setEditRoomTag(e.target.value)} placeholder="Optional" style={inputStyle} />
            </Field>
          </div>
        </div>

        {/* ── Dates ── */}
        <div style={{
          background: colors.surface,
          border: `1.5px solid ${colors.line}`,
          borderRadius: radius.card,
          padding: '16px',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
            Schedule
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '8px' }}>
            <Field label="Start date">
              <input
                type="date"
                value={editStartDate}
                onChange={e => {
                  setEditStartDate(e.target.value)
                  if (editEndDate && e.target.value >= editEndDate) setEditEndDate('')
                }}
                style={inputStyle}
              />
            </Field>
            <Field label="End date">
              <input
                type="date"
                min={editStartDate}
                value={editEndDate}
                onChange={e => setEditEndDate(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>

          {computedDuration !== null && (
            <div style={{ fontSize: '13px', color: colors.primary, fontWeight: 700 }}>
              {computedDuration} day{computedDuration !== 1 ? 's' : ''}
              {computedDuration !== task.duration_days && (
                <span style={{ color: colors.muted, fontWeight: 400 }}> (was {task.duration_days}d)</span>
              )}
            </div>
          )}
        </div>

        {/* ── Notes ── */}
        <div style={{
          background: colors.surface,
          border: `1.5px solid ${colors.line}`,
          borderRadius: radius.card,
          padding: '16px',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
            Notes
          </div>
          <textarea
            value={editNotes}
            onChange={e => setEditNotes(e.target.value)}
            rows={3}
            placeholder="Add notes…"
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {/* ── Today's status (optional) ── */}
        <div style={{
          background: colors.surface,
          border: `1.5px solid ${colors.line}`,
          borderRadius: radius.card,
          padding: '16px',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: colors.muted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
            Today's status <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: statusAction === 'not_done' ? '16px' : 0 }}>
            <button
              onClick={() => setStatusAction(prev => prev === 'done' ? null : 'done')}
              style={{
                height: '48px',
                border: `2px solid ${statusAction === 'done' ? colors.green : colors.line}`,
                borderRadius: '14px',
                background: statusAction === 'done' ? colors.greenSoft : 'transparent',
                color: statusAction === 'done' ? colors.green : colors.muted,
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              ✓ Done
            </button>
            <button
              onClick={() => setStatusAction(prev => prev === 'not_done' ? null : 'not_done')}
              style={{
                height: '48px',
                border: `2px solid ${statusAction === 'not_done' ? colors.red : colors.line}`,
                borderRadius: '14px',
                background: statusAction === 'not_done' ? colors.redSoft : 'transparent',
                color: statusAction === 'not_done' ? colors.red : colors.muted,
                fontWeight: 800,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              × Not done
            </button>
          </div>

          {statusAction === 'not_done' && (
            <>
              <div style={{ fontSize: '13px', fontWeight: 700, color: colors.text, marginBottom: '8px' }}>Why not completed?</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                {REASON_CODES.map(r => {
                  const active = selectedReason === r
                  return (
                    <button
                      key={r}
                      onClick={() => setSelectedReason(active ? null : r)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '999px',
                        border: `1.5px solid ${active ? colors.primary : colors.line}`,
                        background: active ? colors.primarySoft : 'transparent',
                        color: active ? colors.primary : colors.muted,
                        fontWeight: active ? 800 : 500,
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                    >
                      {r}
                    </button>
                  )
                })}
              </div>

              {/* Cascade preview — only when start date differs from original */}
              {editStartDate !== task.start_date && (
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: colors.text, marginBottom: '8px' }}>
                    Affected tasks
                  </div>
                  {cascadeLoading && <div style={{ fontSize: '12px', color: colors.muted }}>Calculating cascade…</div>}
                  {!cascadeLoading && downstreamCascade.length === 0 && (
                    <div style={{ fontSize: '12px', color: colors.muted }}>No downstream tasks affected.</div>
                  )}
                  {!cascadeLoading && downstreamCascade.length > 0 && (
                    <div style={{ border: `1px solid ${colors.line}`, borderRadius: radius.card, overflow: 'hidden', background: colors.surface2 }}>
                      {downstreamCascade.map((item, i) => (
                        <div
                          key={item.task_id}
                          style={{
                            padding: '10px 14px',
                            borderBottom: i < downstreamCascade.length - 1 ? `1px solid ${colors.line}` : 'none',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: colors.text }}>{item.task_name}</div>
                            <div style={{ fontSize: '11px', color: colors.muted }}>
                              {formatDate(item.old_start_date)} → {formatDate(item.new_start_date)}
                            </div>
                          </div>
                          <div style={{
                            fontSize: '12px', fontWeight: 800, color: colors.orange,
                            background: colors.orangeSoft, borderRadius: radius.pill, padding: '4px 8px',
                          }}>
                            +{item.days_shifted}d
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {saveError && (
          <div style={{ padding: '12px 16px', background: colors.redSoft, borderRadius: radius.card, color: colors.red, fontSize: '13px', marginBottom: '12px' }}>
            {saveError}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={!canSave}
          style={{
            width: '100%',
            height: '52px',
            border: 'none',
            borderRadius: radius.btn,
            background: canSave ? gradients.primary : colors.line,
            color: canSave ? colors.surface : colors.muted,
            fontWeight: 800,
            fontSize: '14px',
            cursor: canSave ? 'pointer' : 'not-allowed',
            transition: 'all 0.15s',
          }}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </ScreenShell>
  )
}
