import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, onSnapshot, addDoc, doc, getDoc, updateDoc, deleteDoc, serverTimestamp, query, where, increment } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { useLongPress } from '../../hooks/useLongPress'

const PRIORITY = {
  high:   { label: 'Alta',   dot: 'bg-rose-500',    badge: 'bg-rose-500/15 text-rose-400' },
  medium: { label: 'Media',  dot: 'bg-amber-400',   badge: 'bg-amber-400/15 text-amber-400' },
  low:    { label: 'Bassa',  dot: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-400' },
}

export default function ProjectDetail() {
  const { projectId } = useParams()
  const navigate      = useNavigate()
  const { activeWorkspace, members } = useWorkspace()
  const { user }      = useAuth()
  const wsId          = activeWorkspace?.id

  const [project, setProject]         = useState(null)
  const [tasks, setTasks]             = useState([])
  const [showNew, setShowNew]         = useState(false)
  const [newTitle, setNewTitle]       = useState('')
  const [newPriority, setNewPriority] = useState('medium')
  const [newAssignees, setNewAssignees] = useState([])
  const [newDue, setNewDue]           = useState('')
  const [contextMenu, setContextMenu] = useState(null)
  const [showDone, setShowDone]       = useState(false)

  useEffect(() => {
    if (!wsId || !projectId) return
    getDoc(doc(db, `workspaces/${wsId}/projects/${projectId}`))
      .then(d => d.exists() && setProject({ id: d.id, ...d.data() }))
    const q = query(collection(db, `workspaces/${wsId}/tasks`), where('projectId', '==', projectId))
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      setTasks(list)
    })
  }, [wsId, projectId])

  useEffect(() => {
    if (user && showNew) setNewAssignees([user.uid])
  }, [showNew, user])

  const createTask = async () => {
    if (!newTitle.trim()) return
    const assignees = newAssignees.length > 0 ? newAssignees : [user.uid]
    await addDoc(collection(db, `workspaces/${wsId}/tasks`), {
      title: newTitle.trim(), projectId, priority: newPriority,
      assignees, status: 'todo',
      dueDate: newDue ? new Date(newDue) : null,
      createdBy: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    })
    // Aggiorna contatore task sul progetto
    await updateDoc(doc(db, `workspaces/${wsId}/projects/${projectId}`), { taskCount: increment(1) })
    await addDoc(collection(db, `workspaces/${wsId}/activity`), {
      userId: user.uid,
      text: `${user.name} ha creato il task "${newTitle.trim()}"`,
      createdAt: serverTimestamp()
    })
    setNewTitle(''); setNewAssignees([]); setNewDue('')
    setShowNew(false)
  }

  const markDone = async (task) => {
    const next = task.status === 'done' ? 'todo' : 'done'
    await updateDoc(doc(db, `workspaces/${wsId}/tasks/${task.id}`), { status: next, updatedAt: serverTimestamp() })
  }

  const deleteTask = async (taskId) => {
    await deleteDoc(doc(db, `workspaces/${wsId}/tasks/${taskId}`))
    await updateDoc(doc(db, `workspaces/${wsId}/projects/${projectId}`), { taskCount: increment(-1) })
    setContextMenu(null)
  }

  const getMember = uid => members.find(m => m.id === uid)

  if (!project) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const projectColor = project.color?.startsWith('#') ? project.color : '#6366f1'
  const todoTasks = tasks.filter(t => t.status !== 'done')
  const doneTasks = tasks.filter(t => t.status === 'done')

  return (
    <div className="max-w-lg mx-auto px-4 pb-6">
      {/* Header progetto */}
      <div className="py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
          style={{ backgroundColor: projectColor + '22' }}>
          {project.emoji}
        </div>
        <div>
          <h2 className="text-lg font-bold text-white leading-tight">{project.name}</h2>
          <p className="text-xs text-gray-600">{tasks.length} task totali · {doneTasks.length} completati</p>
        </div>
      </div>

      {/* Pulsante nuovo task */}
      <motion.button whileTap={{ scale: 0.97 }}
        onClick={() => { setNewTitle(''); setNewPriority('medium'); setNewDue(''); setShowNew(true) }}
        className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-primary-400 mb-4"
        style={{ background: 'rgba(99,102,241,0.08)', border: '1px dashed rgba(99,102,241,0.3)' }}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Aggiungi task
      </motion.button>

      {/* Da fare */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-gray-500" />
          <span className="text-xs font-bold uppercase tracking-wide text-gray-400">Da fare</span>
          <span className="text-xs text-gray-600 font-medium">{todoTasks.length}</span>
        </div>
        <div className="space-y-2">
          {todoTasks.length === 0 ? (
            <div className="flex items-center justify-center py-6 rounded-xl"
              style={{ border: '1px dashed rgba(255,255,255,0.07)' }}>
              <p className="text-xs text-gray-700">Nessun task in sospeso 🎉</p>
            </div>
          ) : todoTasks.map((task, i) => (
            <TaskCard key={task.id} task={task} i={i}
              getMember={getMember}
              onOpen={() => navigate(`/projects/task/${task.id}`)}
              onLongPress={() => setContextMenu(task)}
              onMarkDone={() => markDone(task)}
            />
          ))}
        </div>
      </div>

      {/* Completati — collassabile */}
      {doneTasks.length > 0 && (
        <div>
          <button
            onClick={() => setShowDone(s => !s)}
            className="flex items-center gap-2 mb-2 w-full text-left">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-wide text-emerald-400">Completati</span>
            <span className="text-xs text-gray-600 font-medium">{doneTasks.length}</span>
            <svg className={`w-3.5 h-3.5 text-gray-600 ml-auto transition-transform ${showDone ? '' : '-rotate-90'}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <AnimatePresence>
            {showDone && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden space-y-2">
                {doneTasks.map((task, i) => (
                  <TaskCard key={task.id} task={task} i={i}
                    getMember={getMember}
                    onOpen={() => navigate(`/projects/task/${task.id}`)}
                    onLongPress={() => setContextMenu(task)}
                    onMarkDone={() => markDone(task)}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Context menu */}
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
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
                <p className="font-semibold text-white text-sm truncate">{contextMenu.title}</p>
              </div>
              {[
                { label: contextMenu.status === 'done' ? '↩️  Riporta a Da fare' : '✅  Segna Completato',
                  action: () => { markDone(contextMenu); setContextMenu(null) } },
                { label: '✏️  Apri e modifica', action: () => { navigate(`/projects/task/${contextMenu.id}`); setContextMenu(null) } },
                { label: '🗑️  Elimina task', action: () => deleteTask(contextMenu.id), danger: true },
              ].map(item => (
                <button key={item.label} onClick={item.action}
                  className={`w-full text-left px-5 py-4 text-sm font-medium ${item.danger ? 'text-rose-400' : 'text-gray-200'}`}>
                  {item.label}
                </button>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal nuovo task */}
      <AnimatePresence>
        {showNew && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={e => e.target === e.currentTarget && setShowNew(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-lg mx-auto rounded-t-3xl p-6 space-y-4"
              style={{ background: 'var(--c-surface2)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))', maxHeight: '92dvh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 rounded-full mx-auto" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <h3 className="text-base font-bold text-white">Nuovo task</h3>

              <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createTask()}
                placeholder="Titolo del task"
                autoComplete="off" autoCorrect="on" autoCapitalize="sentences"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                style={{ background: 'var(--c-input)', border: '1px solid var(--c-border)' }} />

              {/* Priorità */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Priorità</p>
                <div className="flex gap-2">
                  {Object.entries(PRIORITY).map(([k, v]) => (
                    <button key={k} onClick={() => setNewPriority(k)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${newPriority === k ? v.badge : 'text-gray-500'}`}
                      style={{ background: newPriority === k ? undefined : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assegna a */}
              {members.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Assegna a</p>
                  <div className="flex gap-2 flex-wrap">
                    {members.map(m => (
                      <button key={m.id}
                        onClick={() => setNewAssignees(a => a.includes(m.id) ? a.filter(x => x !== m.id) : [...a, m.id])}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                        style={{
                          background: newAssignees.includes(m.id) ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                          border: newAssignees.includes(m.id) ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.08)',
                          color: newAssignees.includes(m.id) ? '#a5b4fc' : '#6b7280'
                        }}>
                        {m.photoURL
                          ? <img src={m.photoURL} className="w-4 h-4 rounded-full" alt="" />
                          : <span className="w-4 h-4 rounded-full bg-primary-600 flex items-center justify-center text-[10px] text-white">{m.name?.charAt(0)}</span>
                        }
                        {m.name?.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Scadenza */}
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Scadenza (opzionale)</p>
                <input type="date" value={newDue} onChange={e => setNewDue(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ background: 'var(--c-input)', border: '1px solid var(--c-border)' }} />
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={createTask} disabled={!newTitle.trim()}
                className="w-full py-3 bg-primary-600 text-white font-semibold rounded-xl text-sm disabled:opacity-40">
                ✓ Crea task
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TaskCard({ task, i, getMember, onOpen, onLongPress, onMarkDone }) {
  const p  = PRIORITY[task.priority] || PRIORITY.medium
  const lp = useLongPress(onLongPress, onOpen)
  const isDone = task.status === 'done'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04 }}
      className="rounded-xl p-3 select-none"
      style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
      {...lp}>
      {/* Priorità + titolo + check */}
      <div className="flex items-start gap-2">
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${p.dot}`} />
        <p className={`text-sm font-medium leading-snug flex-1 ${isDone ? 'line-through text-gray-600' : 'text-gray-200'}`}>
          {task.title}
        </p>
        {/* Checkbox completamento */}
        <button
          onClick={e => { e.stopPropagation(); onMarkDone() }}
          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all ${
            isDone ? 'bg-emerald-500 border-emerald-500' : 'border-gray-700 hover:border-emerald-500'
          }`}>
          {isDone && (
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      </div>

      {/* Footer: data + assegnatari */}
      <div className="flex items-center justify-between mt-2 pl-3.5">
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <span className="text-[10px] text-gray-600">
              📅 {format(task.dueDate.toDate?.() || new Date(task.dueDate), 'd MMM', { locale: it })}
            </span>
          )}
        </div>
        <div className="flex -space-x-1.5">
          {(task.assignees || []).slice(0, 3).map(uid => {
            const m = getMember(uid)
            return m?.photoURL
              ? <img key={uid} src={m.photoURL} className="w-5 h-5 rounded-full border border-black" alt="" />
              : <div key={uid} className="w-5 h-5 rounded-full border border-black bg-primary-600 flex items-center justify-center text-[10px] font-bold text-white">
                  {m?.name?.charAt(0) || '?'}
                </div>
          })}
        </div>
      </div>
    </motion.div>
  )
}
