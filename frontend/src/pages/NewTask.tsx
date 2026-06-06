import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ScreenShell, { IconBtn } from '../components/ScreenShell'
import { colors, radius, gradients } from '../constants/theme'
import { fetchAllTasks, createTask, createDependency, type Task } from '../api/tasks'
import { useProject } from '../contexts/ProjectContext'

const TRADES = ['Electrical', 'Plumbing', 'Concrete', 'Framing', 'Safety', 'Cleanup', 'Inspection', 'Other']

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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{
        fontSize: '11px',
        fontWeight: 700,
        color: colors.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: '6px',
      }}>
        {label}{required && <span style={{ color: colors.primary }}> *</span>}
      </div>
      {children}
    </div>
  )
}

export default function NewTask() {
  const navigate = useNavigate()
  const { currentProject } = useProject()
  const PROJECT_ID = currentProject?.id ?? 1

  const today = new Date().toISOString().slice(0, 10)

  const [name, setName] = useState('')
  const [levelTag, setLevelTag] = useState('')
  const [tradeTag, setTradeTag] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [durationDays, setDurationDays] = useState(1)
  const [notes, setNotes] = useState('')

  const [allTasks, setAllTasks] = useState<Task[]>([])
  const [predecessorId, setPredecessorId] = useState<number | null>(null)
  const [taskSearch, setTaskSearch] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchAllTasks(PROJECT_ID).then(setAllTasks).catch(() => {})
  }, [PROJECT_ID])

  const filteredTasks = allTasks.filter(t =>
    t.name.toLowerCase().includes(taskSearch.toLowerCase()) ||
    t.level_tag.toLowerCase().includes(taskSearch.toLowerCase()) ||
    (t.trade_tag ?? '').toLowerCase().includes(taskSearch.toLowerCase()),
  )

  async function handleSave() {
    if (!name.trim()) { setError('Task name is required.'); return }
    if (!levelTag.trim()) { setError('Level is required.'); return }
    if (!startDate) { setError('Start date is required.'); return }
    if (durationDays < 1) { setError('Duration must be at least 1 day.'); return }

    setSaving(true)
    setError(null)
    try {
      const created = await createTask(PROJECT_ID, {
        name: name.trim(),
        level_tag: levelTag.trim(),
        trade_tag: tradeTag || null,
        start_date: startDate,
        duration_days: durationDays,
        notes: notes.trim() || null,
      })
      if (predecessorId !== null) {
        await createDependency(PROJECT_ID, created.id, predecessorId)
      }
      navigate('/plans')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task.')
    } finally {
      setSaving(false)
    }
  }

  const endDate = (() => {
    const d = new Date(startDate + 'T00:00:00')
    d.setDate(d.getDate() + durationDays - 1)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })()

  return (
    <ScreenShell
      title="New Task"
      hideBottomNav
      leftAction={<IconBtn onClick={() => navigate(-1)}>‹</IconBtn>}
    >
      <div style={{ padding: '20px 24px', paddingBottom: '100px' }}>

        {error && (
          <div style={{
            background: colors.redSoft,
            border: `1px solid ${colors.redBorder ?? colors.line}`,
            borderRadius: radius.card,
            padding: '12px 14px',
            color: colors.red,
            fontSize: '13px',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        <Field label="Task name" required>
          <input
            style={inputStyle}
            placeholder="e.g. Electrical rough-in Floor 3"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </Field>

        <Field label="Level / Zone" required>
          <input
            style={inputStyle}
            placeholder="e.g. Floor 3, Basement, Roof"
            value={levelTag}
            onChange={e => setLevelTag(e.target.value)}
          />
        </Field>

        <Field label="Trade">
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={tradeTag}
            onChange={e => setTradeTag(e.target.value)}
          >
            <option value="">— None —</option>
            {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <Field label="Start date" required>
              <input
                style={inputStyle}
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </Field>
          </div>
          <div style={{ width: '110px' }}>
            <Field label="Duration (days)" required>
              <input
                style={inputStyle}
                type="number"
                min={1}
                value={durationDays}
                onChange={e => setDurationDays(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </Field>
          </div>
        </div>

        {startDate && (
          <div style={{
            fontSize: '12px',
            color: colors.muted,
            marginTop: '-10px',
            marginBottom: '16px',
          }}>
            Ends {endDate}
          </div>
        )}

        <Field label="Notes">
          <textarea
            style={{ ...inputStyle, minHeight: '72px', resize: 'vertical' }}
            placeholder="Any context for this task..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </Field>

        {/* Dependency picker */}
        <div style={{
          borderTop: `1px solid ${colors.line}`,
          paddingTop: '20px',
          marginTop: '4px',
        }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 900,
            color: colors.text,
            letterSpacing: '-0.01em',
            marginBottom: '4px',
          }}>
            Depends on
          </div>
          <div style={{ fontSize: '12px', color: colors.muted, marginBottom: '12px' }}>
            Select a predecessor task that must finish before this one starts.
          </div>

          <input
            style={{ ...inputStyle, marginBottom: '10px' }}
            placeholder="Search tasks..."
            value={taskSearch}
            onChange={e => setTaskSearch(e.target.value)}
          />

          {allTasks.length === 0 ? (
            <div style={{ fontSize: '13px', color: colors.muted, padding: '12px 0' }}>
              No existing tasks — this will be the first.
            </div>
          ) : (
            <div style={{
              border: `1px solid ${colors.line}`,
              borderRadius: radius.card,
              overflow: 'hidden',
              maxHeight: '220px',
              overflowY: 'auto',
            }}>
              {/* None option */}
              <div
                onClick={() => setPredecessorId(null)}
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  background: predecessorId === null ? colors.primary + '18' : colors.surface,
                  borderBottom: `1px solid ${colors.line}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  border: `2px solid ${predecessorId === null ? colors.primary : colors.line}`,
                  background: predecessorId === null ? colors.primary : 'transparent',
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: '13px', color: colors.muted }}>None</span>
              </div>

              {filteredTasks.map((t, idx) => (
                <div
                  key={t.id}
                  onClick={() => setPredecessorId(t.id)}
                  style={{
                    padding: '10px 14px',
                    cursor: 'pointer',
                    background: predecessorId === t.id ? colors.primary + '18' : colors.surface,
                    borderBottom: idx < filteredTasks.length - 1 ? `1px solid ${colors.line}` : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    border: `2px solid ${predecessorId === t.id ? colors.primary : colors.line}`,
                    background: predecessorId === t.id ? colors.primary : 'transparent',
                    flexShrink: 0,
                  }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.name}
                    </div>
                    <div style={{ fontSize: '11px', color: colors.muted }}>
                      {t.level_tag}{t.trade_tag ? ` · ${t.trade_tag}` : ''} · ends {new Date(t.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              ))}

              {filteredTasks.length === 0 && taskSearch && (
                <div style={{ padding: '14px', fontSize: '13px', color: colors.muted, textAlign: 'center' }}>
                  No tasks match "{taskSearch}"
                </div>
              )}
            </div>
          )}
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%',
            height: '52px',
            marginTop: '28px',
            borderRadius: radius.btn,
            background: saving ? colors.line : gradients.primary,
            color: saving ? colors.muted : '#fff',
            fontSize: '15px',
            fontWeight: 800,
            border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
            letterSpacing: '-0.01em',
          }}
        >
          {saving ? 'Saving…' : 'Add to Plan'}
        </button>
      </div>
    </ScreenShell>
  )
}
