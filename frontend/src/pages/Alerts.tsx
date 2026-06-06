import ScreenShell from '../components/ScreenShell'
import { colors } from '../constants/theme'

export default function Alerts() {
  return (
    <ScreenShell title="Alerts">
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
          🔔
        </div>
        <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.04em', color: colors.text }}>
          No alerts
        </div>
        <div style={{ fontSize: '14px', color: colors.muted, lineHeight: 1.5, maxWidth: '240px' }}>
          Schedule warnings and delay impacts will appear here.
        </div>
      </div>
    </ScreenShell>
  )
}
