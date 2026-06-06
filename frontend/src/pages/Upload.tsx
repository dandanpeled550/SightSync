import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ScreenShell from '../components/ScreenShell'
import { colors, radius } from '../constants/theme'
import { uploadSchedule, type ExtractionResult } from '../api/tasks'
import { uploadPhoto, fetchSitePhotos, createSitePhoto, deleteSitePhoto, type SitePhoto } from '../api/photos'
import { useProject } from '../contexts/ProjectContext'
import { fetchTodayLog } from '../api/daily_log'

export default function Upload() {
  const navigate = useNavigate()
  const { currentProject } = useProject()
  const PROJECT_ID = currentProject?.id ?? 1
  const scheduleInputRef = useRef<HTMLInputElement>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Schedule upload state
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)

  // Site photo gallery state
  const [photos, setPhotos] = useState<SitePhoto[]>([])
  const [photosLoading, setPhotosLoading] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoCaption, setPhotoCaption] = useState('')
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState<string | null>(null)
  const [logId, setLogId] = useState<number | null>(null)
  const [lightbox, setLightbox] = useState<SitePhoto | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setPhotosLoading(true)
      try {
        const [photosData, log] = await Promise.all([
          fetchSitePhotos(PROJECT_ID),
          fetchTodayLog(PROJECT_ID),
        ])
        if (!cancelled) {
          setPhotos(photosData)
          setLogId(log.id)
        }
      } catch {
        // Graceful degradation — gallery just shows empty
      } finally {
        if (!cancelled) setPhotosLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [PROJECT_ID])

  async function handleScheduleFile(file: File) {
    setLoadingSchedule(true)
    setScheduleError(null)
    try {
      const result: ExtractionResult = await uploadSchedule(file, PROJECT_ID)
      if (result.error) {
        setScheduleError(`${result.error} (text_len=${result.raw_text_length})`)
      } else {
        navigate('/onboard/review', { state: { result } })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.'
      setScheduleError(msg)
    } finally {
      setLoadingSchedule(false)
    }
  }

  async function handlePhotoFileSelected(file: File) {
    setUploadingPhoto(true)
    try {
      const url = await uploadPhoto(file)
      setPendingPhotoUrl(url)
    } catch {
      // ignore — user can retry
    } finally {
      setUploadingPhoto(false)
    }
  }

  async function savePhoto() {
    if (!pendingPhotoUrl) return
    try {
      const newPhoto = await createSitePhoto(PROJECT_ID, {
        photo_url: pendingPhotoUrl,
        caption: photoCaption.trim() || undefined,
        daily_log_id: logId ?? undefined,
      })
      setPhotos((prev) => [newPhoto, ...prev])
      setPendingPhotoUrl(null)
      setPhotoCaption('')
    } catch {
      // ignore
    }
  }

  async function handleDeletePhoto(photo: SitePhoto) {
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
    try {
      await deleteSitePhoto(PROJECT_ID, photo.id)
    } catch {
      setPhotos((prev) => [photo, ...prev])
    }
  }

  return (
    <ScreenShell hideBottomNav>
      {/* Hidden inputs */}
      <input
        ref={scheduleInputRef}
        type="file"
        accept=".xlsx"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleScheduleFile(f)
          e.target.value = ''
        }}
      />
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handlePhotoFileSelected(f)
          e.target.value = ''
        }}
      />

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.88)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            gap: '16px',
          }}
        >
          <img
            src={lightbox.photo_url}
            alt={lightbox.caption ?? 'Site photo'}
            style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '12px', objectFit: 'contain' }}
          />
          {lightbox.caption && (
            <p style={{ color: '#fff', fontSize: '14px', textAlign: 'center', margin: 0 }}>
              {lightbox.caption}
            </p>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleDeletePhoto(lightbox); setLightbox(null) }}
            style={{
              padding: '8px 16px',
              background: colors.red,
              color: '#fff',
              border: 'none',
              borderRadius: radius.btn,
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            Delete photo
          </button>
        </div>
      )}

      {/* Hero */}
      <div style={{ padding: '40px 24px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', lineHeight: 1, marginBottom: '12px' }}>☁️</div>
        <h1 style={{ margin: '0 0 8px', fontSize: '26px', fontWeight: 900, letterSpacing: '-0.04em', color: colors.text }}>
          Upload
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: colors.muted }}>
          Import schedule or add site photos
        </p>
      </div>

      <div style={{ padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* Schedule row */}
        <button
          onClick={() => !loadingSchedule && scheduleInputRef.current?.click()}
          disabled={loadingSchedule}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            padding: '16px 18px',
            background: colors.surface,
            border: `1.5px solid ${colors.line}`,
            borderRadius: radius.card,
            cursor: loadingSchedule ? 'wait' : 'pointer',
            textAlign: 'left',
            width: '100%',
          }}
        >
          <span style={{ fontSize: '26px', flexShrink: 0 }}>📄</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: colors.text, marginBottom: '2px' }}>
              {loadingSchedule ? 'Extracting tasks…' : 'Project Schedule'}
            </div>
            <div style={{ fontSize: '13px', color: colors.muted }}>
              {loadingSchedule ? 'Please wait' : '.xlsx files'}
            </div>
          </div>
          <span style={{ fontSize: '20px', color: colors.mutedLight }}>›</span>
        </button>

        {scheduleError && (
          <div style={{
            padding: '12px 16px',
            background: colors.redSoft,
            borderRadius: radius.card,
            color: colors.red,
            fontSize: '13px',
          }}>
            {scheduleError}
          </div>
        )}

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
          <div style={{ flex: 1, height: '1px', background: colors.line }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: colors.mutedLight, letterSpacing: '0.04em' }}>
            SITE PHOTOS
          </span>
          <div style={{ flex: 1, height: '1px', background: colors.line }} />
        </div>

        {/* Add photo row */}
        {pendingPhotoUrl ? (
          <div style={{
            border: `1.5px solid ${colors.line}`,
            borderRadius: radius.card,
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <img
              src={pendingPhotoUrl}
              alt="Preview"
              style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: radius.icon }}
            />
            <input
              type="text"
              placeholder="Add a caption (optional)"
              value={photoCaption}
              onChange={(e) => setPhotoCaption(e.target.value)}
              style={{
                padding: '10px 12px',
                border: `1px solid ${colors.line}`,
                borderRadius: radius.btn,
                fontSize: '14px',
                outline: 'none',
                color: colors.text,
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={savePhoto}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: colors.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: radius.btn,
                  fontWeight: 800,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Save photo
              </button>
              <button
                onClick={() => setPendingPhotoUrl(null)}
                style={{
                  padding: '12px 16px',
                  background: colors.surface2,
                  color: colors.muted,
                  border: `1px solid ${colors.line}`,
                  borderRadius: radius.btn,
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Discard
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => !uploadingPhoto && photoInputRef.current?.click()}
            disabled={uploadingPhoto}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '16px 18px',
              background: colors.surface,
              border: `1.5px dashed ${colors.line}`,
              borderRadius: radius.card,
              cursor: uploadingPhoto ? 'wait' : 'pointer',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <span style={{ fontSize: '26px', flexShrink: 0 }}>📷</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: colors.text, marginBottom: '2px' }}>
                {uploadingPhoto ? 'Uploading…' : 'Add Site Photo'}
              </div>
              <div style={{ fontSize: '13px', color: colors.muted }}>
                Tap to take a photo or pick from library
              </div>
            </div>
            <span style={{ fontSize: '20px', color: colors.mutedLight }}>+</span>
          </button>
        )}

        {/* Photo grid */}
        {photosLoading && (
          <div style={{ textAlign: 'center', padding: '20px', color: colors.muted, fontSize: '14px' }}>
            Loading photos…
          </div>
        )}

        {!photosLoading && photos.length === 0 && !pendingPhotoUrl && (
          <div style={{
            textAlign: 'center',
            padding: '32px 20px',
            color: colors.mutedLight,
            fontSize: '13px',
            border: `1px solid ${colors.line}`,
            borderRadius: radius.card,
          }}>
            No site photos yet
          </div>
        )}

        {photos.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '4px',
            borderRadius: radius.icon,
            overflow: 'hidden',
          }}>
            {photos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => setLightbox(photo)}
                style={{
                  aspectRatio: '1',
                  padding: 0,
                  border: 'none',
                  cursor: 'pointer',
                  overflow: 'hidden',
                }}
              >
                <img
                  src={photo.photo_url}
                  alt={photo.caption ?? 'Site photo'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </ScreenShell>
  )
}
