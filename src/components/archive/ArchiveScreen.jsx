import { useState, useEffect, useRef } from 'react'
import { collection, onSnapshot, addDoc, deleteDoc, doc, updateDoc,
         serverTimestamp, query, orderBy, getDocs, where, writeBatch } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { uploadToCloudinary } from '../../utils/cloudinary'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { format, differenceInDays } from 'date-fns'
import { it } from 'date-fns/locale'
import { useLongPress } from '../../hooks/useLongPress'
import ConfirmDialog from '../shared/ConfirmDialog'

const DEFAULT_FOLDERS = ['Generale', 'Loghi', 'Documenti', 'Foto', 'Altro']
const TRASH_DAYS = 30  // giorni prima dell'auto-eliminazione

export default function ArchiveScreen() {
  const { activeWorkspace, isAdmin } = useWorkspace()
  const { user }            = useAuth()
  const wsId                = activeWorkspace?.id
  const fileRef             = useRef(null)
  const seededRef           = useRef(false)

  const [folders, setFolders]   = useState([])
  const [folder, setFolder]     = useState(null)
  const [allFiles, setAllFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview]   = useState(null)

  // Vista cestino
  const [showTrash, setShowTrash] = useState(false)
  const [trashFiles, setTrashFiles] = useState([])

  // Gestione cartelle
  const [folderSheet, setFolderSheet]     = useState(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingFolder, setRenamingFolder] = useState(null)

  // Gestione file
  const [fileSheet, setFileSheet]   = useState(null)
  const [renamingFile, setRenamingFile] = useState(null)

  // Conferme elimina
  const [confirmDeleteFile, setConfirmDeleteFile]     = useState(null)
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState(null)
  const [confirmEmptyTrash, setConfirmEmptyTrash]     = useState(false)

  // PDF blob URL
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfError, setPdfError]     = useState(false)

  // Fetch PDF come blob
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

  // Reset workspace
  useEffect(() => {
    seededRef.current = false
    setFolder(null)
    setFolders([])
    setShowTrash(false)
  }, [wsId])

  // Carica cartelle
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

  // Carica file cartella corrente
  useEffect(() => {
    if (!wsId || !folder || showTrash) return
    const q = query(
      collection(db, `workspaces/${wsId}/files`),
      where('folder', '==', folder)
    )
    return onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      setAllFiles(list)
    })
  }, [wsId, folder, showTrash])

  // Carica cestino + auto-pulizia 30 giorni
  useEffect(() => {
    if (!wsId) return
    const q = query(collection(db, `workspaces/${wsId}/trash`), orderBy('deletedAt', 'desc'))
    return onSnapshot(q, async snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setTrashFiles(list)

      // Auto-elimina file più vecchi di TRASH_DAYS
      const now = new Date()
      const toDelete = list.filter(f => {
        const deleted = f.deletedAt?.toDate ? f.deletedAt.toDate() : new Date(f.deletedAt)
        return differenceInDays(now, deleted) >= TRASH_DAYS
      })
      if (toDelete.length > 0) {
        const batch = writeBatch(db)
        toDelete.forEach(f => batch.delete(doc(db, `workspaces/${wsId}/trash/${f.id}`)))
        await batch.commit()
      }
    })
  }, [wsId])

  // ── Operazioni cartelle (solo admin) ─────────────────────────────────────

  const createFolder = async () => {
    if (!newFolderName.trim() || !isAdmin) return
    const maxOrder = folders.reduce((m, f) => Math.max(m, f.order ?? 0), 0)
    await addDoc(collection(db, `workspaces/${wsId}/folders`), {
      name: newFolderName.trim(), order: maxOrder + 1, createdAt: serverTimestamp()
    })
    setNewFolderName('')
    setShowNewFolder(false)
  }

  const saveRenameFolder = async () => {
    if (!renamingFolder?.name?.trim() || !isAdmin) return
    const oldName = folderSheet?.name
    const newName = renamingFolder.name.trim()
    if (newName === oldName) { setRenamingFolder(null); setFolderSheet(null); return }
    await updateDoc(doc(db, `workspaces/${wsId}/folders/${renamingFolder.id}`), { name: newName })
    const snap = await getDocs(query(
      collection(db, `workspaces/${wsId}/files`), where('folder', '==', oldName)
    ))
    await Promise.all(snap.docs.map(d =>
      updateDoc(doc(db, `workspaces/${wsId}/files/${d.id}`), { folder: newName })
    ))
    if (folder === oldName) setFolder(newName)
    setRenamingFolder(null)
    setFolderSheet(null)
  }

  const doDeleteFolder = async () => {
    if (!confirmDeleteFolder || !isAdmin) return
    const { id: folderId, name: folderName } = confirmDeleteFolder
    const remaining = folders.filter(f => f.id !== folderId)
    const fallback  = remaining[0]?.name
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
    setConfirmDeleteFolder(null)
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
      // Log attività: file caricato
      await addDoc(collection(db, `workspaces/${wsId}/activity`), {
        userId: user.uid,
        text: `${user.name} ha caricato "${name}" in ${folder}`,
        createdAt: serverTimestamp()
      })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // Soft delete: sposta nel cestino invece di eliminare
  const deleteFile = async (file) => {
    // Copia nel cestino
    await addDoc(collection(db, `workspaces/${wsId}/trash`), {
      ...file,
      originalFolder: file.folder || folder,
      deletedAt: serverTimestamp(),
      deletedBy: user.uid,
      deletedByName: user.name || user.email,
    })
    // Rimuovi dai file normali
    await deleteDoc(doc(db, `workspaces/${wsId}/files/${file.id}`))
    setPreview(null)
    setFileSheet(null)
    setConfirmDeleteFile(null)
  }

  const restoreFile = async (trashFile) => {
    const { id, deletedAt, deletedBy, deletedByName, originalFolder, ...fileData } = trashFile
    await addDoc(collection(db, `workspaces/${wsId}/files`), {
      ...fileData,
      folder: originalFolder || folders[0]?.name || 'Generale',
      restoredAt: serverTimestamp(),
    })
    await deleteDoc(doc(db, `workspaces/${wsId}/trash/${id}`))
  }

  const permanentDelete = async (trashFile) => {
    await deleteDoc(doc(db, `workspaces/${wsId}/trash/${trashFile.id}`))
  }

  const emptyTrash = async () => {
    const batch = writeBatch(db)
    trashFiles.forEach(f => batch.delete(doc(db, `workspaces/${wsId}/trash/${f.id}`)))
    await batch.commit()
    setConfirmEmptyTrash(false)
  }

  const saveRenameFile = async () => {
    if (!renamingFile?.name?.trim()) return
    await updateDoc(doc(db, `workspaces/${wsId}/files/${renamingFile.id}`), {
      name: renamingFile.name.trim()
    })
    if (preview?.id === renamingFile.id) {
      setPreview(p => ({ ...p, name: renamingFile.name.trim() }))
    }
    setRenamingFile(null)
    setFileSheet(null)
  }

  // ── Preview helpers ───────────────────────────────────────────────────────

  const getPreviewUrl = (file) => {
    const enc = encodeURIComponent(file.url)
    if (file.type?.startsWith('image/')) return null
    if (file.type?.includes('word') || file.name?.match(/\.(doc|docx)$/i))
      return `https://view.officeapps.live.com/op/embed.aspx?src=${enc}`
    if (file.type?.includes('sheet') || file.type?.includes('excel') || file.name?.match(/\.(xls|xlsx)$/i))
      return `https://view.officeapps.live.com/op/embed.aspx?src=${enc}`
    return null
  }

  const downloadFile = async (url, name) => {
    try {
      const res  = await fetch(url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl; a.download = name
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(blobUrl)
    } catch { window.open(url, '_blank') }
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

  const daysUntilAutoDelete = (deletedAt) => {
    if (!deletedAt) return TRASH_DAYS
    const d = deletedAt.toDate ? deletedAt.toDate() : new Date(deletedAt)
    return Math.max(0, TRASH_DAYS - differenceInDays(new Date(), d))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-lg mx-auto pb-4">

      {/* Tab cartelle + pulsante cestino */}
      <div className="sticky top-0 z-10 px-4 pt-3 pb-2" style={{ background: 'var(--c-bg)' }}>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide items-center">
          {!showTrash && folders.map(f => (
            <FolderChip key={f.id} folder={f} active={folder === f.name}
              onTap={() => setFolder(f.name)}
              onLongPress={() => isAdmin && setFolderSheet(f)} />
          ))}
          {showTrash && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: '#6366f1', color: '#fff' }}>
              🗑️ Cestino
            </div>
          )}

          {/* Nuova cartella — solo admin */}
          {isAdmin && !showTrash && (
            <button onClick={() => { setNewFolderName(''); setShowNewFolder(true) }}
              className="w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#6b7280' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}

          {/* Pulsante Cestino */}
          <button onClick={() => setShowTrash(s => !s)}
            className="ml-auto w-7 h-7 flex items-center justify-center rounded-full flex-shrink-0 relative"
            style={{ background: showTrash ? '#6366f1' : 'rgba(255,255,255,0.06)', color: showTrash ? '#fff' : '#6b7280' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {trashFiles.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center"
                style={{ background: '#ef4444', color: 'white' }}>
                {trashFiles.length > 9 ? '9+' : trashFiles.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Vista Cestino ────────────────────────────────────────────────── */}
      {showTrash ? (
        <div className="px-4 space-y-3">
          {trashFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <span className="text-4xl opacity-30">🗑️</span>
              <p className="text-sm text-gray-700">Il cestino è vuoto</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-1">
                <p className="text-xs text-gray-600">
                  {trashFiles.length} {trashFiles.length === 1 ? 'file' : 'file'} — eliminati automaticamente dopo {TRASH_DAYS} giorni
                </p>
                <button onClick={() => setConfirmEmptyTrash(true)}
                  className="text-xs text-rose-400 font-medium">
                  Svuota
                </button>
              </div>
              {trashFiles.map((file, i) => {
                const days = daysUntilAutoDelete(file.deletedAt)
                return (
                  <motion.div key={file.id}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3 p-3 rounded-2xl"
                    style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(99,102,241,0.1)' }}>
                      {file.type?.startsWith('image/')
                        ? <img src={file.url} className="w-10 h-10 rounded-xl object-cover" alt="" />
                        : <span className="text-xl">{getFileIcon(file.type)}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--c-text)' }}>{file.name}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">
                        Eliminato da {file.deletedByName || '—'} · {days}g rimasti
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => restoreFile(file)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-primary-400"
                        style={{ background: 'rgba(99,102,241,0.12)' }}>
                        Ripristina
                      </button>
                      <button onClick={() => permanentDelete(file)}
                        className="w-8 h-8 flex items-center justify-center rounded-xl text-rose-400"
                        style={{ background: 'rgba(239,68,68,0.08)' }}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </motion.div>
                )
              })}
            </>
          )}
        </div>
      ) : (
        // ── Vista normale ────────────────────────────────────────────────
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
      )}

      {/* ── Preview file ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {preview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col" style={{ background: '#000' }}
            onClick={() => setPreview(null)}>

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

            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
              {(() => {
                if (preview.type?.startsWith('image/')) {
                  return (
                    <img src={preview.url} alt={preview.name}
                      onClick={e => e.stopPropagation()}
                      className="max-w-full max-h-full object-contain rounded-xl" />
                  )
                }
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

            {/* Azioni: Salva + Cestino */}
            <div className="flex gap-3 px-4 flex-shrink-0"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
              onClick={e => e.stopPropagation()}>
              <button onClick={() => downloadFile(preview.url, preview.name)}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                style={{ background: '#6366f1', color: 'white' }}>
                ⬇️ Salva
              </button>
              <button onClick={() => setConfirmDeleteFile(preview)}
                className="px-4 py-3 rounded-2xl text-sm font-semibold text-rose-400"
                style={{ background: 'rgba(239,68,68,0.1)' }}>
                🗑️
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sheet azioni cartella (long press, solo admin) ────────────────── */}
      <AnimatePresence>
        {folderSheet && isAdmin && (
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
                    <button onClick={() => { setConfirmDeleteFolder(folderSheet); setFolderSheet(null) }}
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
                  <button onClick={() => { setPreview(fileSheet); setFileSheet(null) }}
                    className="w-full text-left py-3 text-sm font-medium text-gray-200">
                    👁️  Apri anteprima
                  </button>
                  <button
                    onClick={() => setRenamingFile({ id: fileSheet.id, name: fileSheet.name })}
                    className="w-full text-left py-3 text-sm font-medium text-gray-200">
                    ✏️  Rinomina
                  </button>
                  <button onClick={() => { setConfirmDeleteFile(fileSheet); setFileSheet(null) }}
                    className="w-full text-left py-3 text-sm font-medium text-rose-400">
                    🗑️  Sposta nel cestino
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal nuova cartella ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showNewFolder && isAdmin && (
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

      {/* ── Dialoghi di conferma ─────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!confirmDeleteFile}
        title={`Spostare nel cestino "${confirmDeleteFile?.name}"?`}
        message={`Il file sarà recuperabile dal cestino per ${TRASH_DAYS} giorni, poi verrà eliminato definitivamente.`}
        confirmLabel="Sposta nel cestino"
        onConfirm={() => deleteFile(confirmDeleteFile)}
        onCancel={() => setConfirmDeleteFile(null)}
      />

      <ConfirmDialog
        open={!!confirmDeleteFolder}
        title={`Eliminare la cartella "${confirmDeleteFolder?.name}"?`}
        message="I file al suo interno saranno spostati nella prima cartella disponibile."
        confirmLabel="Elimina cartella"
        onConfirm={doDeleteFolder}
        onCancel={() => setConfirmDeleteFolder(null)}
      />

      <ConfirmDialog
        open={confirmEmptyTrash}
        title="Svuotare il cestino?"
        message={`${trashFiles.length} file saranno eliminati definitivamente e non potranno essere recuperati.`}
        confirmLabel="Svuota cestino"
        onConfirm={emptyTrash}
        onCancel={() => setConfirmEmptyTrash(false)}
      />
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
