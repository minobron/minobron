import { useState, useEffect } from 'react'
import { collection, onSnapshot, addDoc, serverTimestamp, orderBy, query } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

const PROJECT_COLORS = [
  { id: 'indigo', bg: 'bg-indigo-100 dark:bg-indigo-900', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-400' },
  { id: 'rose',   bg: 'bg-rose-100 dark:bg-rose-900',     text: 'text-rose-700 dark:text-rose-300',     dot: 'bg-rose-400' },
  { id: 'emerald',bg: 'bg-emerald-100 dark:bg-emerald-900',text:'text-emerald-700 dark:text-emerald-300',dot: 'bg-emerald-400' },
  { id: 'amber',  bg: 'bg-amber-100 dark:bg-amber-900',   text: 'text-amber-700 dark:text-amber-300',   dot: 'bg-amber-400' },
  { id: 'sky',    bg: 'bg-sky-100 dark:bg-sky-900',       text: 'text-sky-700 dark:text-sky-300',       dot: 'bg-sky-400' },
  { id: 'violet', bg: 'bg-violet-100 dark:bg-violet-900', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-400' },
  { id: 'pink',   bg: 'bg-pink-100 dark:bg-pink-900',     text: 'text-pink-700 dark:text-pink-300',     dot: 'bg-pink-400' },
  { id: 'teal',   bg: 'bg-teal-100 dark:bg-teal-900',     text: 'text-teal-700 dark:text-teal-300',     dot: 'bg-teal-400' },
]

const EMOJIS = ['📋','💡','🤝','📦','💰','📸','✉️','🎯','📣','🗂️','🔧','⭐']

export default function ProjectsScreen() {
  const { activeWorkspace } = useWorkspace()
  const { user }            = useAuth()
  const navigate            = useNavigate()
  const [projects, setProjects] = useState([])
  const [showNew, setShowNew]   = useState(false)
  const [newName, setNewName]   = useState('')
  const [newColor, setNewColor] = useState(PROJECT_COLORS[0])
  const [newEmoji, setNewEmoji] = useState('📋')
  const wsId = activeWorkspace?.id

  useEffect(() => {
    if (!wsId) return
    const q = query(collection(db, `workspaces/${wsId}/projects`), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [wsId])

  const createProject = async () => {
    if (!newName.trim() || !wsId) return
    await addDoc(collection(db, `workspaces/${wsId}/projects`), {
      name: newName.trim(), color: newColor.id, emoji: newEmoji,
      createdBy: user.uid, createdAt: serverTimestamp(), taskCount: 0
    })
    setNewName(''); setShowNew(false)
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="grid grid-cols-2 gap-3">
        {projects.map((p, i) => {
          const c = PROJECT_COLORS.find(x => x.id === p.color) || PROJECT_COLORS[0]
          return (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => navigate(`/projects/${p.id}`)}
              className="flex flex-col gap-3 p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm text-left"
            >
              <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center text-xl`}>
                {p.emoji}
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm leading-snug">{p.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{p.taskCount || 0} task</p>
              </div>
            </motion.button>
          )
        })}

        {/* Nuovo progetto */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => setShowNew(true)}
          className="flex flex-col items-center justify-center gap-2 p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-xs font-medium">Nuovo progetto</span>
        </motion.button>
      </div>

      {/* Modal nuovo progetto */}
      <AnimatePresence>
        {showNew && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end"
            onClick={e => e.target === e.currentTarget && setShowNew(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full bg-white dark:bg-gray-900 rounded-t-3xl p-6 pb-10 max-w-lg mx-auto"
            >
              <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-6" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Nuovo progetto</h3>

              {/* Emoji */}
              <div className="flex gap-2 flex-wrap mb-4">
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => setNewEmoji(e)}
                    className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all ${newEmoji === e ? 'bg-primary-100 dark:bg-primary-900 ring-2 ring-primary-400' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    {e}
                  </button>
                ))}
              </div>

              {/* Colore */}
              <div className="flex gap-2 mb-4">
                {PROJECT_COLORS.map(c => (
                  <button key={c.id} onClick={() => setNewColor(c)}
                    className={`w-7 h-7 rounded-full ${c.dot} transition-transform ${newColor.id === c.id ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : ''}`} />
                ))}
              </div>

              {/* Nome */}
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createProject()}
                placeholder="Nome del progetto"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 mb-4"
              />

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={createProject}
                disabled={!newName.trim()}
                className="w-full py-3 bg-primary-500 text-white font-semibold rounded-xl disabled:opacity-40"
              >
                Crea progetto
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
