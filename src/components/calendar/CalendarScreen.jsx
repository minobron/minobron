import { useState, useEffect } from 'react'
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, isToday, addMonths, subMonths } from 'date-fns'
import { it } from 'date-fns/locale'

export default function CalendarScreen() {
  const { activeWorkspace } = useWorkspace()
  const { user }            = useAuth()
  const wsId                = activeWorkspace?.id
  const [current, setCurrent]   = useState(new Date())
  const [events, setEvents]     = useState([])
  const [selected, setSelected] = useState(new Date())
  const [showNew, setShowNew]   = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc]   = useState('')
  const [newDate, setNewDate]   = useState(format(new Date(), 'yyyy-MM-dd'))
  const [newTime, setNewTime]   = useState('09:00')

  useEffect(() => {
    if (!wsId) return
    const q = query(collection(db, `workspaces/${wsId}/events`), orderBy('date', 'asc'))
    return onSnapshot(q, snap => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [wsId])

  const createEvent = async () => {
    if (!newTitle.trim()) return
    const date = new Date(`${newDate}T${newTime}`)
    await addDoc(collection(db, `workspaces/${wsId}/events`), {
      title: newTitle.trim(), description: newDesc.trim(),
      date, createdBy: user.uid, createdAt: serverTimestamp()
    })
    setNewTitle(''); setNewDesc(''); setShowNew(false)
  }

  const days = eachDayOfInterval({ start: startOfMonth(current), end: endOfMonth(current) })
  const firstDayOfWeek = (startOfMonth(current).getDay() + 6) % 7 // Monday = 0
  const selectedEvents = events.filter(e => {
    const d = e.date?.toDate ? e.date.toDate() : new Date(e.date)
    return isSameDay(d, selected)
  })

  const hasEvents = (day) => events.some(e => {
    const d = e.date?.toDate ? e.date.toDate() : new Date(e.date)
    return isSameDay(d, day)
  })

  return (
    <div className="max-w-lg mx-auto px-4 pb-6">
      {/* Navigazione mese */}
      <div className="flex items-center justify-between py-3">
        <button onClick={() => setCurrent(d => subMonths(d, 1))} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white capitalize">
          {format(current, 'MMMM yyyy', { locale: it })}
        </h2>
        <button onClick={() => setCurrent(d => addMonths(d, 1))} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* Griglia calendario */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden mb-4">
        {/* Intestazione giorni */}
        <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700">
          {['L','M','M','G','V','S','D'].map((d, i) => (
            <div key={i} className="py-2 text-center text-xs font-semibold text-gray-400 dark:text-gray-500">{d}</div>
          ))}
        </div>

        {/* Celle */}
        <div className="grid grid-cols-7">
          {/* Offset per il primo giorno */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e${i}`} />)}
          {days.map(day => {
            const isSelected = isSameDay(day, selected)
            const isCurrentDay = isToday(day)
            const hasEv = hasEvents(day)
            return (
              <button key={day.toISOString()} onClick={() => setSelected(day)}
                className={`relative flex flex-col items-center py-2.5 transition-colors ${isSelected ? 'bg-primary-500' : isCurrentDay ? 'bg-primary-50 dark:bg-primary-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                <span className={`text-sm font-medium ${isSelected ? 'text-white' : isCurrentDay ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  {format(day, 'd')}
                </span>
                {hasEv && <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-white/70' : 'bg-primary-400'}`} />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Eventi del giorno selezionato */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 capitalize">
          {format(selected, "EEEE d MMMM", { locale: it })}
        </h3>
        <button onClick={() => { setNewDate(format(selected, 'yyyy-MM-dd')); setShowNew(true) }}
          className="flex items-center gap-1 text-xs text-primary-500 font-semibold">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Aggiungi
        </button>
      </div>

      <div className="space-y-2">
        {selectedEvents.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-6 text-center">Nessun evento questo giorno</p>
        ) : selectedEvents.map(ev => {
          const date = ev.date?.toDate ? ev.date.toDate() : new Date(ev.date)
          return (
            <motion.div key={ev.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary-600 dark:text-primary-400">{format(date, 'HH:mm')}</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm">{ev.title}</p>
                {ev.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{ev.description}</p>}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Modal nuovo evento */}
      <AnimatePresence>
        {showNew && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end"
            onClick={e => e.target === e.currentTarget && setShowNew(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full bg-white dark:bg-gray-900 rounded-t-3xl p-6 pb-10 max-w-lg mx-auto space-y-4">
              <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nuovo evento</h3>
              <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
                placeholder="Titolo evento"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400" />
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2}
                placeholder="Descrizione (opzionale)"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none" />
              <div className="flex gap-3">
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400" />
                <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400" />
              </div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={createEvent} disabled={!newTitle.trim()}
                className="w-full py-3 bg-primary-500 text-white font-semibold rounded-xl disabled:opacity-40">
                Crea evento
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
