import { useState, useEffect } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

const DEFAULT_FOLDERS = ['Generale', 'Loghi', 'Documenti', 'Foto', 'Altro']

export default function SettingsScreen() {
  const { activeWorkspace } = useWorkspace()
  const { user, logout }    = useAuth()
  const navigate            = useNavigate()
  const wsId    = activeWorkspace?.id
  const isAdmin = activeWorkspace?.adminIds?.includes(user?.uid)

  const [wsName, setWsName]     = useState(activeWorkspace?.name || '')
  const [nameSaved, setNameSaved] = useState(false)
  const [theme, setTheme]       = useState(() => localStorage.getItem('theme') || 'auto')
  const [folders, setFolders]   = useState(
    activeWorkspace?.folders?.length ? activeWorkspace.folders : [...DEFAULT_FOLDERS]
  )
  const [foldersSaved, setFoldersSaved] = useState(false)

  useEffect(() => {
    setWsName(activeWorkspace?.name || '')
    setFolders(activeWorkspace?.folders?.length ? activeWorkspace.folders : [...DEFAULT_FOLDERS])
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
    await updateDoc(doc(db, `workspaces/${wsId}`), { name: wsName.trim() })
    setNameSaved(true); setTimeout(() => setNameSaved(false), 2000)
  }

  const saveFolders = async () => {
    const valid = folders.map(f => f.trim()).filter(Boolean)
    if (!valid.length || !wsId) return
    await updateDoc(doc(db, `workspaces/${wsId}`), { folders: valid })
    setFoldersSaved(true); setTimeout(() => setFoldersSaved(false), 2000)
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-8 pt-3 space-y-6">

      {/* Profilo */}
      <Group label="Profilo">
        <div className="flex items-center gap-4 px-4 py-3"
          style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1rem' }}>
          {user?.photoURL
            ? <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full" />
            : <div className="w-12 h-12 rounded-full bg-primary-600 flex items-center justify-center text-xl font-bold text-white">
                {user?.name?.charAt(0)}
              </div>
          }
          <div className="min-w-0">
            <p className="font-bold text-white">{user?.name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        <p className="text-xs text-gray-700 px-1">Per cambiare nome tocca la tua foto nell'header.</p>
      </Group>

      {/* Tema */}
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
              <label className="block">
                <p className="text-xs text-gray-600 mb-1.5 uppercase tracking-wide font-semibold">Nome</p>
                <div className="flex gap-2">
                  <input value={wsName} onChange={e => { setWsName(e.target.value); setNameSaved(false) }}
                    onKeyDown={e => e.key === 'Enter' && saveWsName()}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    style={{ background: '#252534', border: '1px solid rgba(255,255,255,0.08)' }} />
                  <motion.button whileTap={{ scale: 0.95 }} onClick={saveWsName}
                    disabled={!wsName.trim()}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white min-w-[5rem] disabled:opacity-40"
                    style={{ background: '#6366f1' }}>
                    {nameSaved ? '✓' : 'Salva'}
                  </motion.button>
                </div>
              </label>
              <p className="text-xs text-gray-700 px-1">
                ID: <span className="font-mono text-gray-600 select-all">{wsId}</span>
              </p>
            </div>
          </Group>

          <Group label="Cartelle Archivio">
            <div className="space-y-2">
              {folders.map((f, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={f} onChange={e => { const n = [...folders]; n[i] = e.target.value; setFolders(n); setFoldersSaved(false) }}
                    placeholder={`Cartella ${i + 1}`}
                    className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white placeholder-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    style={{ background: '#252534', border: '1px solid rgba(255,255,255,0.08)' }} />
                  {folders.length > 1 && (
                    <button onClick={() => { setFolders(folders.filter((_, idx) => idx !== i)); setFoldersSaved(false) }}
                      className="w-9 h-9 flex items-center justify-center rounded-xl text-rose-500 flex-shrink-0"
                      style={{ background: 'rgba(239,68,68,0.08)' }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              {folders.length < 8 && (
                <button onClick={() => { setFolders([...folders, '']); setFoldersSaved(false) }}
                  className="w-full py-2.5 text-sm font-medium text-primary-400 rounded-xl"
                  style={{ border: '2px dashed rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.04)' }}>
                  + Aggiungi cartella
                </button>
              )}
              <motion.button whileTap={{ scale: 0.97 }} onClick={saveFolders}
                className="w-full py-2.5 text-sm font-semibold text-white rounded-xl"
                style={{ background: '#6366f1' }}>
                {foldersSaved ? '✓ Salvate' : 'Salva cartelle'}
              </motion.button>
            </div>
          </Group>
        </>
      )}

      {!isAdmin && (
        <div className="px-4 py-3 rounded-2xl text-sm text-amber-400"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          🔒 Solo gli admin possono modificare le impostazioni del workspace.
        </div>
      )}

      {/* Logout */}
      <Group label="Account">
        <motion.button whileTap={{ scale: 0.97 }}
          onClick={async () => { await logout(); navigate('/login') }}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-rose-400"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Esci dall'account
        </motion.button>
      </Group>

      <p className="text-center text-xs text-gray-800 pb-2">Minobron v3.0</p>
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
