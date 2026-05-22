import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext'
import LoginScreen from './components/auth/LoginScreen'
import WorkspaceSelector from './components/workspace/WorkspaceSelector'
import AppLayout from './components/layout/AppLayout'
import HomeScreen from './components/home/HomeScreen'
import ProjectsScreen from './components/projects/ProjectsScreen'
import ProjectDetail from './components/projects/ProjectDetail'
import TaskDetail from './components/projects/TaskDetail'
import CalendarScreen from './components/calendar/CalendarScreen'
import ArchiveScreen from './components/archive/ArchiveScreen'
import SettingsScreen from './components/settings/SettingsScreen'

function AppRoutes() {
  const { user, loading: authLoading }                                  = useAuth()
  const { activeWorkspace, workspaces, switchWorkspace, loading: wsLoading } = useWorkspace()

  // Tema: rispetta localStorage (impostato da SettingsScreen), altrimenti usa sistema
  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const root  = document.documentElement
    const applySystem = (dark) => dark ? root.classList.add('dark') : root.classList.remove('dark')

    if (saved === 'dark') {
      root.classList.add('dark')
    } else if (saved === 'light') {
      root.classList.remove('dark')
    } else {
      // Auto — segue sistema
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      applySystem(mq.matches)
      const onChange = (e) => applySystem(e.matches)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }
  }, [])

  if (authLoading || wsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <img src="/icons/icon-192.png" className="w-16 h-16 rounded-3xl shadow-lg" alt="Mino" />
          <div className="w-6 h-6 border-2 border-primary-300 border-t-primary-500 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!user) return <LoginScreen />

  if (!activeWorkspace) {
    return <WorkspaceSelector onSelect={switchWorkspace} />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="home"                   element={<HomeScreen />} />
          <Route path="projects"               element={<ProjectsScreen />} />
          <Route path="projects/:projectId"    element={<ProjectDetail />} />
          <Route path="projects/task/:taskId"  element={<TaskDetail />} />
          <Route path="calendar"               element={<CalendarScreen />} />
          <Route path="archive"                element={<ArchiveScreen />} />
          <Route path="settings"               element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <AppRoutes />
      </WorkspaceProvider>
    </AuthProvider>
  )
}
