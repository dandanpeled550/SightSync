import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ScreenShell from '../components/ScreenShell'
import { colors, radius } from '../constants/theme'
import { fetchTodayLog } from '../api/daily_log'
import {
  fetchAllTasks,
  markTaskNotDone,
  fetchCascadePreview,
  type Task,
  type CascadeResult,
} from '../api/tasks'

const PROJECT_ID = 1

const REASON_CODES = [
  'Weather delay',
  'Material shortage',
  'Equipment failure',
  'Labor shortage',
  'Other',
]

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Task() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const isNew = taskId === 'new'

  const [logId, setLogId] = useState<number | null>(null)
  const [task, setTask] = useState<Task | null>(null)
  const [loadingTask, setLoadingTask] = useState(!isNew)
  const [taskError, setTaskError] = useState<string | null>(null)

  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [newDate, setNewDate] = useState<string>('')
  const [notes, setNotes] = useState('')

  const [cascade, setCascade] = useState<CascadeResult[]>([])
  const [cascadeLoading, setCascadeLoading] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Get today's date in YYYY-MM-DD for date picker min
  const todayStr = new Date().toISOString().split('T')[0]

  // Fetch logId
  useEffect(() => {
    fetchTodayLog()
      .then(log => setLogId(log.id))
      .catch(() => {/* non-blocking */})
  }, [])

  // Fetch task if not new
  useEffect(() => {
    if (isNew) return
    const numId = Number(taskId)
    if (isNaN(numId)) {
      setTaskError('Invalid task ID')
      setLoadingTask(false)
      return
    }
    setLoadingTask(true)
    fetchAllTasks(PROJECT_ID)
      .then(all => {
        const found = all.find(t => t.id === numId) ?? null
        setTask(found)
        if (!found) setTaskError('Task not found')
      })
      .catch(err => setTaskError(err?.message ?? 'Failed to load task'))
      .finally(() => setLoadingTask(false))
  }, [taskId, isNew])

  // Fetch cascade preview when newDate changes
  useEffect(() => {
    if (isNew || !task || !newDate) {
      setCascade([])
      return
    }
    const numId = Number(taskId)
    if (isNaN(numId)) return

    setCascadeLoading(true)
    fetchCascadePreview(numId, newDate)
      .then(results => setCascade(results))
      .catch(() => setCascade([]))
      .finally(() => setCascadeLoading(false))
  }, [newDate, task, taskId, isNew])

  async function handleSave() {
    if (!logId || !newDate || !selectedReason) return
    if (isNew) {
      navigate('/')
      return
    }
    const numId = Number(taskId)
    if (isNaN(numId)) return

    setSaving(true)
    setSaveError(null)
    try {
      await markTaskNotDone(logId, numId, newDate, selectedReason + (notes ? `: ${notes}` : ''))
      navigate('/')
    } catch (err: unknown) {
      const e = err as { message?: string }
      setSaveError(e?.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const canSave = !!selectedReason && !!newDate && !saving

  const title = isNew ? 'New Task Entry' : (task?.name ?? 'Task Detail')
  const subtitle = isNew ? '' : (task?.level_tag ?? '')

  return (
    <ScreenShell title={title} subtitle={subtitle}>
      <div style={{ padding: '16px' }}>

        {loadingTask && (
          <div style={{ textAlign: 'center', color: colors.muted, padding: '40px 0', fontSize: '14px' }}>
            Loading task…
          </div>
        )}

        {taskError && !loadingTask && (
          <div style={{
            background: colors.redSoft,
            border: `1px solid #ffd0d0`,
            borderRadius: radius.card,
            padding: '16px',
            color: colors.red,
            fontSize: '14px',
            marginBottom: '16px',
          }}>
            {taskError}
          </div>
        )}

        {(!loadingTask && !taskError) && (
          <>
            {/* Done / Not done toggle row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '18px' }}>
              <button
                onClick={() => navigate('/')}
                style={{
                  height: '52px',
                  border: 'none',
                  borderRadius: radius.btn,
                  background: colors.greenSoft,
                  color: '#087d35',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                ✓ Done
              </button>
              <button
                style={{
                  height: '52px',
                  border: 'none',
                  borderRadius: radius.btn,
                  background: colors.redSoft,
                  color: '#dc2626',
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                × Not done
              </button>
            </div>

            {/* Why not completed */}
            <div style={{ fontWeight: 900, fontSize: '13px', color: colors.text, marginBottom: '8px' }}>
              Why not completed?
            </div>

            <div style={{
              border: `1px solid ${colors.line}`,
              borderRadius: radius.card,
              padding: '4px 12px',
              marginBottom: '16px',
              background: colors.surface,
            }}>
              {REASON_CODES.map(reason => (
                <div
                  key={reason}
                  onClick={() => setSelectedReason(reason)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: `1px solid ${colors.line}`,
                    padding: '13px 4px',
                    fontSize: '13px',
                    cursor: 'pointer',
                    color: colors.text,
                  }}
                >
                  <span>
                    <span style={{
                      display: 'inline-block',
                      width: '17px',
                      height: '17px',
                      borderRadius: '50%',
                      border: selectedReason === reason ? `5px solid ${colors.blue}` : `1.5px solid ${colors.mutedLight}`,
                      verticalAlign: '-3px',
                      marginRight: '8px',
                    }} />
                    {reason}
                  </span>
                </div>
              ))}
            </div>

            {/* New Date picker */}
            <div style={{ fontWeight: 900, fontSize: '13px', color: colors.text, marginBottom: '8px' }}>
              New Date
            </div>
            <input
              type="date"
              min={todayStr}
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              style={{
                width: '100%',
                minHeight: '48px',
                border: `1px solid ${colors.line}`,
                borderRadius: radius.btn,
                padding: '13px',
                color: newDate ? colors.text : colors.muted,
                fontSize: '13px',
                background: colors.surface,
                marginBottom: '16px',
                boxSizing: 'border-box',
              }}
            />

            {/* Cascade preview */}
            {newDate && !isNew && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontWeight: 900, fontSize: '13px', color: colors.text, marginBottom: '8px' }}>
                  Affected tasks
                </div>
                {cascadeLoading && (
                  <div style={{ fontSize: '12px', color: colors.muted }}>Calculating cascade…</div>
                )}
                {!cascadeLoading && cascade.length === 0 && (
                  <div style={{ fontSize: '12px', color: colors.muted }}>No downstream tasks affected.</div>
                )}
                {!cascadeLoading && cascade.length > 0 && (
                  <div style={{
                    border: `1px solid ${colors.line}`,
                    borderRadius: radius.card,
                    overflow: 'hidden',
                    background: colors.surface2,
                  }}>
                    {cascade.map((item, i) => (
                      <div
                        key={item.task_id}
                        style={{
                          padding: '10px 14px',
                          borderBottom: i < cascade.length - 1 ? `1px solid ${colors.line}` : 'none',
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
                          fontSize: '12px',
                          fontWeight: 800,
                          color: colors.orange,
                          background: colors.orangeSoft,
                          borderRadius: radius.pill,
                          padding: '4px 8px',
                        }}>
                          +{item.days_shifted}d
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div style={{ fontWeight: 900, fontSize: '13px', color: colors.text, marginBottom: '8px' }}>
              Notes
            </div>
            <textarea
              placeholder="Add a note…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              style={{
                width: '100%',
                border: `1px solid ${colors.line}`,
                borderRadius: radius.btn,
                padding: '13px',
                color: colors.text,
                fontSize: '13px',
                background: colors.surface,
                marginBottom: '16px',
                boxSizing: 'border-box',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />

            {saveError && (
              <div style={{
                background: colors.redSoft,
                border: `1px solid #ffd0d0`,
                borderRadius: radius.card,
                padding: '12px',
                color: colors.red,
                fontSize: '13px',
                marginBottom: '12px',
              }}>
                {saveError}
              </div>
            )}

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={!canSave}
              style={{
                width: '100%',
                height: '52px',
                border: 'none',
                borderRadius: radius.btn,
                background: canSave
                  ? 'linear-gradient(180deg,#3b82f6,#2563eb)'
                  : colors.line,
                color: canSave ? colors.surface : colors.muted,
                fontWeight: 800,
                fontSize: '14px',
                cursor: canSave ? 'pointer' : 'not-allowed',
                boxShadow: canSave ? '0 10px 20px rgba(37,99,235,.2)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      </div>
    </ScreenShell>
  )
}
