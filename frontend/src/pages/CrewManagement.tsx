import { useEffect, useState } from 'react'
import {
  fetchCrew,
  addCrewMember,
  updateCrewMember,
  deleteCrewMember,
  CrewMember,
  CrewMemberCreate,
} from '../api/crew'
import { useProject } from '../contexts/ProjectContext'

const emptyForm: CrewMemberCreate = { name: '', id_number: '', profession: '', reason: '' }

export default function CrewManagement() {
  const { currentProject } = useProject()
  const PROJECT_ID = currentProject?.id ?? 1
  const [crew, setCrew] = useState<CrewMember[]>([])
  const [form, setForm] = useState<CrewMemberCreate>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<CrewMemberCreate>(emptyForm)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchCrew(PROJECT_ID).then(setCrew).catch(() => setError('Failed to load crew.'))
  }, [])

  async function handleAdd() {
    if (!form.name.trim()) return
    try {
      const member = await addCrewMember(PROJECT_ID, form)
      setCrew((prev) => [...prev, member])
      setForm(emptyForm)
    } catch {
      setError('Failed to add worker.')
    }
  }

  function startEdit(member: CrewMember) {
    setEditingId(member.id)
    setEditForm({ name: member.name, id_number: member.id_number ?? '', profession: member.profession ?? '', reason: member.reason ?? '' })
  }

  async function handleSaveEdit(id: number) {
    try {
      const updated = await updateCrewMember(id, editForm)
      setCrew((prev) => prev.map((m) => (m.id === id ? updated : m)))
      setEditingId(null)
    } catch {
      setError('Failed to update worker.')
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteCrewMember(id)
      setCrew((prev) => prev.filter((m) => m.id !== id))
    } catch {
      setError('Failed to delete worker.')
    }
  }

  return (
    <div>
      <h2 style={s.heading}>Crew Registry</h2>
      {error && <p style={s.error}>{error}</p>}

      <table style={s.table}>
        <thead>
          <tr>
            {['Name', 'ID Number', 'Profession', 'Reason on Site', ''].map((h) => (
              <th key={h} style={s.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {crew.map((m) =>
            editingId === m.id ? (
              <tr key={m.id}>
                {(['name', 'id_number', 'profession', 'reason'] as const).map((field) => (
                  <td key={field} style={s.td}>
                    <input
                      style={s.input}
                      value={editForm[field] ?? ''}
                      onChange={(e) => setEditForm((f) => ({ ...f, [field]: e.target.value }))}
                    />
                  </td>
                ))}
                <td style={s.td}>
                  <button style={s.btnSave} onClick={() => handleSaveEdit(m.id)}>Save</button>
                  <button style={s.btnCancel} onClick={() => setEditingId(null)}>Cancel</button>
                </td>
              </tr>
            ) : (
              <tr key={m.id}>
                <td style={s.td}>{m.name}</td>
                <td style={s.td}>{m.id_number ?? '—'}</td>
                <td style={s.td}>{m.profession ?? '—'}</td>
                <td style={s.td}>{m.reason ?? '—'}</td>
                <td style={s.td}>
                  <button style={s.btnEdit} onClick={() => startEdit(m)}>Edit</button>
                  <button style={s.btnDelete} onClick={() => handleDelete(m.id)}>Delete</button>
                </td>
              </tr>
            )
          )}

          {/* Add row */}
          <tr>
            {(['name', 'id_number', 'profession', 'reason'] as const).map((field) => (
              <td key={field} style={s.td}>
                <input
                  style={s.input}
                  placeholder={field === 'name' ? 'Full name *' : field.replace('_', ' ')}
                  value={form[field] ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
              </td>
            ))}
            <td style={s.td}>
              <button style={s.btnAdd} onClick={handleAdd} disabled={!form.name.trim()}>
                Add
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  heading: { marginBottom: '1rem' },
  error: { color: '#c0392b', marginBottom: '0.5rem' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  th: { textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid #ddd', fontWeight: 600, color: '#555' },
  td: { padding: '0.4rem 0.75rem', borderBottom: '1px solid #eee', verticalAlign: 'middle' },
  input: { width: '100%', padding: '0.3rem 0.5rem', border: '1px solid #ccc', borderRadius: '4px', fontSize: '0.88rem', boxSizing: 'border-box' },
  btnAdd: { padding: '0.3rem 0.8rem', background: '#2ecc71', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  btnEdit: { padding: '0.25rem 0.6rem', background: '#3498db', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '0.3rem', fontSize: '0.82rem' },
  btnDelete: { padding: '0.25rem 0.6rem', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem' },
  btnSave: { padding: '0.25rem 0.6rem', background: '#27ae60', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '0.3rem', fontSize: '0.82rem' },
  btnCancel: { padding: '0.25rem 0.6rem', background: '#95a5a6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.82rem' },
}
