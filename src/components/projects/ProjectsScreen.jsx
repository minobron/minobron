import { useState, useEffect } from 'react'
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, getDocs, serverTimestamp, orderBy, query, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion'
import { useLongPress } from '../../hooks/useLongPress'
import ConfirmDialog from '../shared/ConfirmDialog'

const EMOJIS = ['📋','💡','🤝','📦','💰','📸','✉️','🎯','📣','🗂️','🔧','⭐','🚀','💎','🌟','🎨','📝','🔑','💼','🌈','⚡','🎭','🏆','💬','📊','🛒','🧩','🔥','💫','🎪']
const PRESET_COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#64748b']

// Merge Firestore list with localStorage order (new items appended at end)
function applyLocalOrder(items, storedIds) {
  if (!storedIds?.length) return items
  const map = Object.fromEntries(items.map(x => [x.id, x]))
  const ordered = storedIds.filter(id => map[id]).map(id => map[id])
  const rest = items.filter(x => !storedIds.includes(x.id))
  return [...ordered, ...rest]
}

export default function ProjectsScreen() {
  const { activeWorkspace, isAdmin } = useWorkspace()
  const { user }            = useAuth()
  const navigate            = useNavigate()
  const [projects, setProjects]   = useState([])
  const [loaded, setLoaded]       = useState(false)
  const [showNew, setShowNew]     = useState(false)
  const [showEdit, setShowEdit]   = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [newName, setNewName]     = useState('')
  const [newColor, setNewColor]   = useState('#6366f1')
  const [newEmoji, setNewEmoji]   = useState('📋')
  const [customEmoji, setCustomEmoji] = useState('')
  const [search, setSearch]       = useState('')

  // Task search results (when search >= 2 chars)
  const [taskResults, setTaskResults] = useState([])

  // Reorder sheet
  const [showReorderSheet, setShowReorderSheet] = useState(false)
  const [reorderProjects, setReorderProjects]   = useState([])

  const wsId = activeWorkspace?.id
  const projOrderKey = user && wsId ? `mino_proj_order_${user.uid}_${wsId}` : null

  // Load projects from Firestore and apply saved order
  useEffect(() => {
    if (!wsId) return
    const q = query(collection(db, `workspaces/${wsId}/projects`), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => {
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      const storedIds = projOrderKey ? JSON.parse(localStorage.getItem(projOrderKey) || 'null') : null
      setProjects(applyLocalOrder(raw, storedIds))
      setLoaded(true)
    })
  }, [wsId, projOrderKey])

  // Task search — fires getDocs when search >= 2 chars
  useEffect(() => {
    if (!wsId || search.trim().length < 2) {
      setTaskResults([])
      return
    }
    const term = search.trim().toLowerCase()
    getDocs(collection(db, `workspaces/${wsId}/tasks`)).then(snap => {
      const matched = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(t => t.title?.toLowerCase().includes(term))
      setTaskResults(matched)
    })
  }, [wsId, search])

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
    const tasksSnap = await getDocs(
      query(collection(db, `workspaces/${wsId}/tasks`), where('projectId', '==', id))
    )
    await Promise.all(tasksSnap.docs.map(d => deleteDoc(doc(db, `workspaces/${wsId}/tasks/${d.id}`))))
    await deleteDoc(doc(db, `workspaces/${wsId}/projects/${id}`))
    setContextMenu(null)
    setConfirmDelete(null)
  }

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

  const openReorderSheet = () => {
    setReorderProjects([...projects])
    setShowReorderSheet(true)
  }

  const saveReorderProjects = () => {
    setProjects(reorderProjects)
    if (projOrderKey) {
      localStorage.setItem(projOrderKey, JSON.stringify(reorderProjects.map(p => p.id)))
    }
    setShowReorderSheet(false)
  }

  const getProject = pid => projects.find(p => p.id === pid)

  const isSearching = search.trim().length >= 2
  const filteredProjects = projects.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase())
  )

  if (!loaded) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Barra di ricerca + pulsante riordina */}
      {projects.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cerca progetto o task…"
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
          {/* Pulsante riordina */}
          {!isSearching && (
            <motion.button whileTap={{ scale: 0.93 }} onClick={openReorderSheet}
              className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </motion.button>
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
        <>
          {/* Griglia progetti */}
          <div className="grid grid-cols-2 gap-3">
            {filteredProjects.length === 0 && search && !isSearching ? (
              <div className="col-span-2 text-center py-6 text-sm text-gray-600">
                Nessun progetto trovato per "{search}"
              </div>
            ) : filteredProjects.map((p, i) => (
              <ProjectCard key={p.id} project={p} i={i}
                onClick={() => navigate(`/projects/${p.id}`)}
                onLongPress={() => setContextMenu(p)} />
            ))}
            {!isSearching && (
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => { resetForm(); setShowNew(true) }}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl min-h-[120px]"
                style={{ border: '2px dashed rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}>
                <svg className="w-7 h-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-xs font-medium text-gray-600">Nuovo progetto</span>
              </motion.button>
            )}
          </div>

          {/* Risultati task — visibili solo dopo ricerca */}
          {isSearching && (
            <div className="mt-5">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-2 px-1">
                Task trovati
              </p>
              {taskResults.length === 0 ? (
                <p className="text-sm text-gray-600 px-1">Nessun task trovato per "{search}"</p>
              ) : (
                <div className="space-y-1.5">
                  {taskResults.map(t => {
                    const proj = getProject(t.projectId)
                    const statusColor = t.status === 'done' ? '#4ade80' : t.status === 'in_progress' ? '#fbbf24' : null
                    return (
                      <motion.div key={t.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => navigate(`/projects/task/${t.id}`)}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer"
                        style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate"
                            style={{ color: statusColor || 'var(--c-text)' }}>
                            {t.title}
                          </p>
                          {proj && (
                            <p className="text-xs text-gray-600 mt-0.5 truncate">
                              {proj.emoji} {proj.name}
                            </p>
                          )}
                        </div>
                        <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Sheet riordina progetti */}
      <AnimatePresence>
        {showReorderSheet && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setShowReorderSheet(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-lg mx-auto rounded-t-3xl p-5"
              style={{ background: 'var(--c-surface2)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))', maxHeight: '80vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <p className="text-base font-bold text-white mb-4">Riordina progetti</p>

              <Reorder.Group axis="y" values={reorderProjects} onReorder={setReorderProjects}
                className="space-y-2">
                {reorderProjects.map(proj => (
                  <ReorderProjectItem key={proj.id} project={proj} />
                ))}
              </Reorder.Group>

              <motion.button whileTap={{ scale: 0.97 }} onClick={saveReorderProjects}
                className="w-full mt-5 py-3 bg-primary-600 text-white font-semibold rounded-xl text-sm">
                ✓ Salva ordine
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Context menu progetto */}
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

      {/* Dialogo conferma elimina */}
      <ConfirmDialog
        open={!!confirmDelete}
        title={`Eliminare "${confirmDelete?.name}"?`}
        message="Saranno eliminati anche tutti i task al suo interno. L'azione non può essere annullata."
        confirmLabel="Elimina progetto"
        onConfirm={() => deleteProject(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Sheet nuovo / modifica progetto */}
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

// Componente per drag handle nella sheet di riordino
function ReorderProjectItem({ project }) {
  const controls = useDragControls()
  const color = project.color?.startsWith('#') ? project.color : '#6366f1'
  return (
    <Reorder.Item value={project} dragListener={false} dragControls={controls}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl select-none"
      style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', cursor: 'default' }}>
      {/* Drag handle */}
      <div
        onPointerDown={e => { e.preventDefault(); controls.start(e) }}
        className="touch-none cursor-grab active:cursor-grabbing p-1 -ml-1 text-gray-600">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </div>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0"
        style={{ backgroundColor: color + '22' }}>
        {project.emoji}
      </div>
      <p className="flex-1 text-sm font-semibold text-white truncate">{project.name}</p>
    </Reorder.Item>
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
