import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'

const ROUTE_TITLES = {
  '/home':     null,
  '/projects': 'Progetti',
  '/chat':     'Chat',
  '/calendar': 'Calendario',
  '/archive':  'Archivio',
  '/settings': 'Impostazioni',
}

export default function Header({ title, showBack }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { activeWorkspace, workspaces, switchWorkspace } = useWorkspace()
  const { user, logout, updateUserName } = useAuth()

  const [showProfile, setShowProfile] = useState(false)
  const [editName, setEditName]       = useState(false)
  const [nameVal, setNameVal]         = useState('')

  const isHome     = location.pathname === '/home'
  const routeTitle = ROUTE_TITLES[location.pathname]
  const pageTitle  = title ?? (isHome
    ? (activeWorkspace?.name || 'Minobron')
    : (routeTitle || 'Minobron'))

  const openProfile = () => {
    setNameVal(user?.name || '')
    setEditName(false)
    setShowProfile(true)
  }

  const saveName = async () => {
    if (!nameVal.trim()) return
    await updateUserName(nameVal)
    setEditName(false)
  }

  return (
    <>
      {/* Header bar */}
      <header
        className="fixed top-0 left-0 right-0 z-40 border-b border-white/5"
        style={{
          background:   'rgba(13,13,20,0.85)',
          backdropFilter: 'blur(16px)',
          paddingTop:   'var(--sat)',
        }}
      >
        <div className="flex items-center h-14 px-4 gap-3 max-w-lg mx-auto">

          {showBack ? (
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </motion.button>
          ) : null}

          {/* Titolo / workspace switcher */}
          <div className="flex-1 min-w-0">
            {isHome && workspaces.length > 1 ? (
              <select
                value={activeWorkspace?.id || ''}
                onChange={e => switchWorkspace(workspaces.find(w => w.id === e.target.value))}
                className="text-base font-bold text-white bg-transparent border-none outline-none cursor-pointer w-full"
                style={{ appearance: 'none', WebkitAppearance: 'none' }}
              >
                {workspaces.map(ws => (
                  <option key={ws.id} value={ws.id} style={{ background: '#111118', color: 'white' }}>
                    {ws.name}
                  </option>
                ))}
              </select>
            ) : (
              <h1 className="text-base font-bold text-white truncate">{pageTitle}</h1>
            )}
          </div>

          {/* Settings shortcut sulle pagine non-home */}
          {!isHome && !showBack && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate('/settings')}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </motion.button>
          )}

          {/* Avatar profilo */}
          <motion.button whileTap={{ scale: 0.9 }} onClick={openProfile}>
            {user?.photoURL
              ? <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full ring-1 ring-white/10" />
              : <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-sm font-bold text-white">
                  {user?.name?.charAt(0) || '?'}
                </div>
            }
          </motion.button>
        </div>
      </header>

      {/* Profile sheet */}
      <AnimatePresence>
        {showProfile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => { setShowProfile(false); setEditName(false) }}>
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-lg mx-auto rounded-t-3xl p-6 space-y-3"
              style={{ background: '#1a1a26', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
              onClick={e => e.stopPropagation()}>

              <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-4" />

              {/* Avatar + info */}
              <div className="flex items-center gap-4 mb-2">
                {user?.photoURL
                  ? <img src={user.photoURL} alt="" className="w-14 h-14 rounded-full ring-2 ring-primary-500/30" />
                  : <div className="w-14 h-14 rounded-full bg-primary-600 flex items-center justify-center text-xl font-bold text-white">
                      {user?.name?.charAt(0)}
                    </div>
                }
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white">{user?.name}</p>
                  <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                </div>
              </div>

              {/* Cambia nome */}
              {editName ? (
                <div className="flex gap-2">
                  <input
                    autoFocus value={nameVal} onChange={e => setNameVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveName()}
                    placeholder="Il tuo nome"
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    style={{ background: '#252534', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                  <motion.button whileTap={{ scale: 0.95 }} onClick={saveName}
                    className="px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold">
                    Salva
                  </motion.button>
                </div>
              ) : (
                <SheetButton icon="✏️" label="Cambia nome" onClick={() => setEditName(true)} />
              )}

              <SheetButton icon="⚙️" label="Impostazioni" onClick={() => { setShowProfile(false); navigate('/settings') }} />

              <SheetButton icon="🚪" label="Esci dall'account" danger
                onClick={async () => { await logout(); setShowProfile(false) }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function SheetButton({ icon, label, onClick, danger }) {
  return (
    <motion.button whileTap={{ scale: 0.98 }} onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-medium transition-colors ${
        danger
          ? 'text-rose-400 hover:bg-rose-500/10'
          : 'text-gray-200 hover:bg-white/5'
      }`}
      style={{ background: danger ? undefined : 'rgba(255,255,255,0.03)' }}>
      <span className="text-base">{icon}</span>
      {label}
    </motion.button>
  )
}
