import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, onSnapshot, addDoc, doc, getDoc, updateDoc, serverTimestamp, orderBy, query, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

const PRIORITY = {
  high:   { label: 'Alta',   bg: 'bg-rose-100 dark:bg-rose-900/40',   text: 'text-rose-600 dark:text-rose-400',   dot: 'bg-rose-400' },
  medium: { label: 'Media',  bg: 'bg-amber-100 dark:bg-amber-900/40',  text: 'text-amber-600 dark:text-amber-400',  dot: 'bg-amber-400' },
  low:    { label: 'Bassa',  bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-400' },
}
const STATUS = {
  todo:       { label: 'Da fare',   bg: 'bg-gray-100 dark:bg-gray-800',   text: 'text-gray-600 dark:text-gray-300' },
  inprogress: { label: 'In corso',  bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-600 dark:text-blue-400' },
  done:       { label: 'Fatto',     bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-600 dark:text-emerald-400' },
}

export default function ProjectDetail() {
  const { projectId }      = useParams()
  const navigate           = useNavigate()
  const { activeWorkspace, members } = useWorkspace()
  const { user }           = useAuth()
  const wsId               = activeWorkspace?.id
  const [project, setProject] = useState(null)
  const [tasks, setTasks]     = useState([])
  const [filter, setFilter]   = useState('all')
  const [view, setView]       = useState('list') // list | kanban
  const [showNew, setShowNew] = useState(false)
  const [newTitle, setNewTitle]         = useState('')
  const [newPriority, setNewPriority]   = useState('medium')
  const [newAssignees, setNewAssignees] = useState([])
  const [newDue, setNewDue]             = useState('')

  useEffect(() => {
    if (!wsId || !projectId) return
    getDoc(doc(db, `workspaces/${wsId}/projects/${projectId}`))
      .then(d => d.exists() && setProject({ id: d.id, ...d.data() }))
    const q = query(collection(db, `workspaces/${wsId}/tasks`), where('projectId', '==', projectId), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [wsId, projectId])

  const createTask = async () => {
    if (!newTitle.trim()) return
    await addDoc(collection(db, `workspaces/${wsId}/tasks`), {
      title: newTitle.trim(), projectId, priority: newPriority,
      assignees: newAssignees, status: 'todo',
      dueDate: newDue ? new Date(newDue) : null,
      createdBy: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    })
    // activity log
    await addDoc(collection(db, `workspaces/${wsId}/activity`), {
      userId: user.uid, text: `${user.name} ha creato il task "${newTitle.trim()}"`,
      createdAt: serverTimestamp()
    })
    setNewTitle(''); setNewAssignees([]); setNewDue(''); setShowNew(false)
  }

  const toggleStatus = async (task) => {
    const next = task.status === 'done' ? 'todo' : task.status === 'todo' ? 'inprogress' : 'done'
    await updateDoc(doc(db, `workspaces/${wsId}/tasks/${task.id}`), { status: next, updatedAt: serverTimestamp() })
  }

  const filteredTasks = tasks.filter(t => {
    if (filter === 'mine')   return t.assignees?.includes(user.uid)
    if (filter === 'todo')   return t.status !== 'done'
    if (filter === 'done')   return t.status === 'done'
    return true
  })

  const getMember = uid => members.find(m => m.id === uid)

  if (!project) return <div className="flex items-center justify-center h-40 text-gray-400">Caricamento...</div>

  return (
    <div className="max-w-lg mx-auto">
      {/* Header progetto */}
      <div className="px-4 pt-2 pb-3 flex items-center gap-3">
        <span className="text-2xl">{project.emoji}</span>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{project.name}</h2>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setView(v => v === 'list' ? 'kanban' : 'list')}
            className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            {view === 'list' ? <KanbanIcon /> : <ListIcon />}
          </button>
        </div>
      </div>

      {/* Filtri */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
        {[['all','Tutti'],['mine','Miei'],['todo','Da fare'],['done','Fatti']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${filter === v ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="px-4 space-y-2 pb-4">
        {filteredTasks.length === 0 && (
          <p className="text-center text-gray-400 dark:text-gray-500 py-8 text-sm">Nessun task qui</p>
        )}
        {filteredTasks.map((task, i) => {
          const p = PRIORITY[task.priority] || PRIORITY.medium
          const s = STATUS[task.status] || STATUS.todo
          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm"
            >
              {/* Stato checkbox */}
              <button onClick={() => toggleStatus(task)} className="flex-shrink-0">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${task.status === 'done' ? 'border-emerald-400 bg-emerald-400' : 'border-gray-300 dark:border-gray-600'}`}>
                  {task.status === 'done' && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
              </button>

              {/* Titolo e dettagli */}
              <button className="flex-1 text-left" onClick={() => navigate(`/projects/task/${task.id}`)}>
                <p className={`text-sm font-medium transition-colors ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>{task.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${p.bg} ${p.text}`}>{p.label}</span>
                  {task.dueDate && <span className="text-xs text-gray-400 dark:text-gray-500">{format(task.dueDate.toDate?.() || new Date(task.dueDate), 'd MMM', { locale: it })}</span>}
                </div>
              </button>

              {/* Assignee avatars */}
              <div className="flex -space-x-1.5 flex-shrink-0">
                {(task.assignees || []).slice(0, 3).map(uid => {
                  const m = getMember(uid)
                  return m?.photoURL
                    ? <img key={uid} src={m.photoURL} className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800" alt="" />
                    : <div key={uid} className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 bg-primary-200 dark:bg-primary-800 flex items-center justify-center text-xs font-bold text-primary-700 dark:text-primary-300">{m?.name?.charAt(0)}</div>
                })}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* FAB nuovo task */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowNew(true)}
        className="fixed bottom-24 right-4 w-14 h-14 bg-primary-500 rounded-full shadow-lg shadow-primary-200 dark:shadow-primary-900 flex items-center justify-center text-white z-30"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </motion.button>

      {/* Modal nuovo task */}
      <AnimatePresence>
        {showNew && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end"
            onClick={e => e.target === e.currentTarget && setShowNew(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full bg-white dark:bg-gray-900 rounded-t-3xl p-6 pb-10 max-w-lg mx-auto space-y-4"
            >
              <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nuovo task</h3>

              <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createTask()}
                placeholder="Titolo del task"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400" />

              {/* Priorità */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Priorità</p>
                <div className="flex gap-2">
                  {Object.entries(PRIORITY).map(([k, v]) => (
                    <button key={k} onClick={() => setNewPriority(k)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${newPriority === k ? `${v.bg} ${v.text} ring-2 ring-offset-1 ring-current` : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assegnati */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Assegna a</p>
                <div className="flex gap-2 flex-wrap">
                  {members.map(m => (
                    <button key={m.id} onClick={() => setNewAssignees(a => a.includes(m.id) ? a.filter(x => x !== m.id) : [...a, m.id])}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${newAssignees.includes(m.id) ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`}>
                      {m.photoURL ? <img src={m.photoURL} className="w-4 h-4 rounded-full" alt="" /> : <span className="w-4 h-4 rounded-full bg-primary-200 dark:bg-primary-800 flex items-center justify-center text-xs">{m.name?.charAt(0)}</span>}
                      {m.name?.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scadenza */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Scadenza</p>
                <input type="date" value={newDue} onChange={e => setNewDue(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={createTask} disabled={!newTitle.trim()}
                className="w-full py-3 bg-primary-500 text-white font-semibold rounded-xl disabled:opacity-40">
                Crea task
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ListIcon() { return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg> }
function KanbanIcon() { return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 0a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 01-2 2h-2a2 2 0 01-2-2" /></svg> }
