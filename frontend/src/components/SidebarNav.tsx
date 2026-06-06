import { useNavigate, useLocation } from 'react-router-dom'
import { colors, gradients } from '../constants/theme'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { label: 'Home',    icon: '🏠', path: '/' },
  { label: 'Plans',   icon: '📅', path: '/plans' },
  { label: 'Upload',  icon: '⬆️', path: '/onboard' },
  { label: 'Alerts',  icon: '🔔', path: '/alerts' },
  { label: 'Safety',  icon: '🛡',  path: '/safety' },
  { label: 'Reports', icon: '▣',  path: '/report' },
  { label: 'Crew',      icon: '👷', path: '/crew' },
  { label: 'Inventory', icon: '📦', path: '/inventory' },
]

export default function SidebarNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, logout } = useAuth()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  function isActive(path: string): boolean {
    if (path === '/plans') {
      return pathname.startsWith('/plans') || pathname.startsWith('/task')
    }
    if (path === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(path)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: colors.surface,
      borderRight: `1px solid ${colors.line}`,
      padding: '24px 18px',
      overflowY: 'auto',
    }}>
      {/* Brand */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '28px',
        padding: '0 8px',
      }}>
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          background: gradients.primary,
          color: colors.surface,
          display: 'grid',
          placeItems: 'center',
          fontSize: '22px',
          fontWeight: 900,
          flexShrink: 0,
          boxShadow: '0 10px 22px rgba(255,75,11,.25)',
        }}>
          S
        </div>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '-0.03em', color: colors.text, lineHeight: 1.1 }}>
            simple<span style={{ color: colors.primary }}>.</span>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navItems.map(item => {
          const active = isActive(item.path)
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '13px',
                height: '48px',
                padding: '0 14px',
                borderRadius: '12px',
                background: active ? colors.primarySoft : 'transparent',
                color: active ? colors.primary : '#252b35',
                fontWeight: 800,
                fontSize: '15px',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.12s, color 0.12s',
              }}
              onMouseEnter={e => {
                if (!active) e.currentTarget.style.background = colors.surface2
              }}
              onMouseLeave={e => {
                if (!active) e.currentTarget.style.background = 'transparent'
              }}
            >
              <span style={{ fontSize: '20px', lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* User + logout */}
      <div style={{
        border: `1px solid ${colors.line}`,
        borderRadius: '16px',
        padding: '14px 16px',
        background: colors.surface2,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '10px',
          background: gradients.primary,
          color: colors.surface,
          display: 'grid',
          placeItems: 'center',
          fontSize: '12px',
          fontWeight: 800,
          flexShrink: 0,
        }}>
          {user?.name ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '13px', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.name ?? 'Account'}
          </div>
          <div style={{ fontSize: '11px', color: colors.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email ?? ''}
          </div>
        </div>
        <button
          onClick={handleLogout}
          title="Sign out"
          style={{
            width: '30px',
            height: '30px',
            border: `1.5px solid ${colors.line}`,
            borderRadius: '9px',
            background: colors.surface,
            color: colors.muted,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          ↩
        </button>
      </div>
    </div>
  )
}
