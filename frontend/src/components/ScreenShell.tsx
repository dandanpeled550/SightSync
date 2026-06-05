import type { ReactNode } from 'react'
import { shell, colors } from '../constants/theme'
import BottomNav from './BottomNav'

interface ScreenShellProps {
  title?: string
  subtitle?: string
  children: ReactNode
  hideBottomNav?: boolean
}

export default function ScreenShell({ title, subtitle, children }: ScreenShellProps) {
  return (
    <div style={shell}>
      {(title || subtitle) && (
        <div style={{
          padding: '16px 20px 12px',
          borderBottom: `1px solid ${colors.line}`,
          background: colors.surface,
        }}>
          {title && (
            <div style={{ fontSize: '18px', fontWeight: 700, color: colors.text }}>{title}</div>
          )}
          {subtitle && (
            <div style={{ fontSize: '13px', color: colors.muted, marginTop: '2px' }}>{subtitle}</div>
          )}
        </div>
      )}
      <div style={{ paddingBottom: '72px', overflowY: 'auto', minHeight: '100vh' }}>
        {children}
      </div>
      <BottomNav />
    </div>
  )
}
