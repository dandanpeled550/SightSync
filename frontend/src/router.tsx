import { createBrowserRouter } from 'react-router-dom'
import DesktopShell from './components/DesktopShell'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import ProjectSelect from './pages/ProjectSelect'
import OnboardUpload from './pages/OnboardUpload'
import Today from './pages/Today'
import Task from './pages/Task'
import NewTask from './pages/NewTask'
import Plans from './pages/Plans'
import Site from './pages/Site'
import Alerts from './pages/Alerts'
import Report from './pages/Report'
import Summary from './pages/Summary'
import Export from './pages/Export'
import Upload from './pages/Upload'
import Review from './pages/Review'
import CrewManagement from './pages/CrewManagement'
import CrewAttendance from './pages/CrewAttendance'
import Inventory from './pages/Inventory'
import SafetyHistory from './pages/SafetyHistory'

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  { path: '/projects', element: <ProtectedRoute><ProjectSelect /></ProtectedRoute> },
  { path: '/onboard-upload', element: <ProtectedRoute><OnboardUpload /></ProtectedRoute> },
  {
    element: <ProtectedRoute><DesktopShell /></ProtectedRoute>,
    children: [
      { path: '/',               element: <Today /> },
      { path: '/task/new',       element: <NewTask /> },
      { path: '/task/:taskId',   element: <Task /> },
      { path: '/plans',          element: <Plans /> },
      { path: '/site',           element: <Site /> },
      { path: '/alerts',         element: <Alerts /> },
      { path: '/report',         element: <Report /> },
      { path: '/summary',        element: <Summary /> },
      { path: '/export',         element: <Export /> },
      { path: '/onboard',        element: <Upload /> },
      { path: '/onboard/review', element: <Review /> },
      { path: '/crew',            element: <CrewManagement /> },
      { path: '/crew/attendance', element: <CrewAttendance /> },
      { path: '/inventory',       element: <Inventory /> },
      { path: '/safety',          element: <SafetyHistory /> },
    ],
  },
])
