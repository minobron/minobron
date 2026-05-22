import { useState, useEffect, useRef } from 'react'
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from 'date-fns'
import { it } from 'date-fns/locale'

const USER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone

export default function CalendarScreen() {
  const { activeWorkspace } = useWorkspace()
  const { user }            = useAuth()
  const wsId                = activeWorkspace?.id
  const touchStartX         = useRef(null)

  const [current, setCurrent]     = useState(new Date())
  const [events, setEvents]       = useState([])
  const [selected, setSelected]   = useState(new Date())
  const [showNew, setShowNew]     = useState(false)
  const [newTitle, setNewTitle]   = useState('')
  const [newDesc, setNewDesc]     = useState('')
  const [newDate, setNewDate]     = useState(format(new Date(), 'yyyy-MM-dd'))
  const [newTime, setNewTime]     = useState('09:00')
  const [search, setSearch]       = useState('')
  const [selectedEvent, setSelectedEvent] = useState(null) // dettaglio evento

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
      date, timezone: USER_TZ,
      createdBy: user.uid, createdByName: user.name || user.email,
      createdAt: serverTimestamp()
    })
    setNewTitle(''); setNewDesc(''); setShowNew(false)
  }

  const deleteEvent = async (id) => {
    await deleteDoc(doc(db, `workspaces/${wsId}/events/${id}`))
    setSelectedEvent(null)
  }

  // Swipe gesti per cambiare mese
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchEnd   = (e) => {
    if (touchStartX.current === null) return
    const diff = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(diff) > 50) {
      diff < 0 ? setCurrent(d => addMonths(d, 1)) : setCurrent(d => subMonths(d, 1))
    }
    touchStartX.current = null
  }

  const days         = eachDayOfInterval({ start: startOfMonth(current), end: endOfMonth(current) })
  const firstDay     = (startOfMonth(current).getDay() + 6) % 7
  const searchActive = search.trim().length > 0
  const selectedEvs  = searchActive
    ? events.filter(e => e.title?.toLowerCase().includes(search.toLowerCase()))
    : events.filter(e => isSameDay(e.date?.toDate ? e.date.toDate() : new Date(e.date), selected))
  const hasEvents    = (day) => events.some(e => isSameDay(e.date?.toDate ? e.date.toDate() : new Date(e.date), day))

  return (
    <div className="max-w-lg mx-auto pb-4"
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

      {/* Navigazione mese */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => setCurrent(d => subMonths(d, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ background: 'rgba(255,255,255,0.05)' }}>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <h2 className="text-base font-bold text-white capitalize">
            {format(current, 'MMMM yyyy', { locale: it })}
          </h2>
          <p className="text-[10px] text-gray-600 mt-0.5">{USER_TZ}</p>
        </div>
        <button onClick={() => setCurrent(d => addMonths(d, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ background: 'rgba(255,255,255,0.05)' }}>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Barra di ricerca eventi */}
      <div className="relative mx-4 mb-3">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cerca evento…"
          autoComplete="off" autoCorrect="off" autoCapitalize="off"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          style={{ background: 'var(--c-input)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Griglia calendario (nascosta durante la ricerca) */}
      {!searchActive && (
        <div className="mx-4 rounded-2xl overflow-hidden mb-4" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
          <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--c-border)' }}>
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
      )}

      {/* Header giorno + aggiungi */}
      <div className="flex items-center justify-between px-4 mb-3">
        <p className="text-sm font-semibold text-gray-300 capitalize">
          {searchActive
            ? `${selectedEvs.length} risultat${selectedEvs.length === 1 ? 'o' : 'i'} per "${search}"`
            : format(selected, 'EEEE d MMMM', { locale: it })}
        </p>
        {!searchActive && (
          <button onClick={() => { setNewDate(format(selected, 'yyyy-MM-dd')); setNewTitle(''); setNewDesc(''); setShowNew(true) }}
            className="flex items-center gap-1 text-xs font-semibold text-primary-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Aggiungi
          </button>
        )}
      </div>

      {/* Lista eventi */}
      <div className="px-4 space-y-2">
        {selectedEvs.length === 0 ? (
          <p className="text-sm text-gray-700 text-center py-6">Nessun evento questo giorno</p>
        ) : selectedEvs.map(ev => {
          const date = ev.date?.toDate ? ev.date.toDate() : new Date(ev.date)
          return (
            <motion.button key={ev.id} onClick={() => setSelectedEvent(ev)}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left"
              style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
              <div className="w-10 h-10 rounded-xl bg-primary-500/15 flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-primary-400 leading-none">{format(date, 'HH:mm')}</span>
              </div>
              <div className="flex-1 text-left">
                <p className="font-semibold text-gray-200 text-sm">{ev.title}</p>
                {searchActive && <p className="text-xs text-primary-400 mt-0.5 capitalize">{format(date, 'EEEE d MMMM', { locale: it })}</p>}
                {ev.description && <p className="text-xs text-gray-600 mt-0.5">{ev.description}</p>}
                {ev.createdByName && <p className="text-[10px] text-gray-700 mt-0.5">Creato da {ev.createdByName}</p>}
              </div>
              <svg className="w-4 h-4 text-gray-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </motion.button>
          )
        })}
      </div>

      {/* Sheet dettaglio evento */}
      <AnimatePresence>
        {selectedEvent && (() => {
          const date = selectedEvent.date?.toDate ? selectedEvent.date.toDate() : new Date(selectedEvent.date)
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.6)' }}
              onClick={() => setSelectedEvent(null)}>
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                className="w-full max-w-lg mx-auto rounded-t-3xl p-6 space-y-4"
                style={{ background: 'var(--c-surface2)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
                onClick={e => e.stopPropagation()}>
                <div className="w-10 h-1 rounded-full mx-auto" style={{ background: 'rgba(255,255,255,0.1)' }} />

                <div>
                  <h3 className="text-lg font-bold text-white">{selectedEvent.title}</h3>
                  {selectedEvent.description && (
                    <p className="text-sm text-gray-400 mt-1">{selectedEvent.description}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
                    <span className="text-sm text-gray-500 w-16 flex-shrink-0">Data</span>
                    <span className="text-sm text-gray-200 capitalize">
                      {format(date, 'EEEE d MMMM yyyy', { locale: it })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 py-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
                    <span className="text-sm text-gray-500 w-16 flex-shrink-0">Orario</span>
                    <span className="text-sm text-gray-200">
                      {format(date, 'HH:mm')}
                      {selectedEvent.timezone && (
                        <span className="text-xs text-gray-600 ml-2">{selectedEvent.timezone}</span>
                      )}
                    </span>
                  </div>
                  {selectedEvent.createdByName && (
                    <div className="flex items-center gap-3 py-2">
                      <span className="text-sm text-gray-500 w-16 flex-shrink-0">Creato da</span>
                      <span className="text-sm text-gray-200">{selectedEvent.createdByName}</span>
                    </div>
                  )}
                </div>

                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={() => deleteEvent(selectedEvent.id)}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-rose-400"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  🗑️ Elimina evento
                </motion.button>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>

      {/* Modal nuovo evento */}
      <AnimatePresence>
        {showNew && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={e => e.target === e.currentTarget && setShowNew(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-lg mx-auto rounded-t-3xl p-6 space-y-4"
              style={{
                background: 'var(--c-surface2)',
                paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
                maxHeight: '92dvh',
                overflowY: 'auto',
              }}
              onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 rounded-full mx-auto" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <div>
                <h3 className="text-base font-bold text-white">Nuovo evento</h3>
                <p className="text-xs text-gray-600 mt-0.5">Fuso orario: {USER_TZ}</p>
              </div>

              <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createEvent()}
                placeholder="Titolo evento"
                autoComplete="off" autoCorrect="on" autoCapitalize="sentences"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                style={{ background: 'var(--c-input)', border: '1px solid var(--c-border)' }} />

              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2}
                placeholder="Descrizione (opzionale)"
                autoComplete="off" autoCorrect="on" autoCapitalize="sentences"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                style={{ background: 'var(--c-input)', border: '1px solid var(--c-border)' }} />

              <div className="flex gap-3">
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ background: 'var(--c-input)', border: '1px solid var(--c-border)' }} />
                <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ background: 'var(--c-input)', border: '1px solid var(--c-border)' }} />
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
