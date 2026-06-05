import ScreenShell from '../components/ScreenShell'
import { colors } from '../constants/theme'

export default function Site() {
  return (
    <ScreenShell title="Site Tree">
      <div style={{ padding: '20px', textAlign: 'center', color: colors.muted, marginTop: '40px' }}>
        Site Tree — coming in Sprint 3
      </div>
    </ScreenShell>
  )
}
