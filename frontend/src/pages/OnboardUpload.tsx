import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadSchedule, type ExtractionResult } from '../api/tasks'
import { useProject } from '../contexts/ProjectContext'
import { colors, radius, gradients } from '../constants/theme'

export default function OnboardUpload() {
  const navigate = useNavigate()
  const { currentProject } = useProject()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  async function handleFile(file: File) {
    if (!file.name.endsWith('.xlsx')) {
      setError('Please upload an Excel file (.xlsx)')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result: ExtractionResult = await uploadSchedule(file, currentProject?.id ?? 1)
      if (result.error) {
        setError(`Extraction failed: ${result.error}`)
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

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.surface2,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px',
    }}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />

      {/* Top branding */}
      <div style={{ width: '100%', maxWidth: '480px', marginBottom: '40px', paddingTop: '16px' }}>
        <span style={{
          fontSize: '20px',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          color: colors.text,
        }}>
          simple.
        </span>
      </div>

      <div style={{ width: '100%', maxWidth: '480px' }}>
        {/* Step indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '32px',
        }}>
          {[
            { label: 'Account', done: true },
            { label: 'Project', done: true },
            { label: 'Schedule', done: false, active: true },
          ].map((step, i) => (
            <React.Fragment key={step.label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: step.done
                    ? colors.green
                    : step.active
                      ? gradients.bluePrimary
                      : colors.line,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: step.done || step.active ? '#fff' : colors.mutedLight,
                  flexShrink: 0,
                  backgroundImage: step.active ? gradients.bluePrimary : undefined,
                }}>
                  {step.done ? '✓' : i + 1}
                </div>
                <span style={{
                  fontSize: '12px',
                  fontWeight: step.active ? 700 : 500,
                  color: step.active ? colors.text : step.done ? colors.green : colors.mutedLight,
                }}>
                  {step.label}
                </span>
              </div>
              {i < 2 && (
                <div style={{
                  flex: 1,
                  height: '1px',
                  background: i < 1 ? colors.green : colors.line,
                  maxWidth: '40px',
                }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{
            margin: '0 0 8px',
            fontSize: '28px',
            fontWeight: 900,
            letterSpacing: '-0.04em',
            color: colors.text,
          }}>
            Upload your schedule
          </h1>
          <p style={{ margin: 0, fontSize: '15px', color: colors.muted, lineHeight: 1.5 }}>
            {currentProject
              ? <>Import your Excel schedule for <strong style={{ color: colors.text }}>{currentProject.name}</strong>. We'll extract tasks automatically.</>
              : 'Import your Excel schedule to extract tasks automatically.'}
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !loading && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? colors.blue : loading ? colors.mutedLight : colors.line}`,
            borderRadius: radius.card,
            padding: '48px 24px',
            textAlign: 'center',
            cursor: loading ? 'wait' : 'pointer',
            background: dragging ? colors.blueSoft : colors.surface,
            transition: 'border-color 0.15s, background 0.15s',
            marginBottom: '16px',
          }}
        >
          <div style={{ fontSize: '48px', lineHeight: 1, marginBottom: '16px' }}>
            {loading ? '⏳' : '📄'}
          </div>
          <div style={{
            fontSize: '17px',
            fontWeight: 800,
            color: loading ? colors.muted : colors.text,
            marginBottom: '6px',
            letterSpacing: '-0.02em',
          }}>
            {loading ? 'Extracting tasks…' : dragging ? 'Drop it here' : 'Drop your .xlsx here'}
          </div>
          <div style={{ fontSize: '13px', color: colors.muted }}>
            {loading ? 'This usually takes 10–20 seconds' : 'or click to browse files'}
          </div>

          {!loading && (
            <button
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
              style={{
                marginTop: '20px',
                padding: '11px 28px',
                background: gradients.bluePrimary,
                color: colors.surface,
                border: 'none',
                borderRadius: radius.btn,
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 6px 16px rgba(37,99,235,0.22)',
              }}
            >
              Choose file
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '12px 16px',
            background: colors.redSoft,
            border: `1px solid ${colors.redBorder}`,
            borderRadius: radius.btn,
            color: colors.red,
            fontSize: '13px',
            fontWeight: 500,
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        {/* Format hint */}
        <div style={{
          padding: '14px 16px',
          background: colors.blueSoft,
          borderRadius: radius.btn,
          fontSize: '13px',
          color: colors.blue,
          marginBottom: '32px',
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-start',
        }}>
          <span style={{ flexShrink: 0, marginTop: '1px' }}>ℹ️</span>
          <span>
            Supported format: <strong>.xlsx</strong> with columns for task name, start date, and duration. Gantt charts and MS Project exports work great.
          </span>
        </div>

        {/* Skip */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '14px',
              color: colors.muted,
              cursor: 'pointer',
              fontWeight: 500,
              textDecoration: 'underline',
              textDecorationColor: colors.line,
            }}
          >
            Skip for now — I'll upload later
          </button>
        </div>
      </div>
    </div>
  )
}
