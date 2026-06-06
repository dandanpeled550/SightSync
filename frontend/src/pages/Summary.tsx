import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ScreenShell from '../components/ScreenShell'
import { colors, radius, shadow } from '../constants/theme'
import { fetchTodayLog, type DailyLog } from '../api/daily_log'
import { useProject } from '../contexts/ProjectContext'

const POLL_INTERVAL_MS = 3000
const MAX_POLLS = 10

export default function Summary() {
  const navigate = useNavigate()
  const { currentProject } = useProject()
  const PROJECT_ID = currentProject?.id ?? 1

  const [log, setLog] = useState<DailyLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollCount = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function loadLog(): Promise<DailyLog> {
    const data = await fetchTodayLog(PROJECT_ID)
    setLog(data)
    return data
  }

  function stopPolling() {
    if (timer.current) clearTimeout(timer.current)
    setPolling(false)
  }

  function scheduleNextPoll() {
    if (pollCount.current >= MAX_POLLS) {
      stopPolling()
      return
    }
    timer.current = setTimeout(async () => {
      pollCount.current += 1
      try {
        const data = await loadLog()
        if (data.ai_summary) {
          stopPolling()
        } else {
          scheduleNextPoll()
        }
      } catch {
        stopPolling()
      }
    }, POLL_INTERVAL_MS)
  }

  useEffect(() => {
    async function init() {
      try {
        const data = await loadLog()
        setLoading(false)
        if (!data.ai_summary) {
          setPolling(true)
          scheduleNextPoll()
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load summary')
        setLoading(false)
      }
    }
    init()
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [PROJECT_ID])

  const summaryText = log?.ai_summary
  const isGenerating = !summaryText && (loading || polling)

  return (
    <ScreenShell title="AI Summary" subtitle="Ready to review" hideBottomNav>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 56px)' }}>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', paddingBottom: '100px' }}>

          {error && (
            <div style={{
              background: '#fff1f1', border: `1px solid ${colors.red}`,
              borderRadius: radius.card, padding: '16px', color: colors.red,
              fontSize: 14, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          {isGenerating && (
            <div style={{
              background: colors.surface2, borderRadius: radius.card,
              padding: '28px 20px', textAlign: 'center', boxShadow: shadow.card,
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✨</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: colors.text, marginBottom: 8 }}>
                Generating AI Summary…
              </div>
              <div style={{ color: colors.muted, fontSize: 13, lineHeight: 1.5 }}>
                Claude is reviewing today's log. This takes a few seconds.
              </div>
              {/* Animated dots */}
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 6 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: colors.blue,
                    opacity: 0.3 + i * 0.3,
                    animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}

          {!isGenerating && !summaryText && !error && (
            <div style={{
              background: colors.surface2, borderRadius: radius.card,
              padding: '28px 20px', textAlign: 'center', boxShadow: shadow.card,
              color: colors.muted, fontSize: 14,
            }}>
              Summary not available yet. Try again in a moment.
            </div>
          )}

          {summaryText && (
            <div style={{
              background: colors.surface, borderRadius: radius.card,
              boxShadow: shadow.card, padding: '20px',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, flexShrink: 0,
                }}>✨</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>AI Summary</div>
                  <div style={{ fontSize: 12, color: colors.muted }}>Generated by Claude</div>
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: colors.line, marginBottom: 16 }} />

              {/* Summary paragraphs */}
              <div style={{ fontSize: 15, lineHeight: 1.7, color: colors.text, whiteSpace: 'pre-wrap' }}>
                {summaryText}
              </div>
            </div>
          )}
        </div>

        {/* Bottom action */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '12px 16px 24px',
          background: 'rgba(255,255,255,0.97)',
          borderTop: `1px solid ${colors.line}`,
          backdropFilter: 'blur(8px)',
        }}>
          <button
            onClick={() => navigate('/export')}
            disabled={!summaryText}
            style={{
              width: '100%', padding: '14px',
              background: summaryText ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : colors.mutedLight,
              color: '#fff', border: 'none', borderRadius: radius.btn,
              fontSize: 15, fontWeight: 700, cursor: summaryText ? 'pointer' : 'not-allowed',
              boxShadow: summaryText ? '0 10px 20px rgba(37,99,235,.25)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            Use in report
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.3); opacity: 1; }
        }
      `}</style>
    </ScreenShell>
  )
}
