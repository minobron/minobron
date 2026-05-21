import { useState, useEffect, useRef } from 'react'
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, query, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { uploadToCloudinary } from '../../utils/cloudinary'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

const DEFAULT_FOLDERS = ['Generale', 'Loghi', 'Documenti', 'Foto', 'Altro']

export default function ArchiveScreen() {
  const { activeWorkspace } = useWorkspace()
  const { user }            = useAuth()
  const wsId                = activeWorkspace?.id
  const fileRef             = useRef(null)
  const folders             = activeWorkspace?.folders?.length ? activeWorkspace.folders : DEFAULT_FOLDERS

  const [allFiles, setAllFiles]   = useState([])
  const [folder, setFolder]       = useState(folders[0] || 'Generale')
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview]     = useState(null)

  useEffect(() => {
    setFolder(folders[0] || 'Generale')
  }, [wsId]) // eslint-disable-line

  useEffect(() => {
    if (!wsId) return
    const q = query(collection(db, `workspaces/${wsId}/files`), where('folder', '==', folder))
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      setAllFiles(list)
    })
  }, [wsId, folder])

  const uploadFile = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const { url, name, type, size } = await uploadToCloudinary(file)
      await addDoc(collection(db, `workspaces/${wsId}/files`), {
        name, url, type, folder, size,
        uploadedBy: user.uid, createdAt: serverTimestamp()
      })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const deleteFile = async (id) => {
    await deleteDoc(doc(db, `workspaces/${wsId}/files/${id}`))
    setPreview(null)
  }

  const formatSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (type) => {
    if (!type) return '📎'
    if (type.startsWith('image/')) return '🖼️'
    if (type.includes('pdf')) return '📄'
    if (type.includes('word')) return '📝'
    if (type.includes('sheet') || type.includes('excel')) return '📊'
    if (type.includes('presentation') || type.includes('powerpoint')) return '📑'
    if (type.startsWith('video/')) return '🎬'
    if (type.startsWith('audio/')) return '🎵'
    if (type.startsWith('text/')) return '📃'
    return '📎'
  }

  return (
    <div className="max-w-lg mx-auto pb-4">
      {/* Tab cartelle */}
      <div className="sticky top-0 z-10 px-4 pt-3 pb-2" style={{ background: '#0d0d14' }}>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {folders.map(f => (
            <button key={f} onClick={() => setFolder(f)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors"
              style={{
                background: folder === f ? '#6366f1' : 'rgba(255,255,255,0.06)',
                color:      folder === f ? '#fff'    : '#6b7280',
              }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Pulsante upload */}
        <input ref={fileRef} type="file" multiple className="hidden"
          onChange={e => Array.from(e.target.files).forEach(uploadFile)} />
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => fileRef.current?.click()} disabled={uploading}
          className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl text-sm font-medium disabled:opacity-50 transition-colors"
          style={{ border: '2px dashed rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.05)', color: '#818cf8' }}>
          {uploading
            ? <><div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />Caricamento...</>
            : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>Carica in {folder}</>
          }
        </motion.button>

        {/* Griglia file */}
        {allFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-4xl opacity-30">📁</span>
            <p className="text-sm text-gray-700">Nessun file in {folder}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {allFiles.map((file, i) => (
              <motion.button key={file.id}
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => setPreview(file)}
                className="rounded-2xl overflow-hidden text-left"
                style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.06)' }}>
                {file.type?.startsWith('image/') ? (
                  <div className="aspect-square bg-gray-900 overflow-hidden">
                    <img src={file.url} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ) : (
                  <div className="aspect-square flex flex-col items-center justify-center gap-2"
                    style={{ background: 'rgba(99,102,241,0.06)' }}>
                    <span className="text-3xl">{getFileIcon(file.type)}</span>
                    <span className="text-xs font-bold text-primary-400 uppercase">{file.name?.split('.').pop()}</span>
                  </div>
                )}
                <div className="p-2.5">
                  <p className="text-xs font-medium text-gray-300 truncate">{file.name}</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {formatSize(file.size)}
                    {file.createdAt && ` · ${format(file.createdAt.toDate(), 'd MMM', { locale: it })}`}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Preview / dettaglio file */}
      <AnimatePresence>
        {preview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col"
            style={{ background: '#000' }}
            onClick={() => setPreview(null)}>

            {/* Top bar */}
            <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
              style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(16px)' }}
              onClick={e => e.stopPropagation()}>
              <button onClick={() => setPreview(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.1)' }}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <p className="font-medium text-white text-sm truncate flex-1">{preview.name}</p>
            </div>

            {/* Contenuto */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden"
              onClick={e => e.stopPropagation()}>
              {preview.type?.startsWith('image/')
                ? <img src={preview.url} alt={preview.name} className="max-w-full max-h-full object-contain rounded-xl" />
                : <div className="flex flex-col items-center gap-4">
                    <span className="text-6xl">{getFileIcon(preview.type)}</span>
                    <p className="text-gray-400 text-sm text-center">{preview.name}</p>
                  </div>
              }
            </div>

            {/* Azioni: scarica + apri + elimina */}
            <div className="flex gap-3 px-4 pb-4 flex-shrink-0"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
              onClick={e => e.stopPropagation()}>
              <a href={preview.url} download={preview.name}
                className="flex-1 py-3 rounded-2xl text-center text-sm font-semibold text-white"
                style={{ background: '#6366f1' }}
                onClick={e => e.stopPropagation()}>
                ⬇️ Scarica
              </a>
              <a href={preview.url} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-3 rounded-2xl text-center text-sm font-semibold text-gray-300"
                style={{ background: 'rgba(255,255,255,0.1)' }}
                onClick={e => e.stopPropagation()}>
                🔗 Apri
              </a>
              <button onClick={() => deleteFile(preview.id)}
                className="px-4 py-3 rounded-2xl text-sm font-semibold text-rose-400"
                style={{ background: 'rgba(239,68,68,0.1)' }}>
                🗑️
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
