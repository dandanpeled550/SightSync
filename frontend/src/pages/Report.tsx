import { useNavigate } from 'react-router-dom'
import ScreenShell from '../components/ScreenShell'
import { colors, gradients, radius } from '../constants/theme'

export default function Report() {
  const navigate = useNavigate()

  return (
    <ScreenShell title="Daily Report">
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '60px 24px',
        gap: '14px',
        textAlign: 'center',
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: colors.surface2,
          display: 'grid',
          placeItems: 'center',
          fontSize: '36px',
        }}>
          📊
        </div>
        <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.04em', color: colors.text }}>
          Daily Report
        </div>
        <div style={{ fontSize: '14px', color: colors.muted, lineHeight: 1.5, maxWidth: '240px' }}>
          Complete today's log to generate a summary.
        </div>
        <button
          onClick={() => navigate('/')}
          style={{
            marginTop: '8px',
            height: '52px',
            padding: '0 32px',
            border: 'none',
            borderRadius: radius.btn,
            background: gradients.primary,
            color: colors.surface,
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
            letterSpacing: '-0.01em',
            boxShadow: '0 10px 20px rgba(37,99,235,.2)',
          }}
        >
          Log today's progress
        </button>
      </div>
    </ScreenShell>
  )
}
