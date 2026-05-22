import { useState, useEffect } from 'react'
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, getDocs, serverTimestamp, orderBy, query, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useLongPress } from '../../hooks/useLongPress'
import ConfirmDialog from '../shared/ConfirmDialog'

const EMOJIS = ['📋','💡','🤝','📦','💰','📸','✉️','🎯','📣','🗂️','🔧','⭐','🚀','💎','🌟','🎨','📝','🔑','💼','🌈','⚡','🎭','🏆','💬','📊','🛒','🧩','🔥','💫','🎪']
const PRESET_COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#64748b']

export default function ProjectsScreen() {
  const { activeWorkspace, isAdmin } = useWorkspace()
  const { user }            = useAuth()
  const navigate            = useNavigate()
  const [projects, setProjects]   = useState([])
  const [loaded, setLoaded]       = useState(false)
  const [showNew, setShowNew]     = useState(false)
  const [showEdit, setShowEdit]   = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null) // project to delete
  const [newName, setNewName]     = useState('')
  const [newColor, setNewColor]   = useState('#6366f1')
  const [newEmoji, setNewEmoji]   = useState('📋')
  const [customEmoji, setCustomEmoji] = useState('')
  const [search, setSearch]       = useState('')
  const wsId = activeWorkspace?.id

  useEffect(() => {
    if (!wsId) return
    const q = query(collection(db, `workspaces/${wsId}/projects`), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoaded(true)
    })
  }, [wsId])

  const createProject = async () => {
    if (!newName.trim() || !wsId) return
    const emoji = customEmoji.trim() || newEmoji
    await addDoc(collection(db, `workspaces/${wsId}/projects`), {
      name: newName.trim(), color: newColor, emoji,
      createdBy: user.uid, createdAt: serverTimestamp(), taskCount: 0
    })
    resetForm(); setShowNew(false)
  }

  const updateProject = async () => {
    if (!showEdit || !newName.trim()) return
    const emoji = customEmoji.trim() || newEmoji
    await updateDoc(doc(db, `workspaces/${wsId}/projects/${showEdit.id}`), { name: newName.trim(), color: newColor, emoji })
    resetForm(); setShowEdit(null)
  }

  const deleteProject = async (id) => {
    // Cancella prima tutti i task del progetto
    const tasksSnap = await getDocs(
      query(collection(db, `workspaces/${wsId}/tasks`), where('projectId', '==', id))
    )
    await Promise.all(tasksSnap.docs.map(d => deleteDoc(doc(db, `workspaces/${wsId}/tasks/${d.id}`))))
    // Poi cancella il progetto
    await deleteDoc(doc(db, `workspaces/${wsId}/projects/${id}`))
    setContextMenu(null)
    setConfirmDelete(null)
  }

  // Può eliminare un progetto: il creatore o l'admin
  const canDeleteProject = (project) =>
    isAdmin || project.createdBy === user?.uid

  const openEdit = (project) => {
    setNewName(project.name)
    setNewColor(project.color?.startsWith('#') ? project.color : '#6366f1')
    setNewEmoji(project.emoji || '📋')
    setCustomEmoji('')
    setShowEdit(project)
    setContextMenu(null)
  }

  const resetForm = () => { setNewName(''); setNewColor('#6366f1'); setNewEmoji('📋'); setCustomEmoji('') }

  if (!loaded) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const filtered = projects.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Barra di ricerca */}
      {projects.length > 0 && (
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cerca progetto…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={{ background: 'var(--c-input)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <span className="text-5xl">📋</span>
          <p className="text-gray-500 text-sm text-center">Nessun progetto ancora.<br/>Creane uno per iniziare.</p>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => { resetForm(); setShowNew(true) }}
            className="px-6 py-2.5 bg-primary-600 text-white font-semibold rounded-xl text-sm">
            + Nuovo progetto
          </motion.button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.length === 0 && search ? (
            <div className="col-span-2 text-center py-10 text-sm text-gray-600">
              Nessun progetto trovato per "{search}"
            </div>
          ) : filtered.map((p, i) => (
            <ProjectCard key={p.id} project={p} i={i}
              onClick={() => navigate(`/projects/${p.id}`)}
              onLongPress={() => setContextMenu(p)} />
          ))}
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => { resetForm(); setShowNew(true) }}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl min-h-[120px]"
            style={{ border: '2px dashed rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
            <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs font-medium text-gray-600">Nuovo progetto</span>
          </motion.button>
        </div>
      )}

      <AnimatePresence>
        {contextMenu && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setContextMenu(null)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-lg mx-auto rounded-t-3xl overflow-hidden"
              style={{ background: 'var(--c-surface2)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-2xl">{contextMenu.emoji}</span>
                <p className="font-bold text-white">{contextMenu.name}</p>
              </div>
              {[
                { label: '✏️  Modifica', action: () => openEdit(contextMenu), show: true },
                { label: '🗑️  Elimina',  action: () => { setConfirmDelete(contextMenu); setContextMenu(null) }, danger: true, show: canDeleteProject(contextMenu) },
              ].filter(i => i.show).map(item => (
                <button key={item.label} onClick={item.action}
                  className={`w-full text-left px-5 py-4 text-sm font-medium ${item.danger ? 'text-rose-400' : 'text-gray-200'}`}>
                  {item.label}
                </button>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dialogo conferma elimina progetto */}
      <ConfirmDialog
        open={!!confirmDelete}
        title={`Eliminare "${confirmDelete?.name}"?`}
        message="Saranno eliminati anche tutti i task al suo interno. L'azione non può essere annullata."
        confirmLabel="Elimina progetto"
        onConfirm={() => deleteProject(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />

      <AnimatePresence>
        {(showNew || showEdit) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={e => e.target === e.currentTarget && (showNew ? setShowNew(false) : setShowEdit(null))}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-lg mx-auto rounded-t-3xl p-6 space-y-4"
              style={{ background: 'var(--c-surface2)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))', maxHeight: '90vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 rounded-full mx-auto" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <h3 className="text-base font-bold text-white">{showNew ? 'Nuovo progetto' : 'Modifica progetto'}</h3>

              <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (showNew ? createProject() : updateProject())}
                placeholder="Nome del progetto"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                style={{ background: 'var(--c-input)', border: '1px solid var(--c-border)' }} />

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Colore</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => setNewColor(c)}
                      className="w-8 h-8 rounded-full transition-transform active:scale-95"
                      style={{ backgroundColor: c, outline: newColor === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }} />
                  ))}
                  <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
                    className="w-8 h-8 rounded-full cursor-pointer border-0" />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Icona</p>
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => { setNewEmoji(e); setCustomEmoji('') }}
                      className="w-9 h-9 rounded-xl text-lg flex items-center justify-center"
                      style={{ background: newEmoji === e && !customEmoji ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)', outline: newEmoji === e && !customEmoji ? '2px solid #6366f1' : 'none' }}>
                      {e}
                    </button>
                  ))}
                </div>
                <input value={customEmoji} onChange={e => setCustomEmoji(e.target.value)}
                  placeholder="Oppure digita qualsiasi emoji…"
                  className="w-full px-3 py-2 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ background: 'var(--c-input)', border: '1px solid var(--c-border)' }} />
              </div>

              <motion.button whileTap={{ scale: 0.97 }}
                onClick={showNew ? createProject : updateProject}
                disabled={!newName.trim()}
                className="w-full py-3 bg-primary-600 text-white font-semibold rounded-xl text-sm disabled:opacity-40">
                {showNew ? '✓ Crea progetto' : '✓ Salva modifiche'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ProjectCard({ project, i, onClick, onLongPress }) {
  const lp    = useLongPress(onLongPress, onClick)
  const color = project.color?.startsWith('#') ? project.color : '#6366f1'
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: i * 0.05 }} whileTap={{ scale: 0.96 }}
      className="flex flex-col gap-3 p-4 rounded-2xl text-left select-none"
      style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
      {...lp}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
        style={{ backgroundColor: color + '22' }}>
        {project.emoji}
      </div>
      <div>
        <p className="font-semibold text-white text-sm leading-snug">{project.name}</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <p className="text-xs text-gray-600">{project.taskCount || 0} task</p>
        </div>
      </div>
    </motion.button>
  )
}
