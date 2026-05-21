import { useEffect, useState } from 'react'
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
import ChatScreen from './components/chat/ChatScreen'
import CalendarScreen from './components/calendar/CalendarScreen'
import ArchiveScreen from './components/archive/ArchiveScreen'

function AppRoutes() {
  const { user, loading: authLoading } = useAuth()
  const { activeWorkspace, workspaces, switchWorkspace, loading: wsLoading } = useWorkspace()

  // Dark mode automatico
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (e) => document.documentElement.classList.toggle('dark', e.matches)
    apply(mq)
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  if (authLoading || wsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-primary-500 flex items-center justify-center shadow-lg">
            <span className="text-white text-2xl font-bold">M</span>
          </div>
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
          <Route path="home" element={<HomeScreen />} />
          <Route path="projects" element={<ProjectsScreen />} />
          <Route path="projects/:projectId" element={<ProjectDetail />} />
          <Route path="projects/task/:taskId" element={<TaskDetail />} />
          <Route path="chat" element={<ChatScreen />} />
          <Route path="calendar" element={<CalendarScreen />} />
          <Route path="archive" element={<ArchiveScreen />} />
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
