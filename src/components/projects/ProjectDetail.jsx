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
import ConfirmDialog from '../shared/ConfirmDialog'
import { sendTaskAssignedEmail } from '../../utils/emailjs'

const PRIORITY = {
  high:   { label: 'Alta',   dot: 'bg-rose-500',    badge: 'bg-rose-500/15 text-rose-400' },
  medium: { label: 'Media',  dot: 'bg-amber-400',   badge: 'bg-amber-400/15 text-amber-400' },
  low:    { label: 'Bassa',  dot: 'bg-emerald-500', badge: 'bg-emerald-500/15 text-emerald-400' },
}
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }

function sortTasks(tasks, sort) {
  return [...tasks].sort((a, b) => {
    if (sort.field === 'dueDate') {
      const aD = a.dueDate ? (a.dueDate.toDate?.() || new Date(a.dueDate)) : null
      const bD = b.dueDate ? (b.dueDate.toDate?.() || new Date(b.dueDate)) : null
      if (!aD && !bD) return 0
      if (!aD) return 1
      if (!bD) return -1
      return sort.dir === 'asc' ? aD - bD : bD - aD
    }
    if (sort.field === 'priority') {
      const aP = PRIORITY_ORDER[a.priority] ?? 1
      const bP = PRIORITY_ORDER[b.priority] ?? 1
      return sort.dir === 'asc' ? aP - bP : bP - aP
    }
    return 0
  })
}

function applyFilters(tasks, filters) {
  return tasks.filter(t => {
    if (filters.priorities.length > 0 && !filters.priorities.includes(t.priority)) return false
    if (filters.statuses.length > 0 && !filters.statuses.includes(t.status)) return false
    if (filters.assignees.length > 0 && !filters.assignees.some(uid => (t.assignees || []).includes(uid))) return false
    return true
  })
}

function toggleMulti(arr, val) {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]
}

export default function ProjectDetail() {
  const { projectId } = useParams()
  const navigate      = useNavigate()
  const { activeWorkspace, members, isAdmin } = useWorkspace()
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
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [showFilterSheet, setShowFilterSheet] = useState(false)

  // Accordion — localStorage per utente+progetto
  const accKey = user ? `mino_acc_${user.uid}_${projectId}` : null
  const [accordion, setAccordion] = useState(() => {
    if (!accKey) return { todo: true, inProgress: true, done: false }
    try { return JSON.parse(localStorage.getItem(accKey)) || { todo: true, inProgress: true, done: false } }
    catch { return { todo: true, inProgress: true, done: false } }
  })
  const setAcc = (key, val) => {
    setAccordion(prev => {
      const next = { ...prev, [key]: val }
      if (accKey) localStorage.setItem(accKey, JSON.stringify(next))
      return next
    })
  }

  // Filtri — localStorage per utente+progetto
  const filterKey = user ? `mino_filters_${user.uid}_${projectId}` : null
  const [filters, setFilters] = useState(() => {
    if (!filterKey) return { priorities: [], statuses: [], assignees: [] }
    try { return JSON.parse(localStorage.getItem(filterKey)) || { priorities: [], statuses: [], assignees: [] } }
    catch { return { priorities: [], statuses: [], assignees: [] } }
  })
  const updateFilters = (f) => {
    setFilters(f)
    if (filterKey) localStorage.setItem(filterKey, JSON.stringify(f))
  }

  // Ordinamento — localStorage per utente+progetto
  const sortKey = user ? `mino_sort_${user.uid}_${projectId}` : null
  const [sort, setSort] = useState(() => {
    if (!sortKey) return { field: 'dueDate', dir: 'asc' }
    try { return JSON.parse(localStorage.getItem(sortKey)) || { field: 'dueDate', dir: 'asc' } }
    catch { return { field: 'dueDate', dir: 'asc' } }
  })
  const updateSort = (s) => {
    setSort(s)
    if (sortKey) localStorage.setItem(sortKey, JSON.stringify(s))
  }

  useEffect(() => {
    if (!wsId || !projectId) return
    getDoc(doc(db, `workspaces/${wsId}/projects/${projectId}`))
      .then(d => d.exists() && setProject({ id: d.id, ...d.data() }))
    const q = query(collection(db, `workspaces/${wsId}/tasks`), where('projectId', '==', projectId))
    return onSnapshot(q, snap => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [wsId, projectId])

  useEffect(() => {
    if (user && showNew) setNewAssignees([user.uid])
  }, [showNew, user])

  const createTask = async () => {
    if (!newTitle.trim()) return
    const assignees = newAssignees.length > 0 ? newAssignees : [user.uid]
    const title = newTitle.trim()
    await addDoc(collection(db, `workspaces/${wsId}/tasks`), {
      title, projectId, priority: newPriority,
      assignees, status: 'todo',
      dueDate: newDue ? new Date(newDue) : null,
      createdBy: user.uid,
      createdByName: user.name || user.email || '',
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    })
    await updateDoc(doc(db, `workspaces/${wsId}/projects/${projectId}`), { taskCount: increment(1) })
    await addDoc(collection(db, `workspaces/${wsId}/activity`), {
      userId: user.uid,
      text: `${user.name} ha creato il task "${title}"`,
      createdAt: serverTimestamp()
    })
    const projectName = project?.name || ''
    assignees.filter(uid => uid !== user.uid).forEach(uid => {
      const member = members.find(m => m.id === uid)
      if (member?.email) {
        sendTaskAssignedEmail({
          toEmail: member.email, toName: member.name || member.email,
          fromName: user.name || user.email, taskTitle: title, projectName,
        })
      }
    })
    setNewTitle(''); setNewAssignees([]); setNewDue('')
    setShowNew(false)
  }

  const cycleStatus = async (task, targetStatus) => {
    await updateDoc(doc(db, `workspaces/${wsId}/tasks/${task.id}`), {
      status: targetStatus, updatedAt: serverTimestamp()
    })
  }

  const deleteTask = async (taskId) => {
    await deleteDoc(doc(db, `workspaces/${wsId}/tasks/${taskId}`))
    await updateDoc(doc(db, `workspaces/${wsId}/projects/${projectId}`), { taskCount: increment(-1) })
    setContextMenu(null); setConfirmDelete(null)
  }

  const canDeleteTask = (task) => isAdmin || task.createdBy === user?.uid
  const getMember = uid => members.find(m => m.id === uid)

  if (!project) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const projectColor = project.color?.startsWith('#') ? project.color : '#6366f1'
  const filtered = applyFilters(tasks, filters)
  const sorted   = sortTasks(filtered, sort)
  const todoTasks       = sorted.filter(t => t.status === 'todo')
  const inProgressTasks = sorted.filter(t => t.status === 'in_progress')
  const doneTasks       = sorted.filter(t => t.status === 'done')
  const activeFilterCount = filters.priorities.length + filters.statuses.length + filters.assignees.length

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

      {/* Toolbar: nuovo task + filtri */}
      <div className="flex gap-2 mb-3">
        <motion.button whileTap={{ scale: 0.97 }}
          onClick={() => { setNewTitle(''); setNewPriority('medium'); setNewDue(''); setShowNew(true) }}
          className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-primary-400"
          style={{ background: 'rgba(99,102,241,0.08)', border: '1px dashed rgba(99,102,241,0.3)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Aggiungi task
        </motion.button>
        <button onClick={() => setShowFilterSheet(true)}
          className="relative flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0"
          style={{
            background: activeFilterCount > 0 ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
            border: activeFilterCount > 0 ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.08)'
          }}>
          <svg className={`w-5 h-5 ${activeFilterCount > 0 ? 'text-primary-400' : 'text-gray-500'}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          {activeFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Sort bar */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => updateSort({ ...sort, field: sort.field === 'dueDate' ? 'priority' : 'dueDate' })}
          className="text-[10px] font-semibold text-primary-400 px-2 py-1 rounded-full"
          style={{ background: 'rgba(99,102,241,0.1)' }}>
          {sort.field === 'dueDate' ? '📅 Scadenza' : '⚡ Priorità'}
        </button>
        <button onClick={() => updateSort({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}
          className="text-[10px] font-semibold text-gray-500 px-2 py-1 rounded-full"
          style={{ background: 'rgba(255,255,255,0.05)' }}>
          {sort.dir === 'asc' ? '↑' : '↓'}
        </button>
        {activeFilterCount > 0 && (
          <button onClick={() => updateFilters({ priorities: [], statuses: [], assignees: [] })}
            className="text-[10px] font-semibold text-rose-400 ml-auto px-2 py-1 rounded-full"
            style={{ background: 'rgba(239,68,68,0.1)' }}>
            × Reset filtri
          </button>
        )}
      </div>

      {/* Da fare */}
      <TaskSection label="Da fare" dotClass="bg-gray-500" textClass="text-gray-400"
        count={todoTasks.length} open={accordion.todo}
        onToggle={() => setAcc('todo', !accordion.todo)}
        emptyText="Nessun task in sospeso 🎉">
        {todoTasks.map((task, i) => (
          <TaskCard key={task.id} task={task} i={i} getMember={getMember}
            onOpen={() => navigate(`/projects/task/${task.id}`)}
            onLongPress={() => setContextMenu(task)}
            onCheckClick={() => cycleStatus(task, 'done')} />
        ))}
      </TaskSection>

      {/* In corso */}
      <TaskSection label="In corso" dotClass="bg-amber-400" textClass="text-amber-400"
        count={inProgressTasks.length} open={accordion.inProgress}
        onToggle={() => setAcc('inProgress', !accordion.inProgress)}
        hideIfEmpty>
        {inProgressTasks.map((task, i) => (
          <TaskCard key={task.id} task={task} i={i} getMember={getMember}
            onOpen={() => navigate(`/projects/task/${task.id}`)}
            onLongPress={() => setContextMenu(task)}
            onCheckClick={() => cycleStatus(task, 'done')} />
        ))}
      </TaskSection>

      {/* Completati */}
      <TaskSection label="Completati" dotClass="bg-emerald-500" textClass="text-emerald-400"
        count={doneTasks.length} open={accordion.done}
        onToggle={() => setAcc('done', !accordion.done)}
        hideIfEmpty>
        {doneTasks.map((task, i) => (
          <TaskCard key={task.id} task={task} i={i} getMember={getMember}
            onOpen={() => navigate(`/projects/task/${task.id}`)}
            onLongPress={() => setContextMenu(task)}
            onCheckClick={() => cycleStatus(task, 'todo')} />
        ))}
      </TaskSection>

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
                contextMenu.status === 'todo' && {
                  label: '🔄  Segna In corso',
                  action: () => { cycleStatus(contextMenu, 'in_progress'); setContextMenu(null) }
                },
                contextMenu.status !== 'done' && {
                  label: '✅  Segna Completato',
                  action: () => { cycleStatus(contextMenu, 'done'); setContextMenu(null) }
                },
                contextMenu.status !== 'todo' && {
                  label: '↩️  Riporta a Da fare',
                  action: () => { cycleStatus(contextMenu, 'todo'); setContextMenu(null) }
                },
                { label: '✏️  Apri e modifica', action: () => { navigate(`/projects/task/${contextMenu.id}`); setContextMenu(null) } },
                canDeleteTask(contextMenu) && {
                  label: '🗑️  Elimina task',
                  action: () => { setConfirmDelete(contextMenu); setContextMenu(null) },
                  danger: true
                },
              ].filter(Boolean).map(item => (
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
        title={`Eliminare "${confirmDelete?.title}"?`}
        message="Il task verrà eliminato definitivamente."
        confirmLabel="Elimina task"
        onConfirm={() => deleteTask(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Filter Sheet */}
      <AnimatePresence>
        {showFilterSheet && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setShowFilterSheet(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-lg mx-auto rounded-t-3xl p-6 space-y-5"
              style={{ background: 'var(--c-surface2)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))', maxHeight: '85dvh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 rounded-full mx-auto" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">Filtri e ordinamento</h3>
                {activeFilterCount > 0 && (
                  <button onClick={() => updateFilters({ priorities: [], statuses: [], assignees: [] })}
                    className="text-xs text-rose-400 font-semibold">Reset filtri</button>
                )}
              </div>

              {/* Priorità */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Priorità</p>
                <div className="flex gap-2">
                  {Object.entries(PRIORITY).map(([k, v]) => {
                    const active = filters.priorities.includes(k)
                    return (
                      <button key={k}
                        onClick={() => updateFilters({ ...filters, priorities: toggleMulti(filters.priorities, k) })}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold ${active ? v.badge : 'text-gray-500'}`}
                        style={{ background: active ? undefined : 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        {v.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Stato */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Stato</p>
                <div className="flex gap-2">
                  {[
                    { id: 'todo',        label: 'Da fare',    color: 'text-gray-300' },
                    { id: 'in_progress', label: 'In corso',   color: 'text-amber-400' },
                    { id: 'done',        label: 'Completati', color: 'text-emerald-400' },
                  ].map(s => {
                    const active = filters.statuses.includes(s.id)
                    return (
                      <button key={s.id}
                        onClick={() => updateFilters({ ...filters, statuses: toggleMulti(filters.statuses, s.id) })}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold ${active ? s.color : 'text-gray-500'}`}
                        style={{
                          background: active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                          border: active ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.06)'
                        }}>
                        {s.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Assegnatari */}
              {members.length > 1 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Assegnatario</p>
                  <div className="flex gap-2 flex-wrap">
                    {members.map(m => {
                      const active = filters.assignees.includes(m.id)
                      return (
                        <button key={m.id}
                          onClick={() => updateFilters({ ...filters, assignees: toggleMulti(filters.assignees, m.id) })}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                          style={{
                            background: active ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                            border: active ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.08)',
                            color: active ? '#a5b4fc' : '#6b7280'
                          }}>
                          {m.photoURL
                            ? <img src={m.photoURL} className="w-4 h-4 rounded-full" alt="" />
                            : <span className="w-4 h-4 rounded-full bg-primary-600 flex items-center justify-center text-[10px] text-white">{m.name?.charAt(0)}</span>
                          }
                          {m.name?.split(' ')[0]}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Ordinamento */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Ordina per</p>
                <div className="flex gap-2 mb-2">
                  {[
                    { field: 'dueDate',   label: '📅 Scadenza' },
                    { field: 'priority',  label: '⚡ Priorità' },
                  ].map(o => (
                    <button key={o.field} onClick={() => updateSort({ ...sort, field: o.field })}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold"
                      style={{
                        background: sort.field === o.field ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                        color: sort.field === o.field ? '#a5b4fc' : '#6b7280',
                        border: sort.field === o.field ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.06)'
                      }}>
                      {o.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {[
                    { dir: 'asc',  label: '↑ Crescente' },
                    { dir: 'desc', label: '↓ Decrescente' },
                  ].map(o => (
                    <button key={o.dir} onClick={() => updateSort({ ...sort, dir: o.dir })}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold"
                      style={{
                        background: sort.dir === o.dir ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                        color: sort.dir === o.dir ? '#a5b4fc' : '#6b7280',
                        border: sort.dir === o.dir ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.06)'
                      }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={() => setShowFilterSheet(false)}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'rgba(99,102,241,0.8)' }}>
                Applica
              </button>
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

// ── Sezione collassabile ────────────────────────────────────────────────────
function TaskSection({ label, dotClass, textClass, count, open, onToggle, children, emptyText, hideIfEmpty }) {
  if (hideIfEmpty && count === 0) return null
  return (
    <div className="mb-4">
      <button onClick={onToggle} className="flex items-center gap-2 mb-2 w-full text-left">
        <div className={`w-2 h-2 rounded-full ${dotClass}`} />
        <span className={`text-xs font-bold uppercase tracking-wide ${textClass}`}>{label}</span>
        <span className="text-xs text-gray-600 font-medium">{count}</span>
        <svg className={`w-3.5 h-3.5 text-gray-600 ml-auto transition-transform ${open ? '' : '-rotate-90'}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-2">
            {count === 0 && emptyText ? (
              <div className="flex items-center justify-center py-6 rounded-xl"
                style={{ border: '1px dashed rgba(255,255,255,0.07)' }}>
                <p className="text-xs text-gray-700">{emptyText}</p>
              </div>
            ) : children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Task card ───────────────────────────────────────────────────────────────
function TaskCard({ task, i, getMember, onOpen, onLongPress, onCheckClick }) {
  const p  = PRIORITY[task.priority] || PRIORITY.medium
  const lp = useLongPress(onLongPress, onOpen)
  const isDone       = task.status === 'done'
  const isInProgress = task.status === 'in_progress'

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04 }}
      className="rounded-xl p-3 select-none"
      style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
      {...lp}>
      <div className="flex items-start gap-2">
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${p.dot}`} />
        <p className={`text-sm font-medium leading-snug flex-1 ${
          isDone ? 'line-through text-gray-600' : isInProgress ? 'text-amber-200' : 'text-gray-200'
        }`}>
          {task.title}
        </p>
        <button onClick={e => { e.stopPropagation(); onCheckClick() }}
          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all ${
            isDone       ? 'bg-emerald-500 border-emerald-500' :
            isInProgress ? 'border-amber-400' :
                           'border-gray-700 hover:border-emerald-500'
          }`}>
          {isDone && (
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {isInProgress && <div className="w-2 h-2 rounded-full bg-amber-400" />}
        </button>
      </div>

      <div className="flex items-center justify-between mt-2 pl-3.5">
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <span className="text-[10px] text-gray-600">
              📅 {format(task.dueDate.toDate?.() || new Date(task.dueDate), 'd MMM', { locale: it })}
            </span>
          )}
          {task.createdByName && (
            <span className="text-[10px] text-gray-700">· {task.createdByName}</span>
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
