import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ScreenShell from '../components/ScreenShell'
import { colors, radius } from '../constants/theme'
import { uploadSchedule, type ExtractionResult } from '../api/tasks'

interface UploadRow {
  icon: string
  label: string
  hint: string
  functional: boolean
}

const rows: UploadRow[] = [
  { icon: '📄', label: 'Project Schedule', hint: '.xlsx files', functional: true },
  { icon: '📷', label: 'Site Photos',       hint: 'Coming soon', functional: false },
  { icon: '📷', label: 'Scan Document',     hint: 'Coming soon', functional: false },
]

export default function Upload() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setLoading(true)
    setError(null)
    try {
      const result: ExtractionResult = await uploadSchedule(file)
      if (result.error) {
        setError(`${result.error} (text_len=${result.raw_text_length})`)
      } else {
        navigate('/onboard/review', { state: { result } })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset so same file can be re-selected
    e.target.value = ''
  }

  function onRowClick(row: UploadRow) {
    if (!row.functional || loading) return
    fileInputRef.current?.click()
  }

  return (
    <ScreenShell hideBottomNav>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />

      {/* Hero section */}
      <div style={{
        padding: '40px 24px 28px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '56px', lineHeight: 1, marginBottom: '16px' }}>☁️</div>
        <h1 style={{
          margin: '0 0 10px',
          fontSize: '28px',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          color: colors.text,
          lineHeight: 1.1,
        }}>
          Upload Schedule
        </h1>
        <p style={{
          margin: 0,
          fontSize: '15px',
          color: colors.muted,
          lineHeight: 1.5,
        }}>
          Import your project schedule to get started
        </p>
      </div>

      {/* Upload rows */}
      <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {rows.map((row) => {
          const disabled = !row.functional || loading
          return (
            <button
              key={row.label}
              onClick={() => onRowClick(row)}
              disabled={disabled}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '16px 18px',
                background: disabled && !row.functional ? colors.surface2 : colors.surface,
                border: `1.5px solid ${colors.line}`,
                borderRadius: radius.card,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: !row.functional ? 0.55 : 1,
                textAlign: 'left',
                width: '100%',
                transition: 'box-shadow 0.15s',
              }}
            >
              <span style={{ fontSize: '26px', flexShrink: 0 }}>{row.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: colors.text,
                  marginBottom: '2px',
                }}>
                  {row.label}
                </div>
                <div style={{ fontSize: '13px', color: colors.muted }}>
                  {row.hint}
                </div>
              </div>
              <span style={{ fontSize: '20px', color: colors.mutedLight }}>›</span>
            </button>
          )
        })}
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{
          margin: '0 16px',
          padding: '14px 18px',
          background: colors.blueSoft,
          borderRadius: radius.card,
          textAlign: 'center',
          color: colors.blue,
          fontWeight: 600,
          fontSize: '14px',
        }}>
          Extracting tasks...
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{
          margin: '0 16px',
          padding: '14px 18px',
          background: colors.redSoft,
          borderRadius: radius.card,
          color: colors.red,
          fontSize: '14px',
          fontWeight: 500,
        }}>
          {error}
        </div>
      )}
    </ScreenShell>
  )
}
