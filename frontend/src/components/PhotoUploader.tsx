import { useRef, useState } from 'react'
import { uploadPhoto } from '../api/photos'
import { colors, radius } from '../constants/theme'

interface Props {
  value: string | null
  onChange: (url: string | null) => void
}

export default function PhotoUploader({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)
    try {
      const url = await uploadPhoto(file)
      onChange(url)
    } catch {
      setError('Upload failed — try again')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />

      {value ? (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <img
            src={value}
            alt="Attached photo"
            style={{
              width: '80px',
              height: '80px',
              objectFit: 'cover',
              borderRadius: radius.icon,
              border: `1.5px solid ${colors.line}`,
              display: 'block',
            }}
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: colors.red,
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 900,
              lineHeight: 1,
            }}
            aria-label="Remove photo"
          >
            ×
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 12px',
            background: colors.surface2,
            border: `1.5px dashed ${colors.line}`,
            borderRadius: radius.icon,
            cursor: uploading ? 'wait' : 'pointer',
            fontSize: '13px',
            color: colors.muted,
            fontWeight: 600,
            transition: 'border-color 0.15s',
          }}
        >
          {uploading ? '⏳ Uploading…' : '📷 Add photo'}
        </button>
      )}

      {error && (
        <p style={{ color: colors.red, fontSize: '12px', margin: '4px 0 0' }}>
          {error}
        </p>
      )}
    </div>
  )
}
