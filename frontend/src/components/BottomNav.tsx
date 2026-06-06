import { useNavigate, useLocation } from 'react-router-dom'
import { colors, desktop } from '../constants/theme'
import { useWindowSize } from '../hooks/useWindowSize'

const HIDDEN_ON = ['/task', '/summary', '/export', '/onboard']

const tabs = [
  { label: 'Home',      icon: '⌂',  path: '/' },
  { label: 'Plans',     icon: '≡',  path: '/plans' },
  { label: 'Alerts',    icon: '△',  path: '/alerts' },
  { label: 'Safety',    icon: '◉',  path: '/safety' },
  { label: 'Reports',   icon: '▣',  path: '/report' },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const width = useWindowSize()

  // Mobile is home-screen-only; desktop navigation is handled by SidebarNav.
  if (width < desktop.breakpoint) return null
  const hide = HIDDEN_ON.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (hide || width >= desktop.breakpoint) return null

  return (
    <div style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      borderTop: `1px solid ${colors.line}`,
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(8px)',
      zIndex: 10,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        padding: '6px 14px 8px',
      }}>
      {tabs.map(tab => {
        const active = tab.path === '/' ? pathname === '/' : pathname.startsWith(tab.path)
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              padding: '4px 0',
              minHeight: '44px',
              color: active ? colors.primary : colors.muted,
              transition: 'color 0.15s',
            }}
          >
            <span style={{ fontSize: '18px', lineHeight: 1 }}>{tab.icon}</span>
            <span style={{
              fontSize: '9px',
              fontWeight: active ? 800 : 500,
              letterSpacing: active ? '-0.01em' : 0,
            }}>
              {tab.label}
            </span>
          </button>
        )
      })}
      </div>
    </div>
  )
}
