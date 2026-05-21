import { useState, useEffect, useRef } from 'react'
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { uploadToCloudinary } from '../../utils/cloudinary'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

const FOLDERS = ['Generale', 'Loghi', 'Documenti', 'Foto', 'Altro']

export default function ArchiveScreen() {
  const { activeWorkspace } = useWorkspace()
  const { user }            = useAuth()
  const wsId                = activeWorkspace?.id
  const fileRef             = useRef()

  const [files, setFiles]         = useState([])
  const [folder, setFolder]       = useState('Generale')
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview]     = useState(null)

  useEffect(() => {
    if (!wsId) return
    const q = query(collection(db, `workspaces/${wsId}/files`), where('folder', '==', folder), orderBy('createdAt', 'desc'))
    return onSnapshot(q, snap => setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
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
    }
  }

  const formatSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="max-w-lg mx-auto px-4 pb-6">
      {/* Cartelle */}
      <div className="flex gap-2 pb-4 overflow-x-auto scrollbar-hide">
        {FOLDERS.map(f => (
          <button key={f} onClick={() => setFolder(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${folder === f ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Upload */}
      <input ref={fileRef} type="file" multiple className="hidden" onChange={e => Array.from(e.target.files).forEach(uploadFile)} />
      <motion.button whileTap={{ scale: 0.97 }} onClick={() => fileRef.current?.click()} disabled={uploading}
        className="w-full flex items-center justify-center gap-3 py-3 mb-4 bg-primary-50 dark:bg-primary-900/20 border-2 border-dashed border-primary-200 dark:border-primary-800 rounded-2xl text-primary-600 dark:text-primary-400 font-medium text-sm disabled:opacity-50">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
        {uploading ? 'Caricamento...' : 'Carica file'}
      </motion.button>

      {/* Griglia file */}
      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500 gap-3">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
          <p className="text-sm">Nessun file in {folder}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {files.map((file, i) => (
            <motion.button key={file.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }} whileTap={{ scale: 0.97 }}
              onClick={() => file.type?.startsWith('image/') ? setPreview(file) : window.open(file.url, '_blank')}
              className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm text-left">
              {file.type?.startsWith('image/') ? (
                <div className="aspect-square bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-square bg-primary-50 dark:bg-primary-900/20 flex flex-col items-center justify-center gap-2">
                  <FileIcon type={file.type} />
                  <span className="text-xs text-primary-500 font-semibold uppercase">{file.name?.split('.').pop()}</span>
                </div>
              )}
              <div className="p-2.5">
                <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{file.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{formatSize(file.size)}</p>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Preview immagine */}
      <AnimatePresence>
        {preview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={() => setPreview(null)}>
            <div className="flex items-center justify-between p-4 text-white">
              <p className="font-medium truncate flex-1">{preview.name}</p>
              <button className="ml-3 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
              <img src={preview.url} alt={preview.name} className="max-w-full max-h-full object-contain rounded-xl" />
            </div>
            <div className="p-4 flex gap-3">
              <a href={preview.url} download={preview.name} target="_blank" rel="noopener noreferrer"
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl text-center text-sm transition-colors">
                Scarica
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FileIcon({ type }) {
  const icons = {
    'application/pdf': '📄',
    'application/msword': '📝',
    'application/vnd.openxmlformats-officedocument': '📊',
    'text/': '📃',
  }
  const icon = Object.entries(icons).find(([k]) => type?.startsWith(k))?.[1] || '📎'
  return <span className="text-4xl">{icon}</span>
}
