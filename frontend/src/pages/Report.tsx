import ScreenShell from '../components/ScreenShell'
import { colors } from '../constants/theme'

export default function Report() {
  return (
    <ScreenShell title="Daily Report">
      <div style={{ padding: '20px', textAlign: 'center', color: colors.muted, marginTop: '40px' }}>
        Daily Report — coming in Sprint 5
      </div>
    </ScreenShell>
  )
}
