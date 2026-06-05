import { useEffect, useState } from 'react'
import { fetchMaterials, createMaterial, deleteMaterial, Material } from '../api/materials'

interface Props {
  logId: number
  readOnly?: boolean
}

const BLANK_FORM = { material_name: '', quantity: '', unit: '', notes: '' }

export default function MaterialsBlock({ logId, readOnly = false }: Props) {
  const [materials, setMaterials] = useState<Material[]>([])
  const [form, setForm] = useState(BLANK_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchMaterials(logId)
      .then(setMaterials)
      .catch(() => setError('Failed to load materials.'))
  }, [logId])

  async function handleAdd() {
    const qty = parseFloat(form.quantity)
    if (!form.material_name.trim() || isNaN(qty) || !form.unit.trim()) {
      setError('Name, quantity, and unit are required.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const created = await createMaterial(logId, {
        material_name: form.material_name.trim(),
        quantity: qty,
        unit: form.unit.trim(),
        notes: form.notes.trim() || undefined,
      })
      setMaterials((prev) => [...prev, created])
      setForm(BLANK_FORM)
    } catch {
      setError('Failed to add material.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(entry: Material) {
    setMaterials((prev) => prev.filter((m) => m.id !== entry.id))
    try {
      await deleteMaterial(logId, entry.id)
    } catch {
      setMaterials((prev) => [...prev, entry])
      setError('Failed to delete material entry.')
    }
  }

  return (
    <div style={s.block}>
      <h3 style={s.heading}>Materials Used</h3>
      {error && <p style={s.error}>{error}</p>}

      {materials.length === 0 ? (
        <p style={s.none}>None</p>
      ) : (
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Material</th>
              <th style={s.th}>Qty</th>
              <th style={s.th}>Unit</th>
              <th style={s.th}>Notes</th>
              {!readOnly && <th style={s.th} />}
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => (
              <tr key={m.id}>
                <td style={s.td}>{m.material_name}</td>
                <td style={s.td}>{m.quantity}</td>
                <td style={s.td}>{m.unit}</td>
                <td style={s.td}>{m.notes ?? '—'}</td>
                {!readOnly && (
                  <td style={s.td}>
                    <button style={s.deleteBtn} onClick={() => handleDelete(m)}>
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!readOnly && (
        <div style={s.form}>
          <h4 style={s.formHeading}>Add Material</h4>
          <div style={s.row}>
            <input
              style={{ ...s.input, flex: 2 }}
              placeholder="Material name"
              value={form.material_name}
              onChange={(e) => setForm((f) => ({ ...f, material_name: e.target.value }))}
            />
            <input
              style={{ ...s.input, flex: 1 }}
              placeholder="Quantity"
              type="number"
              min="0"
              step="any"
              value={form.quantity}
              onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
            />
            <input
              style={{ ...s.input, flex: 1 }}
              placeholder="Unit (e.g. m³)"
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            />
          </div>
          <input
            style={s.input}
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <button style={s.addBtn} onClick={handleAdd} disabled={submitting}>
            {submitting ? 'Adding…' : 'Add Material'}
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
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', marginBottom: '0.5rem' },
  th: { textAlign: 'left', padding: '0.4rem 0.6rem', borderBottom: '2px solid #ddd', fontWeight: 600, color: '#555' },
  td: { padding: '0.4rem 0.6rem', borderBottom: '1px solid #eee', verticalAlign: 'middle' },
  deleteBtn: { background: 'transparent', border: '1px solid #e74c3c', color: '#e74c3c', borderRadius: '4px', padding: '0.15rem 0.5rem', cursor: 'pointer', fontSize: '0.78rem' },
  form: { borderTop: '1px solid #eee', paddingTop: '1rem', marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  formHeading: { margin: '0 0 0.5rem', fontSize: '0.88rem', color: '#555', fontWeight: 600 },
  row: { display: 'flex', gap: '0.5rem' },
  input: { padding: '0.4rem 0.6rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.88rem', width: '100%', boxSizing: 'border-box' },
  addBtn: { alignSelf: 'flex-start', padding: '0.4rem 1rem', background: '#2980b9', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' },
}
