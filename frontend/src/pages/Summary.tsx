import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ScreenShell from '../components/ScreenShell'
import { colors, radius, shadow } from '../constants/theme'
import { fetchTodayLog, type DailyLog } from '../api/daily_log'
import { useProject } from '../contexts/ProjectContext'

type ParsedBlock =
  | { type: 'heading'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'paragraph'; text: string }

function parseSummary(raw: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = []
  const lines = raw.split('\n')
  let bulletBuffer: string[] = []

  function flushBullets() {
    if (bulletBuffer.length > 0) {
      blocks.push({ type: 'bullets', items: [...bulletBuffer] })
      bulletBuffer = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) { flushBullets(); continue }

    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)$/)
    const boldHeadingMatch = trimmed.match(/^\*\*(.+?)\*\*:?\s*$/)
    const bulletMatch = trimmed.match(/^[-•*]\s+(.+)$/)

    if (headingMatch) {
      flushBullets()
      blocks.push({ type: 'heading', text: headingMatch[1].replace(/\*\*/g, '') })
    } else if (boldHeadingMatch) {
      flushBullets()
      blocks.push({ type: 'heading', text: boldHeadingMatch[1] })
    } else if (bulletMatch) {
      bulletBuffer.push(bulletMatch[1].replace(/\*\*/g, ''))
    } else {
      flushBullets()
      blocks.push({ type: 'paragraph', text: trimmed.replace(/\*\*/g, '') })
    }
  }
  flushBullets()
  return blocks
}

function SummaryDocument({ text }: { text: string }) {
  const blocks = parseSummary(text)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {blocks.map((block, i) => {
        if (block.type === 'heading') {
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginTop: i === 0 ? 0 : 20, marginBottom: 8,
            }}>
              <div style={{
                width: 3, height: 16, borderRadius: 2,
                background: colors.blue, flexShrink: 0,
              }} />
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: colors.muted,
              }}>
                {block.text}
              </span>
            </div>
          )
        }
        if (block.type === 'bullets') {
          return (
            <div key={i} style={{
              background: colors.surface2, borderRadius: radius.icon,
              padding: '10px 14px', marginBottom: 4,
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              {block.items.map((item, j) => (
                <div key={j} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: colors.blue, marginTop: 7, flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 14, lineHeight: 1.6, color: colors.text }}>
                    {item}
                  </span>
                </div>
              ))}
            </div>
          )
        }
        return (
          <p key={i} style={{
            fontSize: 14, lineHeight: 1.7, color: colors.text,
            margin: '0 0 8px 0',
          }}>
            {block.text}
          </p>
        )
      })}
    </div>
  )
}

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
              boxShadow: shadow.card, overflow: 'hidden',
            }}>
              {/* Report header strip */}
              <div style={{
                padding: '14px 20px', borderBottom: `1px solid ${colors.line}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '8px',
                    background: colors.blueSoft,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, flexShrink: 0,
                  }}>&#9998;</div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: colors.text }}>
                    Daily Report Summary
                  </span>
                </div>
                <span style={{
                  fontSize: 11, color: colors.muted,
                  background: colors.surface2, borderRadius: radius.pill,
                  padding: '3px 10px', border: `1px solid ${colors.line}`,
                }}>
                  {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>

              {/* Structured body */}
              <div style={{ padding: '18px 20px 20px' }}>
                <SummaryDocument text={summaryText} />
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
