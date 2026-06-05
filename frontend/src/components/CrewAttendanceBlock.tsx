import { useEffect, useState } from 'react'
import { fetchAttendance, upsertAttendance, AttendanceRecord } from '../api/crew'

interface Props {
  logId: number
  readOnly?: boolean
}

type Status = 'present' | 'absent' | 'partial'

const STATUS_LABELS: Record<Status, string> = {
  present: 'Present',
  absent: 'Absent',
  partial: 'Partial',
}

const STATUS_COLORS: Record<Status, string> = {
  present: '#27ae60',
  absent: '#e74c3c',
  partial: '#f39c12',
}

export default function CrewAttendanceBlock({ logId, readOnly = false }: Props) {
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [saving, setSaving] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchAttendance(logId)
      .then(setRecords)
      .catch(() => setError('Failed to load attendance.'))
  }, [logId])

  async function handleToggle(record: AttendanceRecord, newStatus: Status) {
    setSaving(record.crew_member_id)
    setRecords((prev) =>
      prev.map((r) => (r.crew_member_id === record.crew_member_id ? { ...r, status: newStatus } : r))
    )
    try {
      await upsertAttendance(logId, record.crew_member_id, newStatus, record.note ?? undefined)
    } catch {
      setError('Failed to save attendance.')
      setRecords((prev) =>
        prev.map((r) => (r.crew_member_id === record.crew_member_id ? { ...r, status: record.status } : r))
      )
    } finally {
      setSaving(null)
    }
  }

  async function handleNote(record: AttendanceRecord, note: string) {
    setRecords((prev) =>
      prev.map((r) => (r.crew_member_id === record.crew_member_id ? { ...r, note } : r))
    )
    try {
      await upsertAttendance(logId, record.crew_member_id, record.status, note)
    } catch {
      setError('Failed to save note.')
    }
  }

  if (records.length === 0 && !error) return <p style={{ color: '#888' }}>No crew members on this project.</p>

  return (
    <div style={s.block}>
      <h3 style={s.heading}>Crew Attendance</h3>
      {error && <p style={s.error}>{error}</p>}
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>Name</th>
            <th style={s.th}>Profession</th>
            <th style={s.th}>Status</th>
            {!readOnly && <th style={s.th}>Note</th>}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.crew_member_id} style={saving === r.crew_member_id ? { opacity: 0.6 } : {}}>
              <td style={s.td}>{r.name}</td>
              <td style={s.td}>{r.profession ?? '—'}</td>
              <td style={s.td}>
                {readOnly ? (
                  <span style={{ color: STATUS_COLORS[r.status as Status], fontWeight: 600 }}>
                    {STATUS_LABELS[r.status as Status]}
                  </span>
                ) : (
                  <div style={s.toggleGroup}>
                    {(['present', 'absent', 'partial'] as Status[]).map((st) => (
                      <button
                        key={st}
                        style={{
                          ...s.toggleBtn,
                          background: r.status === st ? STATUS_COLORS[st] : '#eee',
                          color: r.status === st ? '#fff' : '#555',
                        }}
                        onClick={() => handleToggle(r, st)}
                        disabled={saving === r.crew_member_id}
                      >
                        {STATUS_LABELS[st]}
                      </button>
                    ))}
                  </div>
                )}
              </td>
              {!readOnly && (
                <td style={s.td}>
                  <input
                    style={s.noteInput}
                    placeholder="optional note"
                    value={r.note ?? ''}
                    onChange={(e) => setRecords((prev) =>
                      prev.map((rec) => rec.crew_member_id === r.crew_member_id ? { ...rec, note: e.target.value } : rec)
                    )}
                    onBlur={(e) => handleNote(r, e.target.value)}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  block: { border: '1px solid #ddd', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem' },
  heading: { margin: '0 0 1rem', fontSize: '1rem', color: '#333' },
  error: { color: '#c0392b', fontSize: '0.85rem' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' },
  th: { textAlign: 'left', padding: '0.4rem 0.6rem', borderBottom: '2px solid #ddd', fontWeight: 600, color: '#555' },
  td: { padding: '0.4rem 0.6rem', borderBottom: '1px solid #eee', verticalAlign: 'middle' },
  toggleGroup: { display: 'flex', gap: '0.25rem' },
  toggleBtn: { padding: '0.2rem 0.55rem', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 },
  noteInput: { width: '100%', padding: '0.25rem 0.4rem', border: '1px solid #ddd', borderRadius: '4px', fontSize: '0.82rem', boxSizing: 'border-box' },
}
