import type { CSSProperties } from 'react'

export const colors = {
  blue:        '#2563eb',
  blueDark:    '#1d4ed8',
  blueSoft:    '#edf5ff',
  blueDeep:    '#174ea6',
  green:       '#139a4b',
  greenSoft:   '#eaf8ef',
  greenBorder: '#c7ead3',
  red:         '#ef4444',
  redSoft:     '#fff1f1',
  redBorder:   '#ffd0d0',
  orange:      '#f59e0b',
  orangeSoft:  '#fff7e6',
  text:        '#111827',
  muted:       '#667085',
  mutedLight:  '#98a2b3',
  surface:     '#ffffff',
  surface2:    '#f7faff',
  line:        '#e8edf5',
}

export const radius = {
  phone:  '38px',
  card:   '22px',
  task:   '20px',
  btn:    '17px',
  icon:   '14px',
  pill:   '999px',
}

export const shadow = {
  phone: '0 24px 70px rgba(15,23,42,.10)',
  card:  '0 12px 35px rgba(15,23,42,.06)',
}

export const shell: CSSProperties = {
  maxWidth:   '390px',
  minHeight:  '100vh',
  margin:     '0 auto',
  background: '#fff',
  position:   'relative',
  overflow:   'hidden',
}

export const bottomNavStyle: CSSProperties = {
  position:            'absolute',
  bottom:              0,
  left:                0,
  right:               0,
  display:             'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  padding:             '10px 14px 12px',
  borderTop:           `1px solid #e8edf5`,
  background:          'rgba(255,255,255,0.95)',
  backdropFilter:      'blur(8px)',
  zIndex:              10,
}

export const gradients = {
  bluePrimary: 'linear-gradient(180deg,#3b82f6,#2563eb)',
  phoneShell:  'linear-gradient(180deg,#fff,#fbfdff)',
}

export const desktop = {
  breakpoint:   900,
  sidebarWidth: '220px',
  asideWidth:   '260px',
}

export const animations = {
  delayStep: 0.05,
}
