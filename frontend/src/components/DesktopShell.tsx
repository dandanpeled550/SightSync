import { Outlet } from 'react-router-dom'
import { colors, desktop } from '../constants/theme'
import { useWindowSize } from '../hooks/useWindowSize'
import SidebarNav from './SidebarNav'
import AsidePanel from './AsidePanel'

export default function DesktopShell() {
  const width = useWindowSize()

  if (width < desktop.breakpoint) return <Outlet />

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `${desktop.sidebarWidth} 1fr ${desktop.asideWidth}`,
      minHeight: '100vh',
      background: colors.bg,
    }}>
      <SidebarNav />
      <main style={{
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        height: '100vh',
      }}>
        <Outlet />
      </main>
      <AsidePanel />
    </div>
  )
}
