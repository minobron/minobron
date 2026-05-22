import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, onSnapshot, updateDoc, addDoc, deleteDoc, collection, serverTimestamp, arrayUnion, increment } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { uploadToCloudinary } from '../../utils/cloudinary'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import ConfirmDialog from '../shared/ConfirmDialog'

const PRIORITY = {
  high:   { label: 'Alta',   dot: '#f43f5e', badge: 'rgba(244,63,94,0.15)',  text: '#fb7185' },
  medium: { label: 'Media',  dot: '#fbbf24', badge: 'rgba(251,191,36,0.15)', text: '#fcd34d' },
  low:    { label: 'Bassa',  dot: '#22c55e', badge: 'rgba(34,197,94,0.15)',  text: '#4ade80' },
}

const STATUS = [
  { id: 'todo', label: 'Da fare' },
  { id: 'done', label: 'Fatto'   },
]

const CARD = { background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: '1rem' }
const INPUT_STYLE = { background: 'var(--c-input)', border: '1px solid var(--c-border)' }

export default function TaskDetail() {
  const { taskId }   = useParams()
  const navigate     = useNavigate()
  const { activeWorkspace, members, isAdmin } = useWorkspace()
  const { user }     = useAuth()
  const wsId         = activeWorkspace?.id
  const fileInputRef = useRef()

  const [task, setTask]             = useState(null)
  const [comments, setComments]     = useState([])
  const [newComment, setNewComment] = useState('')
  const [uploading, setUploading]   = useState(false)
  const [commentSheet, setCommentSheet]   = useState(null)   // commento selezionato
  const [editingComment, setEditingComment] = useState(null) // {id, text}
  const [attachPreview, setAttachPreview]   = useState(null) // allegato selezionato
  const [confirmDelete, setConfirmDelete]   = useState(false)

  useEffect(() => {
    if (!wsId || !taskId) return
    const unsub1 = onSnapshot(doc(db, `workspaces/${wsId}/tasks/${taskId}`), d => {
      if (d.exists()) setTask({ id: d.id, ...d.data() })
    })
    const unsub2 = onSnapshot(
      collection(db, `workspaces/${wsId}/tasks/${taskId}/comments`),
      snap => setComments(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0))
      )
    )
    return () => { unsub1(); unsub2() }
  }, [wsId, taskId])

  const update = (data) =>
    updateDoc(doc(db, `workspaces/${wsId}/tasks/${taskId}`), { ...data, updatedAt: serverTimestamp() })

  const addComment = async () => {
    if (!newComment.trim()) return
    await addDoc(collection(db, `workspaces/${wsId}/tasks/${taskId}/comments`), {
      text: newComment.trim(), userId: user.uid, createdAt: serverTimestamp()
    })
    setNewComment('')
  }

  const deleteComment = async (id) => {
    await deleteDoc(doc(db, `workspaces/${wsId}/tasks/${taskId}/comments/${id}`))
    setCommentSheet(null)
  }

  const saveEditComment = async () => {
    if (!editingComment?.text?.trim()) return
    await updateDoc(doc(db, `workspaces/${wsId}/tasks/${taskId}/comments/${editingComment.id}`), {
      text: editingComment.text.trim(), editedAt: serverTimestamp()
    })
    setEditingComment(null)
    setCommentSheet(null)
  }

  const uploadAttachment = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const { url, name, type } = await uploadToCloudinary(file)
      await update({ attachments: arrayUnion({ name, url, type, uploadedBy: user.uid }) })
    } finally { setUploading(false) }
  }

  const deleteTask = async () => {
    if (!task) return
    await deleteDoc(doc(db, `workspaces/${wsId}/tasks/${taskId}`))
    if (task.projectId) {
      await updateDoc(doc(db, `workspaces/${wsId}/projects/${task.projectId}`), { taskCount: increment(-1) })
    }
    navigate(-1)
  }

  const getMember = uid => members.find(m => m.id === uid)

  if (!task) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const p = PRIORITY[task.priority] || PRIORITY.medium

  return (
    <div className="max-w-lg mx-auto px-4 pt-2 pb-10 space-y-4">

      {/* Titolo + completa */}
      <div style={{ ...CARD, padding: '1rem' }}>
        <div className="flex items-start gap-3">
          <button
            onClick={() => update({ status: task.status === 'done' ? 'todo' : 'done' })}
            className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
            style={{
              borderColor: task.status === 'done' ? '#22c55e' : 'rgba(255,255,255,0.2)',
              background:  task.status === 'done' ? '#22c55e' : 'transparent',
            }}>
            {task.status === 'done' && (
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
          <h1 className={`text-lg font-bold leading-snug flex-1 ${task.status === 'done' ? 'line-through text-gray-500' : 'text-white'}`}>
            {task.title}
          </h1>
        </div>
        <div className="flex items-center gap-2 mt-3 ml-9">
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
            style={{ background: p.badge, color: p.text }}>
            {p.label} priorità
          </span>
          {task.dueDate && (() => {
            const d = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate)
            return <span className="text-xs text-gray-500">· Scade {format(d, 'd MMM', { locale: it })}</span>
          })()}
        </div>
      </div>

      {/* Priorità + Stato + Scadenza + Assegnati */}
      <div style={{ ...CARD, padding: '1rem' }} className="space-y-4">
        <SectionLabel>Priorità</SectionLabel>
        <div className="flex gap-2">
          {Object.entries(PRIORITY).map(([k, v]) => (
            <button key={k} onClick={() => update({ priority: k })}
              className="flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: task.priority === k ? v.badge : 'rgba(255,255,255,0.04)',
                color:      task.priority === k ? v.text : '#6b7280',
                border:     task.priority === k ? `1px solid ${v.dot}40` : '1px solid rgba(255,255,255,0.06)',
              }}>
              {v.label}
            </button>
          ))}
        </div>

        <div className="h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />

        <SectionLabel>Stato</SectionLabel>
        <div className="flex gap-2">
          {STATUS.map(s => (
            <button key={s.id} onClick={() => update({ status: s.id })}
              className="flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: task.status === s.id ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                color:      task.status === s.id ? '#818cf8' : '#6b7280',
                border:     task.status === s.id ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.06)',
              }}>
              {s.label}
            </button>
          ))}
        </div>

        <div className="h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />

        <div className="flex items-center gap-3">
          <SectionLabel inline>Scadenza</SectionLabel>
          <input type="date"
            defaultValue={task.dueDate ? format(task.dueDate.toDate?.() || new Date(task.dueDate), 'yyyy-MM-dd') : ''}
            onChange={e => update({ dueDate: e.target.value ? new Date(e.target.value) : null })}
            className="flex-1 text-sm px-3 py-2 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={INPUT_STYLE} />
        </div>

        <div className="h-px" style={{ background: 'rgba(255,255,255,0.05)' }} />

        <SectionLabel>Assegnati</SectionLabel>
        <div className="flex gap-2 flex-wrap">
          {members.map(m => {
            const assigned = (task.assignees || []).includes(m.id)
            return (
              <button key={m.id}
                onClick={() => {
                  const cur = task.assignees || []
                  update({ assignees: assigned ? cur.filter(x => x !== m.id) : [...cur, m.id] })
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  background: assigned ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                  color:      assigned ? '#818cf8' : '#9ca3af',
                  border:     assigned ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.06)',
                }}>
                {m.photoURL
                  ? <img src={m.photoURL} className="w-4 h-4 rounded-full" alt="" />
                  : <div className="w-4 h-4 rounded-full bg-primary-800 flex items-center justify-center text-[10px] font-bold text-primary-300">
                      {m.name?.charAt(0)}
                    </div>
                }
                {m.name?.split(' ')[0]}
              </button>
            )
          })}
        </div>
      </div>

      {/* Allegati */}
      <div style={{ ...CARD, padding: '1rem' }}>
        <SectionLabel>Allegati</SectionLabel>
        <div className="space-y-2 mt-3 mb-3">
          {(task.attachments || []).map((a, i) => (
            <button key={i} onClick={() => setAttachPreview(a)}
              className="flex items-center gap-3 p-2.5 rounded-xl w-full text-left transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}>
              {a.type?.startsWith('image/')
                ? <img src={a.url} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" alt="" />
                : <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(99,102,241,0.15)' }}>
                    <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
              }
              <span className="text-sm text-gray-300 truncate flex-1">{a.name}</span>
              <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
        <input ref={fileInputRef} type="file" className="hidden"
          onChange={e => uploadAttachment(e.target.files[0])} />
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 text-sm font-medium text-primary-400 disabled:opacity-40">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          {uploading ? 'Caricamento...' : 'Aggiungi allegato'}
        </button>
      </div>

      {/* Commenti */}
      <div style={{ ...CARD, padding: '1rem' }}>
        <SectionLabel>Commenti</SectionLabel>
        <div className="space-y-4 mt-3 mb-4">
          {comments.length === 0 && (
            <p className="text-sm text-gray-700 text-center py-2">Nessun commento</p>
          )}
          {comments.map(c => {
            const m = getMember(c.userId)
            const isEditing = editingComment?.id === c.id
            const isOwn = c.userId === user.uid
            return (
              <div key={c.id} className="flex gap-3">
                {m?.photoURL
                  ? <img src={m.photoURL} className="w-7 h-7 rounded-full flex-shrink-0" alt="" />
                  : <div className="w-7 h-7 rounded-full bg-primary-800 flex items-center justify-center text-xs font-bold text-primary-300 flex-shrink-0">
                      {m?.name?.charAt(0) || '?'}
                    </div>
                }
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-0.5">
                    <span className="font-semibold text-gray-400">{m?.name?.split(' ')[0]}</span>
                    {c.createdAt ? ` · ${format(c.createdAt.toDate(), 'd MMM HH:mm', { locale: it })}` : ''}
                    {c.editedAt && <span className="text-gray-700"> · modificato</span>}
                  </p>
                  {isEditing ? (
                    <div className="flex gap-2 mt-1">
                      <input autoFocus
                        value={editingComment.text}
                        onChange={e => setEditingComment(prev => ({ ...prev, text: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') saveEditComment(); if (e.key === 'Escape') setEditingComment(null) }}
                        className="flex-1 px-3 py-1.5 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        style={INPUT_STYLE} />
                      <button onClick={saveEditComment}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold"
                        style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>
                        Salva
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => isOwn && setCommentSheet(c)}
                      className="text-sm text-gray-300 text-left w-full"
                      style={{ cursor: isOwn ? 'pointer' : 'default' }}>
                      {c.text}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-2">
          <input value={newComment} onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addComment()}
            placeholder="Scrivi un commento..."
            autoComplete="off" autoCorrect="on" autoCapitalize="sentences"
            className="flex-1 px-3 py-2.5 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={INPUT_STYLE} />
          <motion.button whileTap={{ scale: 0.9 }} onClick={addComment}
            disabled={!newComment.trim()}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-primary-500 text-white disabled:opacity-40 flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </motion.button>
        </div>
      </div>

      {/* Elimina task — solo creatore o admin */}
      {(isAdmin || task.createdBy === user?.uid) && (
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setConfirmDelete(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-rose-400"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Elimina task
        </motion.button>
      )}

      {/* Dialogo conferma elimina task */}
      <ConfirmDialog
        open={confirmDelete}
        title={`Eliminare "${task?.title}"?`}
        message="Il task verrà eliminato definitivamente."
        confirmLabel="Elimina task"
        onConfirm={deleteTask}
        onCancel={() => setConfirmDelete(false)}
      />

      {/* Sheet azioni commento */}
      <AnimatePresence>
        {commentSheet && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end" style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setCommentSheet(null)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-lg mx-auto rounded-t-3xl overflow-hidden"
              style={{ background: 'var(--c-surface2)', paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
              onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
                <p className="text-xs text-gray-500 line-clamp-2">{commentSheet.text}</p>
              </div>
              <button
                onClick={() => { setEditingComment({ id: commentSheet.id, text: commentSheet.text }); setCommentSheet(null) }}
                className="w-full text-left px-5 py-4 text-sm font-medium text-gray-200">
                ✏️  Modifica
              </button>
              <button onClick={() => deleteComment(commentSheet.id)}
                className="w-full text-left px-5 py-4 text-sm font-medium text-rose-400">
                🗑️  Elimina
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview allegato */}
      <AnimatePresence>
        {attachPreview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col" style={{ background: '#000' }}
            onClick={() => setAttachPreview(null)}>
            {/* Top bar */}
            <div className="flex items-center gap-3 px-4 flex-shrink-0"
              style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))', paddingBottom: '0.75rem', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(16px)' }}
              onClick={e => e.stopPropagation()}>
              <button onClick={() => setAttachPreview(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.15)' }}>
                <svg className="w-4 h-4" style={{ color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <p className="text-sm font-medium truncate flex-1" style={{ color: 'white' }}>{attachPreview.name}</p>
            </div>
            {/* Contenuto — clic sullo sfondo chiude */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
              {attachPreview.type?.startsWith('image/')
                ? <img src={attachPreview.url} alt={attachPreview.name}
                    onClick={e => e.stopPropagation()}
                    className="max-w-full max-h-full object-contain rounded-xl" />
                : attachPreview.type?.includes('pdf')
                  ? <iframe src={attachPreview.url} title={attachPreview.name}
                      onClick={e => e.stopPropagation()}
                      className="w-full h-full rounded-xl border-0" />
                  : <div className="flex flex-col items-center gap-4" onClick={e => e.stopPropagation()}>
                      <span className="text-6xl">📎</span>
                      <p style={{ color: '#9ca3af' }} className="text-sm">{attachPreview.name}</p>
                      <a href={attachPreview.url} target="_blank" rel="noopener noreferrer"
                        className="px-6 py-3 rounded-2xl text-sm font-semibold"
                        style={{ background: '#6366f1', color: 'white' }}>
                        🔗 Apri file
                      </a>
                    </div>
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SectionLabel({ children, inline }) {
  return (
    <p className={`text-xs font-bold text-gray-600 uppercase tracking-widest ${inline ? '' : 'mb-0'}`}>
      {children}
    </p>
  )
}
