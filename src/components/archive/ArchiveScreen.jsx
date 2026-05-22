import { useState, useEffect, useRef } from 'react'
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc,
         serverTimestamp, query, orderBy, getDocs, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { uploadToCloudinary } from '../../utils/cloudinary'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { useLongPress } from '../../hooks/useLongPress'

const DEFAULT_FOLDERS = ['Generale', 'Loghi', 'Documenti', 'Foto', 'Altro']

export default function ArchiveScreen() {
  const { activeWorkspace } = useWorkspace()
  const { user }            = useAuth()
  const wsId                = activeWorkspace?.id
  const fileRef             = useRef(null)
  const seededRef           = useRef(false)

  const [folders, setFolders]   = useState([])
  const [folder, setFolder]     = useState(null)
  const [allFiles, setAllFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview]   = useState(null)

  // Gestione cartelle
  const [folderSheet, setFolderSheet]     = useState(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingFolder, setRenamingFolder] = useState(null) // {id, name}

  // Gestione file
  const [fileSheet, setFileSheet]   = useState(null)
  const [renamingFile, setRenamingFile] = useState(null) // {id, name}

  // PDF blob URL (bypassa Content-Disposition: attachment di Cloudinary raw)
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError]     = useState(false)

  // Fetch PDF come blob quando si apre un'anteprima PDF
  // (bypassa il Content-Disposition: attachment che Cloudinary imposta sui file raw)
  useEffect(() => {
    if (!preview) {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl)
      setPdfBlobUrl(null); setPdfLoading(false); setPdfError(false)
      return
    }
    const isPdf = preview.type?.includes('pdf') || preview.name?.match(/\.pdf$/i)
    if (!isPdf) return

    let blobUrl = null
    let cancelled = false
    setPdfLoading(true); setPdfError(false); setPdfBlobUrl(null)

    fetch(preview.url)
      .then(r => r.blob())
      .then(blob => {
        if (cancelled) return
        blobUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
        setPdfBlobUrl(blobUrl)
        setPdfLoading(false)
      })
      .catch(() => { if (!cancelled) { setPdfError(true); setPdfLoading(false) } })

    return () => { cancelled = true; if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [preview?.url])

  // Reset quando si cambia workspace
  useEffect(() => {
    seededRef.current = false
    setFolder(null)
    setFolders([])
  }, [wsId])

  // Carica cartelle da Firestore, semina defaults se vuoto
  useEffect(() => {
    if (!wsId) return
    const q = query(collection(db, `workspaces/${wsId}/folders`), orderBy('order', 'asc'))
    return onSnapshot(q, snap => {
      if (snap.empty && !seededRef.current) {
        seededRef.current = true
        DEFAULT_FOLDERS.forEach((name, i) =>
          addDoc(collection(db, `workspaces/${wsId}/folders`), {
            name, order: i, createdAt: serverTimestamp()
          })
        )
      } else if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
        setFolders(list)
        setFolder(f => f || list[0]?.name)
      }
    })
  }, [wsId])

  // Carica file della cartella corrente
  useEffect(() => {
    if (!wsId || !folder) return
    const q = query(
      collection(db, `workspaces/${wsId}/files`),
      where('folder', '==', folder)
    )
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      setAllFiles(list)
    })
  }, [wsId, folder])

  // ── Operazioni cartelle ───────────────────────────────────────────────────

  const createFolder = async () => {
    if (!newFolderName.trim()) return
    const maxOrder = folders.reduce((m, f) => Math.max(m, f.order ?? 0), 0)
    await addDoc(collection(db, `workspaces/${wsId}/folders`), {
      name: newFolderName.trim(), order: maxOrder + 1, createdAt: serverTimestamp()
    })
    setNewFolderName('')
    setShowNewFolder(false)
  }

  const saveRenameFolder = async () => {
    if (!renamingFolder?.name?.trim()) return
    const oldName = folderSheet?.name
    const newName = renamingFolder.name.trim()
    if (newName === oldName) { setRenamingFolder(null); setFolderSheet(null); return }
    // 1. Aggiorna documento cartella
    await updateDoc(doc(db, `workspaces/${wsId}/folders/${renamingFolder.id}`), { name: newName })
    // 2. Aggiorna tutti i file che appartengono a questa cartella
    const snap = await getDocs(query(
      collection(db, `workspaces/${wsId}/files`), where('folder', '==', oldName)
    ))
    await Promise.all(snap.docs.map(d =>
      updateDoc(doc(db, `workspaces/${wsId}/files/${d.id}`), { folder: newName })
    ))
    // 3. Aggiorna selezione corrente
    if (folder === oldName) setFolder(newName)
    setRenamingFolder(null)
    setFolderSheet(null)
  }

  const deleteFolder = async (folderId, folderName) => {
    const remaining = folders.filter(f => f.id !== folderId)
    const fallback  = remaining[0]?.name
    // Sposta i file nella prima cartella rimasta
    if (fallback) {
      const snap = await getDocs(query(
        collection(db, `workspaces/${wsId}/files`), where('folder', '==', folderName)
      ))
      await Promise.all(snap.docs.map(d =>
        updateDoc(doc(db, `workspaces/${wsId}/files/${d.id}`), { folder: fallback })
      ))
    }
    await deleteDoc(doc(db, `workspaces/${wsId}/folders/${folderId}`))
    if (folder === folderName) setFolder(fallback || null)
    setFolderSheet(null)
  }

  // ── Operazioni file ───────────────────────────────────────────────────────

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
    setFileSheet(null)
  }

  const saveRenameFile = async () => {
    if (!renamingFile?.name?.trim()) return
    await updateDoc(doc(db, `workspaces/${wsId}/files/${renamingFile.id}`), {
      name: renamingFile.name.trim()
    })
    // Aggiorna preview se il file rinominato è quello aperto
    if (preview?.id === renamingFile.id) {
      setPreview(p => ({ ...p, name: renamingFile.name.trim() }))
    }
    setRenamingFile(null)
    setFileSheet(null)
  }

  // ── Preview helpers ───────────────────────────────────────────────────────

  // Ritorna l'URL da usare nell'iframe per il tipo di file, o null se non supportato
  // PDF escluso: viene aperto nativamente con window.open (Safari iOS non supporta iframe PDF)
  const getPreviewUrl = (file) => {
    const enc = encodeURIComponent(file.url)
    if (file.type?.startsWith('image/')) return null // immagine, non serve iframe
    if (file.type?.includes('word') || file.name?.match(/\.(doc|docx)$/i))
      return `https://view.officeapps.live.com/op/embed.aspx?src=${enc}`
    if (file.type?.includes('sheet') || file.type?.includes('excel') || file.name?.match(/\.(xls|xlsx)$/i))
      return `https://view.officeapps.live.com/op/embed.aspx?src=${enc}`
    return null  // altri formati non supportati in anteprima
  }

  // Scarica il file nella cartella Download tramite fetch+blob (funziona cross-origin)
  const downloadFile = async (url, name) => {
    try {
      const res  = await fetch(url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch {
      window.open(url, '_blank')
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto pb-4">

      {/* Tab cartelle — sfondo usa var(--c-bg) per rispettare il tema */}
      <div className="sticky top-0 z-10 px-4 pt-3 pb-2" style={{ background: 'var(--c-bg)' }}>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide items-center">
          {folders.map(f => (
            <FolderChip key={f.id} folder={f} active={folder === f.name}
              onTap={() => setFolder(f.name)}
              onLongPress={() => setFolderSheet(f)} />
          ))}
          {/* Pulsante nuova cartella */}
          <button onClick={() => { setNewFolderName(''); setShowNewFolder(true) }}
            className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#6b7280' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Pulsante upload */}
        <input ref={fileRef} type="file" multiple className="hidden"
          onChange={e => Array.from(e.target.files).forEach(uploadFile)} />
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => fileRef.current?.click()} disabled={uploading}
          className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl text-sm font-medium disabled:opacity-50"
          style={{ border: '2px dashed rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.05)', color: '#818cf8' }}>
          {uploading
            ? <><div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />Caricamento...</>
            : <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>Carica in {folder}</>
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
              <FileCard key={file.id} file={file} i={i}
                formatSize={formatSize} getFileIcon={getFileIcon}
                onTap={() => setPreview(file)}
                onLongPress={() => setFileSheet(file)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Preview file ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {preview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col" style={{ background: '#000' }}
            onClick={() => setPreview(null)}>

            {/* Top bar — usa style esplicito per non essere sovrascritto in light mode */}
            <div className="flex items-center gap-3 px-4 flex-shrink-0"
              style={{
                paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
                paddingBottom: '0.75rem',
                background: 'rgba(0,0,0,0.85)',
                backdropFilter: 'blur(16px)',
              }}
              onClick={e => e.stopPropagation()}>
              <button onClick={() => setPreview(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.15)' }}>
                <svg className="w-4 h-4" style={{ color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <p className="text-sm font-medium truncate flex-1" style={{ color: 'white' }}>{preview.name}</p>
            </div>

            {/* Contenuto — clic sullo sfondo nero chiude, clic sul contenuto no */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
              {(() => {
                if (preview.type?.startsWith('image/')) {
                  return (
                    <img src={preview.url} alt={preview.name}
                      onClick={e => e.stopPropagation()}
                      className="max-w-full max-h-full object-contain rounded-xl" />
                  )
                }
                // PDF: blob URL con MIME type corretto (bypassa Content-Disposition: attachment)
                if (preview.type?.includes('pdf') || preview.name?.match(/\.pdf$/i)) {
                  if (pdfLoading) return (
                    <div className="flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
                      <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs" style={{ color: '#6b7280' }}>Caricamento PDF…</p>
                    </div>
                  )
                  if (pdfError || !pdfBlobUrl) return (
                    <div className="flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
                      <span className="text-6xl">📄</span>
                      <p className="text-sm text-center px-4" style={{ color: '#9ca3af' }}>{preview.name}</p>
                      <p className="text-xs text-center px-6" style={{ color: '#6b7280' }}>
                        Anteprima non disponibile
                      </p>
                      <a href={preview.url} target="_blank" rel="noreferrer"
                        className="px-6 py-3 rounded-2xl text-sm font-semibold"
                        style={{ background: '#6366f1', color: 'white' }}>
                        Apri PDF
                      </a>
                    </div>
                  )
                  return (
                    <iframe src={pdfBlobUrl} title={preview.name}
                      onClick={e => e.stopPropagation()}
                      className="w-full h-full rounded-xl border-0" />
                  )
                }
                const iframeUrl = getPreviewUrl(preview)
                if (iframeUrl) {
                  return (
                    <iframe src={iframeUrl} title={preview.name}
                      onClick={e => e.stopPropagation()}
                      className="w-full h-full rounded-xl border-0"
                      sandbox="allow-scripts allow-same-origin allow-popups" />
                  )
                }
                // Formato non supportato in anteprima
                return (
                  <div className="flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
                    <span className="text-6xl">{getFileIcon(preview.type)}</span>
                    <p className="text-sm text-center" style={{ color: '#9ca3af' }}>{preview.name}</p>
                    <p className="text-xs text-center" style={{ color: '#6b7280' }}>
                      Formato non visualizzabile — usa Salva per aprirlo
                    </p>
                  </div>
                )
              })()}
            </div>

            {/* Azioni: Salva + Elimina */}
            <div className="flex gap-3 px-4 flex-shrink-0"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
              onClick={e => e.stopPropagation()}>
              <button onClick={() => downloadFile(preview.url, preview.name)}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                style={{ background: '#6366f1', color: 'white' }}>
                ⬇️ Salva
              </button>
              <button onClick={() => deleteFile(preview.id)}
                className="px-4 py-3 rounded-2xl text-sm font-semibold text-rose-400"
                style={{ background: 'rgba(239,68,68,0.1)' }}>
                🗑️
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sheet azioni cartella (long press) ───────────────────────────── */}
      <AnimatePresence>
        {folderSheet && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => { setFolderSheet(null); setRenamingFolder(null) }}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-lg mx-auto rounded-t-3xl p-6 space-y-4"
              style={{ background: 'var(--c-surface2)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
              onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 rounded-full mx-auto" style={{ background: 'rgba(255,255,255,0.1)' }} />

              {renamingFolder ? (
                <>
                  <h3 className="text-sm font-bold text-white">Rinomina cartella</h3>
                  <input autoFocus
                    value={renamingFolder.name}
                    onChange={e => setRenamingFolder(r => ({ ...r, name: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && saveRenameFolder()}
                    className="w-full px-4 py-3 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    style={{ background: 'var(--c-input)', border: '1px solid var(--c-border)' }} />
                  <div className="flex gap-3">
                    <button onClick={() => setRenamingFolder(null)}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-400"
                      style={{ background: 'rgba(255,255,255,0.06)' }}>
                      Annulla
                    </button>
                    <motion.button whileTap={{ scale: 0.97 }} onClick={saveRenameFolder}
                      disabled={!renamingFolder.name.trim()}
                      className="flex-1 py-3 bg-primary-600 text-white font-semibold rounded-xl text-sm disabled:opacity-40">
                      Salva
                    </motion.button>
                  </div>
                </>
              ) : (
                <>
                  <div className="px-1 py-1" style={{ borderBottom: '1px solid var(--c-border)' }}>
                    <p className="font-semibold text-white text-sm pb-3">{folderSheet.name}</p>
                  </div>
                  <button
                    onClick={() => setRenamingFolder({ id: folderSheet.id, name: folderSheet.name })}
                    className="w-full text-left py-3 text-sm font-medium text-gray-200">
                    ✏️  Rinomina
                  </button>
                  {folders.length > 1 && (
                    <button onClick={() => deleteFolder(folderSheet.id, folderSheet.name)}
                      className="w-full text-left py-3 text-sm font-medium text-rose-400">
                      🗑️  Elimina cartella
                    </button>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sheet azioni file (long press) ───────────────────────────────── */}
      <AnimatePresence>
        {fileSheet && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => { setFileSheet(null); setRenamingFile(null) }}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-lg mx-auto rounded-t-3xl p-6 space-y-4"
              style={{ background: 'var(--c-surface2)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
              onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 rounded-full mx-auto" style={{ background: 'rgba(255,255,255,0.1)' }} />

              {renamingFile ? (
                <>
                  <h3 className="text-sm font-bold text-white">Rinomina file</h3>
                  <input autoFocus
                    value={renamingFile.name}
                    onChange={e => setRenamingFile(r => ({ ...r, name: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && saveRenameFile()}
                    autoComplete="off" autoCorrect="off"
                    className="w-full px-4 py-3 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    style={{ background: 'var(--c-input)', border: '1px solid var(--c-border)' }} />
                  <div className="flex gap-3">
                    <button onClick={() => setRenamingFile(null)}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-400"
                      style={{ background: 'rgba(255,255,255,0.06)' }}>
                      Annulla
                    </button>
                    <motion.button whileTap={{ scale: 0.97 }} onClick={saveRenameFile}
                      disabled={!renamingFile.name.trim()}
                      className="flex-1 py-3 bg-primary-600 text-white font-semibold rounded-xl text-sm disabled:opacity-40">
                      Salva
                    </motion.button>
                  </div>
                </>
              ) : (
                <>
                  <div className="py-1" style={{ borderBottom: '1px solid var(--c-border)' }}>
                    <p className="font-semibold text-white text-sm pb-3 truncate">{fileSheet.name}</p>
                  </div>
                  <button onClick={() => setPreview(fileSheet)}
                    className="w-full text-left py-3 text-sm font-medium text-gray-200">
                    👁️  Apri anteprima
                  </button>
                  <button
                    onClick={() => setRenamingFile({ id: fileSheet.id, name: fileSheet.name })}
                    className="w-full text-left py-3 text-sm font-medium text-gray-200">
                    ✏️  Rinomina
                  </button>
                  <button onClick={() => deleteFile(fileSheet.id)}
                    className="w-full text-left py-3 text-sm font-medium text-rose-400">
                    🗑️  Elimina file
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal nuova cartella ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showNewFolder && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={e => e.target === e.currentTarget && setShowNewFolder(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-lg mx-auto rounded-t-3xl p-6 space-y-4"
              style={{ background: 'var(--c-surface2)', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
              onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1 rounded-full mx-auto" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <h3 className="text-base font-bold text-white">Nuova cartella</h3>
              <input autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createFolder()}
                placeholder="Nome cartella"
                autoComplete="off" autoCorrect="on" autoCapitalize="words"
                className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
                style={{ background: 'var(--c-input)', border: '1px solid var(--c-border)' }} />
              <motion.button whileTap={{ scale: 0.97 }} onClick={createFolder}
                disabled={!newFolderName.trim()}
                className="w-full py-3 bg-primary-600 text-white font-semibold rounded-xl text-sm disabled:opacity-40">
                ✓ Crea cartella
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Componenti ────────────────────────────────────────────────────────────────

function FolderChip({ folder, active, onTap, onLongPress }) {
  const lp = useLongPress(onLongPress, onTap)
  return (
    <button {...lp}
      className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors select-none"
      style={{
        background: active ? '#6366f1' : 'rgba(255,255,255,0.06)',
        color:      active ? '#fff'    : '#6b7280',
      }}>
      {folder.name}
    </button>
  )
}

function FileCard({ file, i, formatSize, getFileIcon, onTap, onLongPress }) {
  const lp = useLongPress(onLongPress, onTap)
  return (
    <motion.div {...lp}
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: i * 0.03 }}
      className="rounded-2xl overflow-hidden select-none cursor-pointer"
      style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
      {file.type?.startsWith('image/') ? (
        <div className="aspect-square overflow-hidden" style={{ background: 'var(--c-input)' }}>
          <img src={file.url} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
        </div>
      ) : (
        <div className="aspect-square flex flex-col items-center justify-center gap-2"
          style={{ background: 'rgba(99,102,241,0.06)' }}>
          <span className="text-3xl">{getFileIcon(file.type)}</span>
          <span className="text-xs font-bold text-primary-400 uppercase">
            {file.name?.split('.').pop()}
          </span>
        </div>
      )}
      <div className="p-2.5">
        <p className="text-xs font-medium truncate" style={{ color: 'var(--c-text)' }}>{file.name}</p>
        <p className="text-xs text-gray-600 mt-0.5">
          {formatSize(file.size)}
          {file.createdAt && ` · ${format(file.createdAt.toDate(), 'd MMM', { locale: it })}`}
        </p>
      </div>
    </motion.div>
  )
}
