import { useEffect, useState } from 'react'
import { fetchIncidents, createIncident, deleteIncident, Incident } from '../api/incidents'

interface Props {
  logId: number
  readOnly?: boolean
}

const BLANK_FORM = { incident_type: '', description: '', people_involved: '', corrective_action: '' }

export default function SafetyBlock({ logId, readOnly = false }: Props) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [form, setForm] = useState(BLANK_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchIncidents(logId)
      .then(setIncidents)
      .catch(() => setError('Failed to load incidents.'))
  }, [logId])

  async function handleAdd() {
    if (!form.incident_type.trim() || !form.description.trim()) {
      setError('Type and description are required.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const created = await createIncident(logId, {
        incident_type: form.incident_type.trim(),
        description: form.description.trim(),
        people_involved: form.people_involved.trim() || undefined,
        corrective_action: form.corrective_action.trim() || undefined,
      })
      setIncidents((prev) => [...prev, created])
      setForm(BLANK_FORM)
    } catch {
      setError('Failed to add incident.')
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
      setError('Failed to delete incident.')
    }
  }

  return (
    <div style={s.block}>
      <h3 style={s.heading}>Safety Incidents</h3>
      {error && <p style={s.error}>{error}</p>}

      {incidents.length === 0 ? (
        <p style={s.none}>None</p>
      ) : (
        incidents.map((inc) => (
          <div key={inc.id} style={s.card}>
            <div style={s.cardHeader}>
              <span style={s.type}>{inc.incident_type}</span>
              {!readOnly && (
                <button style={s.deleteBtn} onClick={() => handleDelete(inc)}>
                  Delete
                </button>
              )}
            </div>
            <p style={s.field}>{inc.description}</p>
            {inc.people_involved && (
              <p style={s.meta}><strong>People involved:</strong> {inc.people_involved}</p>
            )}
            {inc.corrective_action && (
              <p style={s.meta}><strong>Corrective action:</strong> {inc.corrective_action}</p>
            )}
          </div>
        ))
      )}

      {!readOnly && (
        <div style={s.form}>
          <h4 style={s.formHeading}>Add Incident</h4>
          <input
            style={s.input}
            placeholder="Incident type (e.g. Near Miss)"
            value={form.incident_type}
            onChange={(e) => setForm((f) => ({ ...f, incident_type: e.target.value }))}
          />
          <textarea
            style={s.textarea}
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <input
            style={s.input}
            placeholder="People involved (optional)"
            value={form.people_involved}
            onChange={(e) => setForm((f) => ({ ...f, people_involved: e.target.value }))}
          />
          <textarea
            style={s.textarea}
            placeholder="Corrective action (optional)"
            value={form.corrective_action}
            onChange={(e) => setForm((f) => ({ ...f, corrective_action: e.target.value }))}
          />
          <button style={s.addBtn} onClick={handleAdd} disabled={submitting}>
            {submitting ? 'Adding…' : 'Add Incident'}
          </button>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  block: { border: '1px solid #ddd', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem' },
  heading: { margin: '0 0 1rem', fontSize: '1rem', color: '#333' },
  error: { color: '#c0392b', fontSize: '0.85rem', marginBottom: '0.5rem' },
  none: { color: '#888', fontSize: '0.88rem' },
  card: { border: '1px solid #f0c0c0', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '0.75rem', background: '#fff8f8' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' },
  type: { fontWeight: 700, fontSize: '0.9rem', color: '#c0392b' },
  field: { margin: '0 0 0.3rem', fontSize: '0.88rem', color: '#333' },
  meta: { margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#555' },
  deleteBtn: { background: 'transparent', border: '1px solid #e74c3c', color: '#e74c3c', borderRadius: '4px', padding: '0.15rem 0.5rem', cursor: 'pointer', fontSize: '0.78rem' },
  form: { borderTop: '1px solid #eee', paddingTop: '1rem', marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  formHeading: { margin: '0 0 0.5rem', fontSize: '0.88rem', color: '#555', fontWeight: 600 },
  input: { padding: '0.4rem 0.6rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.88rem' },
  textarea: { padding: '0.4rem 0.6rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.88rem', minHeight: '64px', resize: 'vertical' },
  addBtn: { alignSelf: 'flex-start', padding: '0.4rem 1rem', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' },
}
