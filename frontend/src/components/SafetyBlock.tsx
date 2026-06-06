import { useEffect, useState } from 'react'
import { fetchIncidents, createIncident, deleteIncident, type Incident } from '../api/incidents'
import PhotoUploader from './PhotoUploader'
import { colors, radius } from '../constants/theme'

interface Props {
  logId: number
  readOnly?: boolean
}

const BLANK_FORM = {
  description: '',
  photo_url: null as string | null,
}

export default function SafetyBlock({ logId, readOnly = false }: Props) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [form, setForm] = useState(BLANK_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchIncidents(logId)
      .then(setIncidents)
      .catch(() => setError('Failed to load safety documentation.'))
  }, [logId])

  async function handleAdd() {
    if (!form.description.trim()) {
      setError('Description is required.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const created = await createIncident(logId, {
        description: form.description.trim(),
        photo_url: form.photo_url ?? undefined,
      })
      setIncidents((prev) => [...prev, created])
      setForm(BLANK_FORM)
    } catch {
      setError('Failed to add entry.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(incident: Incident) {
    setIncidents((prev) => prev.filter((i) => i.id !== incident.id))
    try {
      await deleteIncident(logId, incident.id)
    } catch {
      setIncidents((prev) => [...prev, incident])
      setError('Failed to delete entry.')
    }
  }

  return (
    <div style={s.block}>
      {error && <p style={s.error}>{error}</p>}

      {incidents.length === 0 ? (
        <p style={s.none}>None</p>
      ) : (
        incidents.map((inc) => (
          <div key={inc.id} style={s.card}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              {inc.photo_url && (
                <img
                  src={inc.photo_url}
                  alt="incident"
                  style={{
                    width: '56px',
                    height: '56px',
                    objectFit: 'cover',
                    borderRadius: radius.icon,
                    border: `1px solid ${colors.line}`,
                    flexShrink: 0,
                  }}
                />
              )}
              <p style={{ ...s.field, flex: 1 }}>{inc.description}</p>
              {!readOnly && (
                <button style={s.deleteBtn} onClick={() => handleDelete(inc)}>✕</button>
              )}
            </div>
          </div>
        ))
      )}

      {!readOnly && (
        <div style={s.form}>
          <PhotoUploader
            value={form.photo_url}
            onChange={(url) => setForm((f) => ({ ...f, photo_url: url }))}
          />
          <textarea
            style={s.textarea}
            placeholder="Describe what happened…"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <button style={s.addBtn} onClick={handleAdd} disabled={submitting}>
            {submitting ? 'Saving…' : 'Add entry'}
          </button>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  block: {
    border: `1px solid ${colors.line}`,
    borderRadius: radius.card,
    padding: '16px',
    marginBottom: '1.5rem',
    background: colors.surface,
  },
  error: { color: colors.red, fontSize: '13px', marginBottom: '8px' },
  none: { color: colors.muted, fontSize: '13px' },
  card: {
    border: `1px solid ${colors.redBorder}`,
    borderRadius: radius.task,
    padding: '10px 12px',
    marginBottom: '10px',
    background: colors.redSoft,
  },
  field: { margin: 0, fontSize: '13px', color: colors.text, lineHeight: 1.5 },
  deleteBtn: {
    background: 'transparent',
    border: 'none',
    color: colors.muted,
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px 4px',
    flexShrink: 0,
  },
  form: {
    borderTop: `1px solid ${colors.line}`,
    paddingTop: '14px',
    marginTop: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  textarea: {
    padding: '10px 12px',
    border: `1px solid ${colors.line}`,
    borderRadius: radius.btn,
    fontSize: '13px',
    resize: 'vertical',
    fontFamily: 'inherit',
    color: colors.text,
    background: colors.surface2,
    outline: 'none',
  },
  addBtn: {
    alignSelf: 'flex-start',
    padding: '10px 20px',
    background: colors.red,
    color: '#fff',
    border: 'none',
    borderRadius: radius.btn,
    fontWeight: 800,
    fontSize: '13px',
    cursor: 'pointer',
  },
}
