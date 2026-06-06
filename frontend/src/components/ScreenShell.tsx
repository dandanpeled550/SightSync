import type { ReactNode } from 'react'
import { colors, gradients, desktop } from '../constants/theme'
import { useWindowSize } from '../hooks/useWindowSize'
import BottomNav from './BottomNav'

interface ScreenShellProps {
  title?: string
  subtitle?: string
  leftAction?: ReactNode
  rightAction?: ReactNode
  hideBottomNav?: boolean
  desktopHideLeft?: boolean
  children: ReactNode
}

export default function ScreenShell({
  title,
  subtitle,
  leftAction,
  rightAction,
  hideBottomNav = false,
  desktopHideLeft = false,
  children,
}: ScreenShellProps) {
  const width = useWindowSize()
  const isDesktop = width >= desktop.breakpoint

  return (
    <div style={{
      width: '100%',
      minHeight: isDesktop ? '100%' : '100vh',
      background: gradients.phoneShell,
      position: 'relative',
    }}>
      {/* Top bar — 52px, icon | title block | right */}
      <div style={{
        height: '52px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        padding: '0 24px',
        borderBottom: `1px solid ${colors.line}`,
        flexShrink: 0,
      }}>
        {/* Left slot */}
        <div style={{ width: '40px', flexShrink: 0 }}>
          {(desktopHideLeft && isDesktop) ? <div /> : (leftAction ?? <div />)}
        </div>

        {/* Title block */}
        <div style={{ flex: 1, textAlign: 'left' }}>
          {title && (
            <h2 style={{
              margin: 0,
              fontSize: '19px',
              fontWeight: 900,
              letterSpacing: '-0.04em',
              color: colors.text,
              lineHeight: 1.1,
            }}>
              {title}
            </h2>
          )}
          {subtitle && (
            <p style={{
              margin: '3px 0 0',
              fontSize: '12px',
              color: colors.muted,
              letterSpacing: 0,
            }}>
              {subtitle}
            </p>
          )}
        </div>

        {/* Right slot */}
        <div style={{ flexShrink: 0, minWidth: '40px', display: 'flex', justifyContent: 'flex-end' }}>
          {rightAction ?? <div />}
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{
        paddingBottom: hideBottomNav ? '20px' : '80px',
        overflowY: 'auto',
      }}>
        {children}
      </div>

      {!hideBottomNav && <BottomNav />}
    </div>
  )
}

/** Reusable icon button that matches the mockup's .icon class */
export function IconBtn({
  onClick,
  children,
  style,
}: {
  onClick?: () => void
  children: ReactNode
  style?: React.CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '40px',
        height: '40px',
        border: 0,
        background: colors.surface,
        borderRadius: '14px',
        display: 'grid',
        placeItems: 'center',
        fontSize: '20px',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </button>
  )
}
