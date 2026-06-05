import ScreenShell from '../components/ScreenShell'
import { colors } from '../constants/theme'

export default function Task() {
  return (
    <ScreenShell title="Task Detail">
      <div style={{ padding: '20px', textAlign: 'center', color: colors.muted, marginTop: '40px' }}>
        Task Detail — coming in Sprint 3
      </div>
    </ScreenShell>
  )
}
