import { useNavigate, useLocation } from 'react-router-dom'
import { colors, bottomNavStyle } from '../constants/theme'

const HIDDEN_ON = ['/task', '/summary', '/export', '/onboard']

const tabs = [
  { label: 'Home',    icon: '🏠', path: '/' },
  { label: 'Alerts',  icon: '🔔', path: '/alerts' },
  { label: 'Reports', icon: '▣',  path: '/report' },
  { label: 'Site',    icon: '☷',  path: '/site' },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const hide = HIDDEN_ON.some(p => pathname === p || pathname.startsWith(p + '/'))
  if (hide) return null

  return (
    <div style={bottomNavStyle}>
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
              gap: '3px',
              padding: '4px 0',
              color: active ? colors.blue : colors.muted,
            }}
          >
            <span style={{ fontSize: '20px' }}>{tab.icon}</span>
            <span style={{ fontSize: '11px', fontWeight: active ? 600 : 400 }}>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
