import { createBrowserRouter } from 'react-router-dom'
import DesktopShell from './components/DesktopShell'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import ProjectSelect from './pages/ProjectSelect'
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

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/projects', element: <ProtectedRoute><ProjectSelect /></ProtectedRoute> },
  {
    element: <ProtectedRoute><DesktopShell /></ProtectedRoute>,
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
  },
])
