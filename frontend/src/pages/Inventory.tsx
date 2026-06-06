import { useEffect, useState } from 'react'
import ScreenShell from '../components/ScreenShell'
import { colors, radius } from '../constants/theme'
import {
  fetchInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  InventoryItem,
} from '../api/inventory'
import { useProject } from '../contexts/ProjectContext'

const BLANK_ADD = { name: '', unit: '', current_stock: '', min_stock_alert: '' }

type EditForm = { name: string; unit: string; current_stock: string; min_stock_alert: string }

function isLowStock(item: InventoryItem): boolean {
  return item.min_stock_alert != null && item.current_stock <= item.min_stock_alert
}

export default function Inventory() {
  const { currentProject } = useProject()
  const PROJECT_ID = currentProject?.id ?? 1

  const [items, setItems]     = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [addForm, setAddForm] = useState(BLANK_ADD)
  const [adding, setAdding]   = useState(false)
  const [editId, setEditId]   = useState<number | null>(null)
  const [editForm, setEditForm] = useState<EditForm>(BLANK_ADD)

  useEffect(() => {
    fetchInventory(PROJECT_ID)
      .then(setItems)
      .catch(() => setError('Failed to load inventory.'))
      .finally(() => setLoading(false))
  }, [PROJECT_ID])

  async function handleAdd() {
    if (!addForm.name.trim()) { setError('Item name is required.'); return }
    setAdding(true)
    setError('')
    try {
      const created = await createInventoryItem(PROJECT_ID, {
        name: addForm.name.trim(),
        unit: addForm.unit.trim(),
        current_stock: parseFloat(addForm.current_stock) || 0,
        min_stock_alert: addForm.min_stock_alert.trim() ? parseFloat(addForm.min_stock_alert) : null,
      })
      setItems(prev => [...prev, created])
      setAddForm(BLANK_ADD)
    } catch {
      setError('Failed to add item.')
    } finally {
      setAdding(false)
    }
  }

  function startEdit(item: InventoryItem) {
    setEditId(item.id)
    setEditForm({
      name: item.name,
      unit: item.unit,
      current_stock: String(item.current_stock),
      min_stock_alert: item.min_stock_alert != null ? String(item.min_stock_alert) : '',
    })
  }

  async function handleSaveEdit(id: number) {
    setError('')
    try {
      const updated = await updateInventoryItem(id, {
        name: editForm.name.trim(),
        unit: editForm.unit.trim(),
        current_stock: parseFloat(editForm.current_stock) || 0,
        min_stock_alert: editForm.min_stock_alert.trim() ? parseFloat(editForm.min_stock_alert) : null,
      })
      setItems(prev => prev.map(i => i.id === id ? updated : i))
      setEditId(null)
    } catch {
      setError('Failed to update item.')
    }
  }

  async function handleDelete(id: number) {
    setItems(prev => prev.filter(i => i.id !== id))
    try {
      await deleteInventoryItem(id)
    } catch {
      setError('Failed to delete item.')
      fetchInventory(PROJECT_ID).then(setItems)
    }
  }

  return (
    <ScreenShell title="Inventory" subtitle="Project materials stock">
      <div style={{ padding: '16px 20px 80px' }}>

        {error && (
          <div style={{
            background: colors.redSoft,
            border: `1px solid ${colors.redBorder}`,
            borderRadius: radius.card,
            padding: '12px 16px',
            color: colors.red,
            fontSize: '13px',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        {loading ? (
          [0, 1, 2].map(i => (
            <div key={i} className="shimmer" style={{ height: '52px', borderRadius: '14px', marginBottom: '8px' }} />
          ))
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

            {/* Header row */}
            <div style={s.headerRow}>
              <span style={{ flex: 3 }}>Item</span>
              <span style={{ flex: 1, textAlign: 'center' }}>Unit</span>
              <span style={{ flex: 1, textAlign: 'center' }}>In Stock</span>
              <span style={{ flex: 1, textAlign: 'center' }}>Min Alert</span>
              <span style={{ width: '88px' }} />
            </div>

            {/* Existing items */}
            {items.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: colors.muted, fontSize: '14px' }}>
                No items yet. Add your first inventory item below.
              </div>
            )}

            {items.map(item => {
              const lowStock = isLowStock(item)
              if (editId === item.id) {
                return (
                  <div key={item.id} style={{ ...s.row, background: colors.orangeSoft, borderColor: '#ffc197' }}>
                    <input
                      style={{ ...s.input, flex: 3 }}
                      value={editForm.name}
                      placeholder="Item name"
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    />
                    <input
                      style={{ ...s.input, flex: 1, textAlign: 'center' }}
                      value={editForm.unit}
                      placeholder="Unit"
                      onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))}
                    />
                    <input
                      style={{ ...s.input, flex: 1, textAlign: 'center' }}
                      type="number"
                      min="0"
                      step="any"
                      value={editForm.current_stock}
                      placeholder="0"
                      onChange={e => setEditForm(f => ({ ...f, current_stock: e.target.value }))}
                    />
                    <input
                      style={{ ...s.input, flex: 1, textAlign: 'center' }}
                      type="number"
                      min="0"
                      step="any"
                      value={editForm.min_stock_alert}
                      placeholder="—"
                      onChange={e => setEditForm(f => ({ ...f, min_stock_alert: e.target.value }))}
                    />
                    <div style={{ width: '88px', display: 'flex', gap: '4px' }}>
                      <button style={s.btnSave} onClick={() => handleSaveEdit(item.id)}>Save</button>
                      <button style={s.btnCancel} onClick={() => setEditId(null)}>✕</button>
                    </div>
                  </div>
                )
              }
              return (
                <div
                  key={item.id}
                  style={{
                    ...s.row,
                    background: lowStock ? '#fffbeb' : colors.surface,
                    borderColor: lowStock ? '#fcd34d' : colors.line,
                  }}
                >
                  <div style={{ flex: 3, fontWeight: 700, fontSize: '14px', color: colors.text, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {lowStock && <span title="Low stock" style={{ fontSize: '13px' }}>⚠️</span>}
                    {item.name}
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', fontSize: '13px', color: colors.muted }}>{item.unit || '—'}</div>
                  <div style={{
                    flex: 1,
                    textAlign: 'center',
                    fontSize: '14px',
                    fontWeight: 800,
                    color: lowStock ? colors.orange : colors.text,
                  }}>
                    {item.current_stock}
                  </div>
                  <div style={{ flex: 1, textAlign: 'center', fontSize: '13px', color: colors.mutedLight }}>
                    {item.min_stock_alert != null ? item.min_stock_alert : '—'}
                  </div>
                  <div style={{ width: '88px', display: 'flex', gap: '4px' }}>
                    <button style={s.btnEdit} onClick={() => startEdit(item)} title="Edit">✎</button>
                    <button style={s.btnDelete} onClick={() => handleDelete(item.id)} title="Delete">🗑</button>
                  </div>
                </div>
              )
            })}

            {/* Add row */}
            <div style={{ ...s.row, background: colors.surface2, borderStyle: 'dashed', marginTop: '4px' }}>
              <input
                style={{ ...s.input, flex: 3 }}
                placeholder="New item name *"
                value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
              <input
                style={{ ...s.input, flex: 1, textAlign: 'center' }}
                placeholder="Unit"
                value={addForm.unit}
                onChange={e => setAddForm(f => ({ ...f, unit: e.target.value }))}
              />
              <input
                style={{ ...s.input, flex: 1, textAlign: 'center' }}
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={addForm.current_stock}
                onChange={e => setAddForm(f => ({ ...f, current_stock: e.target.value }))}
              />
              <input
                style={{ ...s.input, flex: 1, textAlign: 'center' }}
                type="number"
                min="0"
                step="any"
                placeholder="—"
                value={addForm.min_stock_alert}
                onChange={e => setAddForm(f => ({ ...f, min_stock_alert: e.target.value }))}
              />
              <div style={{ width: '88px' }}>
                <button
                  style={{ ...s.btnAdd, opacity: adding ? 0.6 : 1 }}
                  onClick={handleAdd}
                  disabled={adding || !addForm.name.trim()}
                >
                  {adding ? '…' : '+ Add'}
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </ScreenShell>
  )
}

const s: Record<string, React.CSSProperties> = {
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    fontSize: '11px',
    fontWeight: 700,
    color: colors.mutedLight,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    marginBottom: '2px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    border: `1px solid ${colors.line}`,
    borderRadius: '14px',
  },
  input: {
    padding: '6px 8px',
    border: `1px solid ${colors.line}`,
    borderRadius: '8px',
    fontSize: '13px',
    background: colors.surface,
    color: colors.text,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  btnEdit: {
    flex: 1,
    padding: '6px',
    border: `1px solid ${colors.line}`,
    borderRadius: '8px',
    background: colors.surface,
    color: colors.muted,
    fontSize: '14px',
    cursor: 'pointer',
  },
  btnDelete: {
    flex: 1,
    padding: '6px',
    border: `1px solid ${colors.redBorder}`,
    borderRadius: '8px',
    background: colors.redSoft,
    color: colors.red,
    fontSize: '13px',
    cursor: 'pointer',
  },
  btnSave: {
    flex: 1,
    padding: '6px 8px',
    border: 'none',
    borderRadius: '8px',
    background: colors.green,
    color: '#fff',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnCancel: {
    flex: 1,
    padding: '6px',
    border: `1px solid ${colors.line}`,
    borderRadius: '8px',
    background: colors.surface,
    color: colors.muted,
    fontSize: '12px',
    cursor: 'pointer',
  },
  btnAdd: {
    width: '100%',
    padding: '7px 8px',
    border: 'none',
    borderRadius: '8px',
    background: colors.primary,
    color: '#fff',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
  },
}
