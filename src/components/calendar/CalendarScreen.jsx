import { useState, useEffect } from 'react'
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from 'date-fns'
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

  const deleteEvent = async (id) => {
    await deleteDoc(doc(db, `workspaces/${wsId}/events/${id}`))
  }

  const days         = eachDayOfInterval({ start: startOfMonth(current), end: endOfMonth(current) })
  const firstDay     = (startOfMonth(current).getDay() + 6) % 7
  const selectedEvs  = events.filter(e => isSameDay(e.date?.toDate ? e.date.toDate() : new Date(e.date), selected))
  const hasEvents    = (day) => events.some(e => isSameDay(e.date?.toDate ? e.date.toDate() : new Date(e.date), day))

  return (
    <div className="max-w-lg mx-auto pb-4">
      {/* Navigazione mese */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => setCurrent(d => subMonths(d, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ background: 'rgba(255,255,255,0.05)' }}>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-base font-bold text-white capitalize">
          {format(current, 'MMMM yyyy', { locale: it })}
        </h2>
        <button onClick={() => setCurrent(d => addMonths(d, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ background: 'rgba(255,255,255,0.05)' }}>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Griglia calendario */}
      <div className="mx-4 rounded-2xl overflow-hidden mb-4" style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="grid grid-cols-7" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {['L','M','M','G','V','S','D'].map((d, i) => (
            <div key={i} className="py-2 text-center text-xs font-semibold text-gray-600">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {days.map(day => {
            const isSel = isSameDay(day, selected)
            const isCur = isToday(day)
            const hasEv = hasEvents(day)
            return (
              <button key={day.toISOString()} onClick={() => setSelected(day)}
                className="relative flex flex-col items-center py-2.5 transition-colors"
                style={{ background: isSel ? '#6366f1' : isCur ? 'rgba(99,102,241,0.1)' : 'transparent' }}>
                <span className={`text-sm font-medium ${isSel ? 'text-white' : isCur ? 'text-primary-400' : 'text-gray-400'}`}>
                  {format(day, 'd')}
                </span>
                {hasEv && <div className={`w-1 h-1 rounded-full mt-0.5 ${isSel ? 'bg-white/60' : 'bg-primary-400'}`} />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Header giorno + aggiungi */}
      <div className="flex items-center justify-between px-4 mb-3">
        <p className="text-sm font-semibold text-gray-300 capitalize">
          {format(selected, 'EEEE d MMMM', { locale: it })}
        </p>
        <button onClick={() => { setNewDate(format(selected, 'yyyy-MM-dd')); setNewTitle(''); setNewDesc(''); setShowNew(true) }}
          className="flex items-center gap-1 text-xs font-semibold text-primary-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Aggiungi
        </button>
      </div>

      {/* Lista eventi giorno */}
      <div className="px-4 space-y-2">
        {selectedEvs.length === 0 ? (
          <p className="text-sm text-gray-700 text-center py-6">Nessun evento questo giorno</p>
        ) : selectedEvs.map(ev => {
          const date = ev.date?.toDate ? ev.date.toDate() : new Date(ev.date)
          return (
            <motion.div key={ev.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-10 h-10 rounded-xl bg-primary-500/15 flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-primary-400 leading-none">{format(date, 'HH:mm')}</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-200 text-sm">{ev.title}</p>
                {ev.description && <p className="text-xs text-gray-600 mt-0.5">{ev.description}</p>}
              </div>
              <button onClick={() => deleteEvent(ev.id)} className="p-1.5 rounded-lg text-gray-700 hover:text-rose-400 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </motion.div>
          )
        })}
      </div>

      {/* Modal nuovo evento — con max-height e overflow per non tagliarlo */}
      <AnimatePresence>
        {showNew && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={e => e.target === e.currentTarget && setShowNew(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-lg mx-auto rounded-t-3xl p-6 space-y-4"
              style={{
                background: '#1a1a26',
                paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
                maxHeight: '92dvh',
                overflowY: 'auto',
              }}
              onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 rounded-full mx-auto" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <h3 className="text-base font-bold text-white">Nuovo evento</h3>

              <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createEvent()}
                placeholder="Titolo evento"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                style={{ background: '#252534', border: '1px solid rgba(255,255,255,0.08)' }} />

              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2}
                placeholder="Descrizione (opzionale)"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                style={{ background: '#252534', border: '1px solid rgba(255,255,255,0.08)' }} />

              <div className="flex gap-3">
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ background: '#252534', border: '1px solid rgba(255,255,255,0.08)' }} />
                <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ background: '#252534', border: '1px solid rgba(255,255,255,0.08)' }} />
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={createEvent} disabled={!newTitle.trim()}
                className="w-full py-3 bg-primary-600 text-white font-semibold rounded-xl text-sm disabled:opacity-40">
                ✓ Crea evento
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
