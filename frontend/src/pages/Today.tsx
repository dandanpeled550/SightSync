import ScreenShell from '../components/ScreenShell'
import { colors } from '../constants/theme'

export default function Today() {
  return (
    <ScreenShell title="Tower B" subtitle="Today">
      <div style={{ padding: '20px', textAlign: 'center', color: colors.muted, marginTop: '40px' }}>
        Daily Log Dashboard — coming in Sprint 3
      </div>
    </ScreenShell>
  )
}
