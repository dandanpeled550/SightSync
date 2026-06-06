import { useState, useEffect } from 'react'
import ScreenShell from '../components/ScreenShell'
import { colors, radius, shadow } from '../constants/theme'
import { fetchTodayLog, downloadPdf, type DailyLog } from '../api/daily_log'
import { useProject } from '../contexts/ProjectContext'

export default function Export() {
  const { currentProject } = useProject()
  const PROJECT_ID = currentProject?.id ?? 1

  const [log, setLog] = useState<DailyLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTodayLog(PROJECT_ID)
      .then(setLog)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load report'))
      .finally(() => setLoading(false))
  }, [PROJECT_ID])

  async function handleDownload() {
    if (!log) return
    setDownloading(true)
    setError(null)
    try {
      const blob = await downloadPdf(PROJECT_ID, log.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `daily-log-${log.date}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <ScreenShell title="Export Report" hideBottomNav>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 56px)' }}>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', paddingBottom: '100px' }}>

          {error && (
            <div style={{
              background: colors.redSoft, border: `1px solid ${colors.redBorder}`,
              borderRadius: radius.card, padding: '14px 16px',
              color: colors.red, fontSize: 14, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {loading && (
            <div style={{
              background: colors.surface2, borderRadius: radius.card,
              padding: '28px 20px', textAlign: 'center', boxShadow: shadow.card,
              color: colors.muted, fontSize: 14,
            }}>
              Loading report…
            </div>
          )}

          {!loading && log && (
            <>
              {/* Report header card */}
              <div style={{
                background: colors.surface, borderRadius: radius.card,
                boxShadow: shadow.card, padding: '20px', marginBottom: 16,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: colors.text, marginBottom: 4 }}>
                      Daily Construction Report
                    </div>
                    <div style={{ fontSize: 13, color: colors.muted }}>
                      {log.date}
                    </div>
                  </div>
                  <div style={{
                    background: colors.greenSoft, color: colors.green,
                    fontSize: 11, fontWeight: 700, padding: '4px 10px',
                    borderRadius: 20, border: `1px solid ${colors.greenBorder}`,
                  }}>
                    Ready
                  </div>
                </div>

                {log.ai_summary && (
                  <>
                    <div style={{ height: 1, background: colors.line, margin: '16px 0' }} />
                    <div style={{ fontSize: 12, fontWeight: 700, color: colors.muted, marginBottom: 8, letterSpacing: '0.05em' }}>
                      AI SUMMARY
                    </div>
                    <div style={{
                      fontSize: 13, lineHeight: 1.6, color: colors.text,
                      fontStyle: 'italic', whiteSpace: 'pre-wrap',
                    }}>
                      {log.ai_summary}
                    </div>
                  </>
                )}
              </div>

              {/* What's included */}
              <div style={{
                background: colors.surface, borderRadius: radius.card,
                boxShadow: shadow.card, padding: '16px 20px',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: colors.muted, marginBottom: 12, letterSpacing: '0.05em' }}>
                  REPORT INCLUDES
                </div>
                {[
                  'Weather conditions',
                  'Task progress summary',
                  'Crew attendance',
                  'Materials used',
                  'Safety incident reports',
                ].map(item => (
                  <div key={item} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    fontSize: 14, color: colors.text, padding: '6px 0',
                    borderBottom: `1px solid ${colors.line}`,
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: colors.greenSoft, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2 2 4-4" stroke={colors.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    {item}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Download button */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '12px 16px 24px',
          background: 'rgba(255,255,255,0.97)',
          borderTop: `1px solid ${colors.line}`,
          backdropFilter: 'blur(8px)',
        }}>
          <button
            onClick={handleDownload}
            disabled={!log || downloading}
            style={{
              width: '100%', padding: '14px',
              background: log && !downloading
                ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                : colors.mutedLight,
              color: '#fff', border: 'none', borderRadius: radius.btn,
              fontSize: 15, fontWeight: 700,
              cursor: log && !downloading ? 'pointer' : 'not-allowed',
              boxShadow: log && !downloading ? '0 10px 20px rgba(37,99,235,.25)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {downloading ? 'Generating PDF…' : 'Download PDF Report'}
          </button>
        </div>
      </div>
    </ScreenShell>
  )
}
