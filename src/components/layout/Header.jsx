import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'

const ROUTE_TITLES = {
  '/home':     'Home',
  '/projects': 'Progetti',
  '/chat':     'Chat',
  '/calendar': 'Calendario',
  '/archive':  'Archivio',
}

export default function Header({ title, showBack, action }) {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { activeWorkspace, workspaces, switchWorkspace } = useWorkspace()
  const { user }   = useAuth()
  const pageTitle  = title || ROUTE_TITLES[location.pathname] || 'Minobron'
  const isHome     = location.pathname === '/home'

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 pt-safe">
      <div className="flex items-center h-14 px-4 gap-3 max-w-lg mx-auto">
        {showBack ? (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </motion.button>
        ) : isHome && workspaces.length > 1 ? (
          <WorkspaceSwitcher workspaces={workspaces} active={activeWorkspace} onChange={switchWorkspace} />
        ) : null}

        <h1 className="flex-1 text-lg font-bold text-gray-900 dark:text-white truncate">
          {pageTitle}
        </h1>

        {action && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={action.onClick}
            className="text-primary-500 font-semibold text-sm"
          >
            {action.label}
          </motion.button>
        )}

        {isHome && (
          <img src={user?.photoURL} alt="" className="w-8 h-8 rounded-full" />
        )}
      </div>
    </header>
  )
}

function WorkspaceSwitcher({ workspaces, active, onChange }) {
  return (
    <select
      value={active?.id || ''}
      onChange={e => onChange(workspaces.find(w => w.id === e.target.value))}
      className="text-sm font-semibold text-primary-600 dark:text-primary-400 bg-transparent border-none outline-none cursor-pointer"
    >
      {workspaces.map(ws => (
        <option key={ws.id} value={ws.id}>{ws.name}</option>
      ))}
    </select>
  )
}
