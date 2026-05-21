import { motion } from 'framer-motion'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'

const WORKSPACE_COLORS = {
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  rose:   'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
  emerald:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  amber:  'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
}

export default function WorkspaceSelector({ onSelect }) {
  const { workspaces } = useWorkspace()
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col p-6">
      <div className="flex items-center justify-between mb-8 mt-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Ciao,</p>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{user?.name?.split(' ')[0]}</h2>
        </div>
        <img src={user?.photoURL} alt="" className="w-10 h-10 rounded-full" />
      </div>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">I tuoi workspace</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">Scegli in quale entrare</p>

      <div className="flex flex-col gap-3">
        {workspaces.map((ws, i) => (
          <motion.button
            key={ws.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(ws)}
            className="flex items-center gap-4 p-5 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 text-left"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold ${WORKSPACE_COLORS[ws.color] || WORKSPACE_COLORS.indigo}`}>
              {ws.emoji || ws.name?.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-900 dark:text-white">{ws.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{ws.memberIds?.length || 0} membri</p>
            </div>
            <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </motion.button>
        ))}

        {workspaces.length === 0 && (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <p className="text-4xl mb-3">👋</p>
            <p className="font-medium">Nessun workspace trovato.</p>
            <p className="text-sm mt-1">Chiedi all'admin di aggiungerti.</p>
          </div>
        )}
      </div>

      <button onClick={logout} className="mt-auto pt-8 text-sm text-gray-400 dark:text-gray-500 text-center hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
        Esci dall'account
      </button>
    </div>
  )
}
