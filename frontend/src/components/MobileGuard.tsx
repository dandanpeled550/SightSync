import { useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useWindowSize } from '../hooks/useWindowSize'
import { desktop } from '../constants/theme'

export default function MobileGuard() {
  const width = useWindowSize()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    if (width < desktop.breakpoint && pathname !== '/') {
      navigate('/', { replace: true })
    }
  }, [width, pathname])

  return <Outlet />
}
