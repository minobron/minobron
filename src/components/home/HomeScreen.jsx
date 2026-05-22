import { useEffect, useState } from 'react'
import { collection, query, where, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format, isToday, isTomorrow } from 'date-fns'
import { it } from 'date-fns/locale'

const PRIORITY_DOT = { high: 'bg-rose-500', medium: 'bg-amber-400', low: 'bg-emerald-500' }

export default function HomeScreen() {
  const { user }            = useAuth()
  const { activeWorkspace, members } = useWorkspace()
  const navigate            = useNavigate()
  const [myTasks, setMyTasks]     = useState([])
  const [pins, setPins]           = useState([])
  const [activity, setActivity]   = useState([])
  const [events, setEvents]       = useState([])
  const [projects, setProjects]   = useState([])
  const wsId = activeWorkspace?.id

  // Pin dimenticati — persistono in localStorage per workspace
  const dismissKey = `dismissed_pins_${wsId}`
  const [dismissedPins, setDismissedPins] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`dismissed_pins_${wsId}`) || '[]') }
    catch { return [] }
  })
  const dismissPin = (pinId, e) => {
    e.stopPropagation()
    const next = [...dismissedPins, pinId]
    setDismissedPins(next)
    localStorage.setItem(dismissKey, JSON.stringify(next))
  }
  const visiblePins = pins.filter(p => !dismissedPins.includes(p.id))

  useEffect(() => {
    if (!wsId || !user) return
    const q = query(
      collection(db, `workspaces/${wsId}/tasks`),
      where('assignees', 'array-contains', user.uid),
      limit(30)
    )
    return onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      const active = all
        .filter(t => t.status !== 'done')
        .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] ?? 1) - ({ high: 0, medium: 1, low: 2 }[b.priority] ?? 1))
      setMyTasks(active)
    })
  }, [wsId, user])

  useEffect(() => {
    if (!wsId) return
    const q = query(collection(db, `workspaces/${wsId}/pins`), orderBy('createdAt', 'desc'), limit(5))
    return onSnapshot(q, snap => setPins(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [wsId])

  useEffect(() => {
    if (!wsId) return
    const q = query(collection(db, `workspaces/${wsId}/activity`), orderBy('createdAt', 'desc'), limit(8))
    return onSnapshot(q, snap => setActivity(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [wsId])

  useEffect(() => {
    if (!wsId) return
    const q = query(collection(db, `workspaces/${wsId}/events`), orderBy('date', 'asc'), limit(5))
    return onSnapshot(q, snap => {
      const now = new Date()
      setEvents(snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(e => {
          const d = e.date?.toDate ? e.date.toDate() : new Date(e.date)
          return d >= now
        })
        .slice(0, 3))
    })
  }, [wsId])

  useEffect(() => {
    if (!wsId) return
    return onSnapshot(collection(db, `workspaces/${wsId}/projects`), snap =>
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
  }, [wsId])

  const getMember = uid => members.find(m => m.id === uid)
  const getProject = pid => projects.find(p => p.id === pid)

  const formatDue = (date) => {
    if (!date) return null
    const d = date.toDate ? date.toDate() : new Date(date)
    if (isToday(d))    return { label: 'Oggi',   color: 'text-amber-400' }
    if (isTomorrow(d)) return { label: 'Domani', color: 'text-primary-400' }
    return { label: format(d, 'd MMM', { locale: it }), color: 'text-gray-500' }
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-5 pb-2">

      {/* Saluto */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pt-1">
        <h2 className="text-2xl font-bold text-white">
          Ciao, {user?.name?.split(' ')[0]} 👋
        </h2>
        <p className="text-gray-500 text-sm mt-0.5 capitalize">
          {format(new Date(), "EEEE d MMMM", { locale: it })}
        </p>
      </motion.div>

      {/* In evidenza — sparisce quando tutti i pin sono dimenticati */}
      {visiblePins.length > 0 && (
        <Section title="In evidenza" icon="📌">
          <div className="space-y-2">
            {visiblePins.map(pin => (
              <motion.div key={pin.id} whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/calendar')}
                className="flex items-start gap-3 p-3 rounded-xl border border-amber-500/20 cursor-pointer"
                style={{ background: 'rgba(245,158,11,0.06)' }}>
                <span className="text-base mt-0.5">{pin.emoji || '📌'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{pin.title}</p>
                  {pin.content && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{pin.content}</p>}
                </div>
                {/* Tasto × per far sparire la notifica */}
                <button
                  onClick={(e) => dismissPin(pin.id, e)}
                  className="text-amber-600 hover:text-amber-400 flex-shrink-0 p-0.5 -mr-0.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </motion.div>
            ))}
          </div>
        </Section>
      )}

      {/* I miei task */}
      <Section
        title="I miei task"
        icon="✅"
        badge={myTasks.length || null}
        action={{ label: 'Vedi tutti', onClick: () => navigate('/projects') }}
      >
        {myTasks.length === 0 ? (
          <EmptyState emoji="🎉" text="Nessun task in sospeso" />
        ) : (
          <div className="space-y-1.5">
            {myTasks.slice(0, 6).map((task, i) => {
              const dot = PRIORITY_DOT[task.priority] || PRIORITY_DOT.medium
              const due = formatDue(task.dueDate)
              return (
                <motion.div key={task.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/projects/task/${task.id}`)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer"
                  style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{task.title}</p>
                    {task.projectId && getProject(task.projectId) && (
                      <p className="text-[10px] text-gray-600 mt-0.5 truncate">
                        {getProject(task.projectId).emoji} {getProject(task.projectId).name}
                      </p>
                    )}
                  </div>
                  {due && <span className={`text-xs flex-shrink-0 font-medium ${due.color}`}>{due.label}</span>}
                </motion.div>
              )
            })}
          </div>
        )}
      </Section>

      {/* Prossimi eventi */}
      {events.length > 0 && (
        <Section title="Prossimi eventi" icon="📅">
          <div className="space-y-1.5">
            {events.map(ev => {
              const date = ev.date?.toDate ? ev.date.toDate() : new Date(ev.date)
              return (
                <motion.div key={ev.id} whileTap={{ scale: 0.98 }}
                  onClick={() => navigate('/calendar')}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer"
                  style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                  <div className="w-10 h-10 rounded-xl bg-primary-500/15 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-primary-400 uppercase leading-none">
                      {format(date, 'MMM', { locale: it })}
                    </span>
                    <span className="text-sm font-bold text-primary-300 leading-none mt-0.5">
                      {format(date, 'd')}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-200">{ev.title}</p>
                    {ev.description && <p className="text-xs text-gray-500 mt-0.5">{ev.description}</p>}
                  </div>
                  <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </motion.div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Attività recente */}
      {activity.length > 0 && (
        <Section title="Attività recente" icon="🕐">
          <div>
            {activity.map(a => {
              const actor = getMember(a.userId)
              return (
                <div key={a.id} className="flex items-start gap-3 py-2.5 border-b last:border-0"
                  style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  {actor?.photoURL
                    ? <img src={actor.photoURL} alt="" className="w-6 h-6 rounded-full flex-shrink-0 mt-0.5" />
                    : <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold text-white">
                        {actor?.name?.charAt(0) || '?'}
                      </div>
                  }
                  <p className="text-sm text-gray-500 leading-snug">{a.text}</p>
                </div>
              )
            })}
          </div>
        </Section>
      )}
    </div>
  )
}

function Section({ title, icon, badge, action, children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
          {badge != null && (
            <span className="text-[10px] bg-primary-500/20 text-primary-400 font-bold px-1.5 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        {action && (
          <button onClick={action.onClick} className="text-xs text-primary-400 font-medium">
            {action.label}
          </button>
        )}
      </div>
      {children}
    </motion.div>
  )
}

function EmptyState({ emoji, text }) {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-gray-600 text-sm">
      <span>{emoji}</span><span>{text}</span>
    </div>
  )
}
