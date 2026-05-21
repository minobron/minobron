import { useEffect, useState } from 'react'
import { collection, query, where, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

const PRIORITY_COLORS = { high: 'bg-rose-100 text-rose-600', medium: 'bg-amber-100 text-amber-600', low: 'bg-emerald-100 text-emerald-600' }
const PRIORITY_LABELS = { high: 'Alta', medium: 'Media', low: 'Bassa' }

export default function HomeScreen() {
  const { user }             = useAuth()
  const { activeWorkspace, members }  = useWorkspace()
  const navigate             = useNavigate()
  const [myTasks, setMyTasks]   = useState([])
  const [pins, setPins]         = useState([])
  const [activity, setActivity] = useState([])
  const [events, setEvents]     = useState([])

  const wsId = activeWorkspace?.id

  // Task assegnati a me
  useEffect(() => {
    if (!wsId || !user) return
    const q = query(
      collection(db, `workspaces/${wsId}/tasks`),
      where('assignees', 'array-contains', user.uid),
      where('status', '!=', 'done'),
      orderBy('status'),
      orderBy('dueDate'),
      limit(10)
    )
    return onSnapshot(q, snap => setMyTasks(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [wsId, user])

  // In evidenza
  useEffect(() => {
    if (!wsId) return
    const q = query(collection(db, `workspaces/${wsId}/pins`), orderBy('createdAt', 'desc'), limit(5))
    return onSnapshot(q, snap => setPins(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [wsId])

  // Attività recente
  useEffect(() => {
    if (!wsId) return
    const q = query(collection(db, `workspaces/${wsId}/activity`), orderBy('createdAt', 'desc'), limit(8))
    return onSnapshot(q, snap => setActivity(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [wsId])

  // Prossimi eventi
  useEffect(() => {
    if (!wsId) return
    const q = query(collection(db, `workspaces/${wsId}/events`), where('date', '>=', new Date()), orderBy('date'), limit(3))
    return onSnapshot(q, snap => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [wsId])

  const getMember = (uid) => members.find(m => m.id === uid)

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6">
      {/* Saluto */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pt-2">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Ciao, {user?.name?.split(' ')[0]} 👋
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 capitalize">
          {format(new Date(), "EEEE d MMMM", { locale: it })}
        </p>
      </motion.div>

      {/* In evidenza */}
      {pins.length > 0 && (
        <Section title="In evidenza" icon="📌">
          <div className="space-y-2">
            {pins.map(pin => (
              <div key={pin.id} className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
                <span className="text-lg">{pin.emoji || '📌'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{pin.title}</p>
                  {pin.content && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{pin.content}</p>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* I miei task */}
      <Section title="I miei task" icon="✅" action={{ label: 'Vedi tutti', onClick: () => navigate('/projects') }}>
        {myTasks.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">Nessun task assegnato a te</p>
        ) : (
          <div className="space-y-2">
            {myTasks.slice(0, 5).map(task => (
              <motion.div
                key={task.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/projects/task/${task.id}`)}
                className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm cursor-pointer"
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${task.priority === 'high' ? 'bg-rose-400' : task.priority === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                <p className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{task.title}</p>
                {task.dueDate && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                    {format(task.dueDate.toDate?.() || new Date(task.dueDate), 'd MMM', { locale: it })}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </Section>

      {/* Prossimi eventi */}
      {events.length > 0 && (
        <Section title="Prossimi eventi" icon="📅">
          <div className="space-y-2">
            {events.map(ev => (
              <div key={ev.id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900 flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary-600 dark:text-primary-400 uppercase">
                    {format(ev.date.toDate?.() || new Date(ev.date), 'MMM', { locale: it })}
                  </span>
                  <span className="text-sm font-bold text-primary-700 dark:text-primary-300 leading-none">
                    {format(ev.date.toDate?.() || new Date(ev.date), 'd')}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{ev.title}</p>
                  {ev.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ev.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Attività recente */}
      {activity.length > 0 && (
        <Section title="Attività recente" icon="🕐">
          <div className="space-y-1">
            {activity.map(a => {
              const actor = getMember(a.userId)
              return (
                <div key={a.id} className="flex items-start gap-3 py-2">
                  {actor?.photoURL
                    ? <img src={actor.photoURL} alt="" className="w-6 h-6 rounded-full flex-shrink-0 mt-0.5" />
                    : <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold text-primary-600">{actor?.name?.charAt(0)}</div>
                  }
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-snug">{a.text}</p>
                </div>
              )
            })}
          </div>
        </Section>
      )}
    </div>
  )
}

function Section({ title, icon, action, children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <span>{icon}</span>{title}
        </h3>
        {action && (
          <button onClick={action.onClick} className="text-xs text-primary-500 font-medium">{action.label}</button>
        )}
      </div>
      {children}
    </motion.div>
  )
}
