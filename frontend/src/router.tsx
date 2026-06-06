import { createBrowserRouter } from 'react-router-dom'
import DesktopShell from './components/DesktopShell'
import Today from './pages/Today'
import Task from './pages/Task'
import Plans from './pages/Plans'
import Site from './pages/Site'
import Alerts from './pages/Alerts'
import Report from './pages/Report'
import Summary from './pages/Summary'
import Export from './pages/Export'
import Upload from './pages/Upload'
import Review from './pages/Review'

export const router = createBrowserRouter([{
  element: <DesktopShell />,
  children: [
    { path: '/',               element: <Today /> },
    { path: '/task/:taskId',   element: <Task /> },
    { path: '/plans',          element: <Plans /> },
    { path: '/site',           element: <Site /> },
    { path: '/alerts',         element: <Alerts /> },
    { path: '/report',         element: <Report /> },
    { path: '/summary',        element: <Summary /> },
    { path: '/export',         element: <Export /> },
    { path: '/onboard',        element: <Upload /> },
    { path: '/onboard/review', element: <Review /> },
  ],
}])
