import { useEffect, useState } from 'react'
import { fetchMaterials, createMaterial, deleteMaterial, Material } from '../api/materials'
import { fetchInventory, InventoryItem } from '../api/inventory'
import { useProject } from '../contexts/ProjectContext'
import { colors, radius } from '../constants/theme'

interface Props {
  logId: number
  readOnly?: boolean
}

const BLANK_FORM = { quantity: '', unit: '', notes: '' }

export default function MaterialsBlock({ logId, readOnly = false }: Props) {
  const { currentProject } = useProject()
  const PROJECT_ID = currentProject?.id ?? 1

  const [materials, setMaterials]     = useState<Material[]>([])
  const [inventory, setInventory]     = useState<InventoryItem[]>([])
  const [fromInventory, setFromInventory] = useState(true)
  const [selectedItemId, setSelectedItemId] = useState<number | ''>('')
  const [freeTextName, setFreeTextName] = useState('')
  const [form, setForm]               = useState(BLANK_FORM)
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')

  useEffect(() => {
    fetchMaterials(logId).then(setMaterials).catch(() => setError('Failed to load materials.'))
    fetchInventory(PROJECT_ID).then(setInventory).catch(() => {/* non-critical */})
  }, [logId, PROJECT_ID])

  function switchMode(toInventory: boolean) {
    setFromInventory(toInventory)
    setSelectedItemId('')
    setFreeTextName('')
    setForm(BLANK_FORM)
    setError('')
  }

  // When an inventory item is selected, auto-fill the unit
  function handleSelectItem(id: number | '') {
    setSelectedItemId(id)
    if (id !== '') {
      const item = inventory.find(i => i.id === id)
      if (item) setForm(f => ({ ...f, unit: item.unit }))
    } else {
      setForm(f => ({ ...f, unit: '' }))
    }
  }

  async function handleAdd() {
    const qty = parseFloat(form.quantity)
    if (isNaN(qty) || qty <= 0) { setError('A valid quantity is required.'); return }
    if (!form.unit.trim()) { setError('Unit is required.'); return }

    if (fromInventory) {
      if (selectedItemId === '') { setError('Select an inventory item.'); return }
    } else {
      if (!freeTextName.trim()) { setError('Material name is required.'); return }
    }

    setSubmitting(true)
    setError('')

    const selectedItem = fromInventory ? inventory.find(i => i.id === selectedItemId) : null

    try {
      const created = await createMaterial(logId, {
        material_name: fromInventory ? (selectedItem?.name ?? '') : freeTextName.trim(),
        quantity: qty,
        unit: form.unit.trim(),
        notes: form.notes.trim() || undefined,
        inventory_item_id: fromInventory && selectedItemId !== '' ? (selectedItemId as number) : undefined,
      })
      setMaterials(prev => [...prev, created])
      // Deduct from local inventory state for immediate feedback
      if (fromInventory && selectedItemId !== '') {
        setInventory(prev => prev.map(i =>
          i.id === selectedItemId
            ? { ...i, current_stock: Math.max(0, i.current_stock - qty) }
            : i
        ))
      }
      setSelectedItemId('')
      setFreeTextName('')
      setForm(BLANK_FORM)
    } catch {
      setError('Failed to add material.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(entry: Material) {
    setMaterials(prev => prev.filter(m => m.id !== entry.id))
    try {
      await deleteMaterial(logId, entry.id)
      // Restore local inventory stock for immediate feedback
      if (entry.inventory_item_id != null) {
        setInventory(prev => prev.map(i =>
          i.id === entry.inventory_item_id
            ? { ...i, current_stock: i.current_stock + entry.quantity }
            : i
        ))
      }
    } catch {
      setMaterials(prev => [...prev, entry])
      setError('Failed to delete material entry.')
    }
  }

  return (
    <div style={s.block}>
      <h3 style={s.heading}>Materials Used</h3>
      {error && <p style={s.error}>{error}</p>}

      {materials.length === 0 ? (
        <p style={s.none}>None logged yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
          {materials.map(m => (
            <div key={m.id} style={s.materialRow}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 700, fontSize: '13px', color: colors.text }}>{m.material_name}</span>
                {m.inventory_item_id != null && (
                  <span style={s.inventoryBadge}>📦 inventory</span>
                )}
                {m.notes && <span style={{ fontSize: '11px', color: colors.muted, marginLeft: '6px' }}>{m.notes}</span>}
              </div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: colors.text, whiteSpace: 'nowrap' }}>
                {m.quantity} {m.unit}
              </span>
              {!readOnly && (
                <button style={s.deleteBtn} onClick={() => handleDelete(m)}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <div style={s.form}>
          {/* Mode toggle */}
          <div style={s.modeToggle}>
            <button
              style={{ ...s.modeBtn, ...(fromInventory ? s.modeBtnActive : {}) }}
              onClick={() => switchMode(true)}
            >
              📦 From inventory
            </button>
            <button
              style={{ ...s.modeBtn, ...(!fromInventory ? s.modeBtnActive : {}) }}
              onClick={() => switchMode(false)}
            >
              ✏️ Enter manually
            </button>
          </div>

          {fromInventory ? (
            <select
              style={s.select}
              value={selectedItemId}
              onChange={e => handleSelectItem(e.target.value === '' ? '' : parseInt(e.target.value))}
            >
              <option value="">Select inventory item…</option>
              {inventory.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.current_stock} {item.unit} in stock)
                </option>
              ))}
            </select>
          ) : (
            <input
              style={s.input}
              placeholder="Material name"
              value={freeTextName}
              onChange={e => setFreeTextName(e.target.value)}
            />
          )}

          <div style={s.row}>
            <input
              style={{ ...s.input, flex: 1 }}
              placeholder="Quantity"
              type="number"
              min="0"
              step="any"
              value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
            />
            <input
              style={{ ...s.input, flex: 1 }}
              placeholder="Unit (e.g. m³)"
              value={form.unit}
              onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
            />
          </div>
          <input
            style={s.input}
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
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
  block: {
    border: `1px solid ${colors.line}`,
    borderRadius: radius.card,
    padding: '16px',
    marginBottom: '16px',
    background: colors.surface,
  },
  heading: { margin: '0 0 12px', fontSize: '13px', fontWeight: 900, color: colors.text, letterSpacing: '-0.01em' },
  error: { color: colors.red, fontSize: '12px', marginBottom: '8px' },
  none: { color: colors.muted, fontSize: '13px', margin: '0 0 8px' },
  materialRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 10px',
    background: colors.surface2,
    borderRadius: '10px',
  },
  inventoryBadge: {
    marginLeft: '6px',
    fontSize: '10px',
    background: colors.blueSoft,
    color: colors.blue,
    borderRadius: '6px',
    padding: '1px 5px',
    fontWeight: 700,
  },
  deleteBtn: {
    background: 'transparent',
    border: `1px solid ${colors.redBorder}`,
    color: colors.red,
    borderRadius: '6px',
    padding: '3px 7px',
    cursor: 'pointer',
    fontSize: '11px',
    flexShrink: 0,
  },
  form: {
    borderTop: `1px solid ${colors.line}`,
    paddingTop: '12px',
    marginTop: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  modeToggle: {
    display: 'flex',
    gap: '6px',
  },
  modeBtn: {
    flex: 1,
    padding: '7px 8px',
    border: `1px solid ${colors.line}`,
    borderRadius: '10px',
    background: colors.surface2,
    color: colors.muted,
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  modeBtnActive: {
    background: colors.primarySoft,
    color: colors.primary,
    borderColor: '#ffc197',
  },
  select: {
    padding: '8px 10px',
    border: `1px solid ${colors.line}`,
    borderRadius: '10px',
    fontSize: '13px',
    color: colors.text,
    background: colors.surface,
    width: '100%',
    outline: 'none',
  },
  row: { display: 'flex', gap: '8px' },
  input: {
    padding: '8px 10px',
    border: `1px solid ${colors.line}`,
    borderRadius: '10px',
    fontSize: '13px',
    width: '100%',
    boxSizing: 'border-box' as const,
    color: colors.text,
    background: colors.surface,
    outline: 'none',
  },
  addBtn: {
    alignSelf: 'flex-start',
    padding: '8px 16px',
    background: colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: '13px',
  },
}
