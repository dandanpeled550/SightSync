import ScreenShell from '../components/ScreenShell'
import { colors } from '../constants/theme'

export default function Summary() {
  return (
    <ScreenShell title="AI Summary">
      <div style={{ padding: '20px', textAlign: 'center', color: colors.muted, marginTop: '40px' }}>
        AI Summary — coming in Sprint 5
      </div>
    </ScreenShell>
  )
}
