import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import ConfirmDialog from '../shared/ConfirmDialog'

const PRESET_COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#64748b']

export default function SettingsScreen() {
  const { activeWorkspace, members, isAdmin, updateWorkspaceMeta, removeMember } = useWorkspace()
  const { user, logout } = useAuth()
  const navigate         = useNavigate()

  const wsId = activeWorkspace?.id

  // Workspace name
  const [wsName, setWsName]       = useState(activeWorkspace?.name || '')
  const [nameSaved, setNameSaved] = useState(false)

  // Workspace emoji + color
  const [wsEmoji, setWsEmoji]   = useState(activeWorkspace?.emoji || '')
  const [wsColor, setWsColor]   = useState(activeWorkspace?.color || '#6366f1')
  const [metaSaved, setMetaSaved] = useState(false)

  // Theme
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'auto')

  // Remove member confirmation
  const [confirmRemove, setConfirmRemove] = useState(null) // { id, name }

  useEffect(() => {
    setWsName(activeWorkspace?.name || '')
    setWsEmoji(activeWorkspace?.emoji || '')
    setWsColor(activeWorkspace?.color || '#6366f1')
  }, [activeWorkspace])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark')       root.classList.add('dark')
    else if (theme === 'light') root.classList.remove('dark')
    else {
      window.matchMedia('(prefers-color-scheme: dark)').matches
        ? root.classList.add('dark') : root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const saveWsName = async () => {
    if (!wsName.trim() || !wsId) return
    await updateWorkspaceMeta({ name: wsName.trim() })
    setNameSaved(true)
    setTimeout(() => setNameSaved(false), 2000)
  }

  const saveWsMeta = async () => {
    if (!wsId) return
    await updateWorkspaceMeta({
      emoji: wsEmoji.trim(),
      color: wsColor,
    })
    setMetaSaved(true)
    setTimeout(() => setMetaSaved(false), 2000)
  }

  const handleRemoveMember = async () => {
    if (!confirmRemove) return
    await removeMember(confirmRemove.id)
    setConfirmRemove(null)
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-8 pt-3 space-y-6">

      {/* Profilo */}
      <Group label="Profilo">
        <div className="flex items-center gap-4 px-4 py-3"
          style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: '1rem' }}>
          {user?.photoURL
            ? <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full" />
            : <div className="w-12 h-12 rounded-full bg-primary-600 flex items-center justify-center text-xl font-bold text-white">
                {user?.name?.charAt(0)}
              </div>
          }
          <div className="min-w-0">
            <p className="font-bold" style={{ color: 'var(--c-text)' }}>{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            {isAdmin && (
              <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md mt-0.5 inline-block"
                style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                Admin
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-700 px-1">Per cambiare nome tocca la tua foto nell'header.</p>
      </Group>

      {/* Aspetto */}
      <Group label="Aspetto">
        <div className="flex gap-2">
          {[
            { val: 'auto',  emoji: '🌓', label: 'Auto' },
            { val: 'light', emoji: '☀️', label: 'Chiaro' },
            { val: 'dark',  emoji: '🌙', label: 'Scuro' },
          ].map(opt => (
            <button key={opt.val} onClick={() => setTheme(opt.val)}
              className="flex-1 py-3 rounded-2xl text-center transition-all"
              style={{
                background: theme === opt.val ? '#6366f1' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${theme === opt.val ? '#6366f1' : 'rgba(255,255,255,0.08)'}`,
              }}>
              <p className="text-lg">{opt.emoji}</p>
              <p className={`text-xs font-semibold mt-0.5 ${theme === opt.val ? 'text-white' : 'text-gray-500'}`}>
                {opt.label}
              </p>
            </button>
          ))}
        </div>
      </Group>

      {/* Workspace — solo admin */}
      {isAdmin && (
        <>
          <Group label="Workspace">
            <div className="space-y-3">
              {/* Nome */}
              <label className="block">
                <p className="text-xs text-gray-600 mb-1.5 uppercase tracking-wide font-semibold">Nome</p>
                <div className="flex gap-2">
                  <input value={wsName} onChange={e => { setWsName(e.target.value); setNameSaved(false) }}
                    onKeyDown={e => e.key === 'Enter' && saveWsName()}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    style={{ background: 'var(--c-input)', border: '1px solid var(--c-border)' }} />
                  <motion.button whileTap={{ scale: 0.95 }} onClick={saveWsName}
                    disabled={!wsName.trim()}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white min-w-[5rem] disabled:opacity-40"
                    style={{ background: '#6366f1' }}>
                    {nameSaved ? '✓' : 'Salva'}
                  </motion.button>
                </div>
              </label>

              {/* Emoji */}
              <label className="block">
                <p className="text-xs text-gray-600 mb-1.5 uppercase tracking-wide font-semibold">Emoji</p>
                <input
                  value={wsEmoji}
                  onChange={e => { setWsEmoji(e.target.value); setMetaSaved(false) }}
                  placeholder="🏢"
                  maxLength={4}
                  className="w-24 px-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 text-center text-xl"
                  style={{ background: 'var(--c-input)', border: '1px solid var(--c-border)' }}
                />
              </label>

              {/* Colore */}
              <div>
                <p className="text-xs text-gray-600 mb-1.5 uppercase tracking-wide font-semibold">Colore</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => { setWsColor(c); setMetaSaved(false) }}
                      className="w-8 h-8 rounded-full transition-transform active:scale-95"
                      style={{ backgroundColor: c, outline: wsColor === c ? `2px solid ${c}` : 'none', outlineOffset: '2px' }} />
                  ))}
                  <input type="color" value={wsColor} onChange={e => { setWsColor(e.target.value); setMetaSaved(false) }}
                    className="w-8 h-8 rounded-full cursor-pointer border-0" />
                </div>
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={saveWsMeta}
                className="w-full py-2.5 text-sm font-semibold text-white rounded-xl"
                style={{ background: '#6366f1' }}>
                {metaSaved ? '✓ Salvato' : 'Salva emoji e colore'}
              </motion.button>

              <p className="text-xs text-gray-700 px-1">
                ID: <span className="font-mono text-gray-600 select-all">{wsId}</span>
              </p>
            </div>
          </Group>
        </>
      )}

      {/* Membri — visibile a tutti */}
      <Group label="Membri">
        <div className="space-y-2">
          {members.length === 0 ? (
            <p className="text-sm text-gray-600 px-1">Nessun membro trovato.</p>
          ) : members.map(m => {
            const isSelf  = m.id === user?.uid
            const mIsAdmin = activeWorkspace?.adminIds?.includes(m.id)
            return (
              <div key={m.id}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                {m.photoURL
                  ? <img src={m.photoURL} alt="" className="w-9 h-9 rounded-full flex-shrink-0" />
                  : <div className="w-9 h-9 rounded-full bg-primary-700 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                      {m.name?.charAt(0) || '?'}
                    </div>
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>{m.name}</p>
                    {isSelf && (
                      <span className="text-[10px] text-gray-600 font-medium">(tu)</span>
                    )}
                    {mIsAdmin && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md"
                        style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{m.email}</p>
                </div>
                {/* Rimuovi membro — solo admin, non se stesso */}
                {isAdmin && !isSelf && (
                  <motion.button whileTap={{ scale: 0.9 }}
                    onClick={() => setConfirmRemove({ id: m.id, name: m.name })}
                    className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0 text-rose-400"
                    style={{ background: 'rgba(239,68,68,0.08)' }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                    </svg>
                  </motion.button>
                )}
              </div>
            )
          })}
        </div>
        {!isAdmin && members.length > 0 && (
          <p className="text-xs text-gray-700 px-1">Solo gli admin possono rimuovere i membri.</p>
        )}
      </Group>

      {/* Account */}
      <Group label="Account">
        <motion.button whileTap={{ scale: 0.97 }}
          onClick={async () => { await logout(); navigate('/login') }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-rose-400"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Esci dall'account
        </motion.button>
      </Group>

      <p className="text-center text-xs text-gray-800 pb-2">Minobron v4.0</p>

      {/* Dialogo conferma rimozione membro */}
      <ConfirmDialog
        open={!!confirmRemove}
        title={`Rimuovere ${confirmRemove?.name}?`}
        message="Questa persona perderà l'accesso al workspace. Potrà essere riaggiunta in seguito."
        confirmLabel="Rimuovi"
        onConfirm={handleRemoveMember}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  )
}

function Group({ label, children }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-2 px-1">{label}</p>
      <div className="space-y-3">{children}</div>
    </div>
  )
}
