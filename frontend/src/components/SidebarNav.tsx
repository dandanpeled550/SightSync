import { useNavigate, useLocation } from 'react-router-dom'
import { colors, shadow } from '../constants/theme'

const navItems = [
  { label: 'Home',    icon: '🏠', path: '/' },
  { label: 'Alerts',  icon: '🔔', path: '/alerts' },
  { label: 'Reports', icon: '▣',  path: '/report' },
  { label: 'Site',    icon: '☷',  path: '/site' },
]

export default function SidebarNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  function isActive(path: string): boolean {
    if (path === '/') {
      return pathname === '/' || pathname.startsWith('/plans') || pathname.startsWith('/task')
    }
    return pathname.startsWith(path)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: colors.surface2,
      borderRight: `1px solid ${colors.line}`,
      padding: '24px 16px',
      gap: '4px',
      overflowY: 'auto',
    }}>
      {/* Brand */}
      <div style={{
        padding: '0 8px 24px',
        fontSize: '22px',
        fontWeight: 900,
        letterSpacing: '-0.05em',
        color: colors.text,
      }}>
        simple<span style={{ color: colors.blue }}>.</span>
      </div>

      {/* Nav label */}
      <div style={{
        padding: '0 8px 8px',
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: colors.mutedLight,
      }}>
        Navigation
      </div>

      {/* Nav items */}
      {navItems.map(item => {
        const active = isActive(item.path)
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '14px',
              background: active ? colors.blueSoft : 'transparent',
              color: active ? '#1557c0' : colors.muted,
              fontWeight: active ? 800 : 500,
              fontSize: '14px',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.12s, color 0.12s',
              boxShadow: active ? shadow.card : 'none',
              letterSpacing: '-0.01em',
            }}
            onMouseEnter={e => {
              if (!active) e.currentTarget.style.background = colors.surface
            }}
            onMouseLeave={e => {
              if (!active) e.currentTarget.style.background = 'transparent'
            }}
          >
            <span style={{ fontSize: '18px', lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        )
      })}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* User row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 8px',
        borderRadius: '14px',
        background: colors.surface,
        border: `1px solid ${colors.line}`,
      }}>
        <div style={{
          width: '34px',
          height: '34px',
          borderRadius: '10px',
          background: colors.blue,
          color: colors.surface,
          display: 'grid',
          placeItems: 'center',
          fontSize: '13px',
          fontWeight: 800,
          flexShrink: 0,
        }}>
          DP
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: colors.text, letterSpacing: '-0.01em' }}>
            Dan P.
          </div>
          <div style={{ fontSize: '11px', color: colors.muted }}>
            Foreman
          </div>
        </div>
      </div>
    </div>
  )
}
