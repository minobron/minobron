import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, onSnapshot, updateDoc, addDoc, collection, serverTimestamp, arrayUnion } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { uploadToCloudinary } from '../../utils/cloudinary'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

const PRIORITY = {
  high:   { label: 'Alta',   dot: '#f43f5e', badge: 'rgba(244,63,94,0.15)',  text: '#fb7185' },
  medium: { label: 'Media',  dot: '#fbbf24', badge: 'rgba(251,191,36,0.15)', text: '#fcd34d' },
  low:    { label: 'Bassa',  dot: '#22c55e', badge: 'rgba(34,197,94,0.15)',  text: '#4ade80' },
}

const STATUS = [
  { id: 'todo',       label: 'Da fare'  },
  { id: 'inprogress', label: 'In corso' },
  { id: 'done',       label: 'Fatto'    },
]

const CARD = { background: '#111118', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1rem' }
const INPUT_STYLE = { background: '#252534', border: '1px solid rgba(255,255,255,0.08)' }

export default function TaskDetail() {
  const { taskId }   = useParams()
  const navigate     = useNavigate()
  const { activeWorkspace, members } = useWorkspace()
  const { user }     = useAuth()
  const wsId         = activeWorkspace?.id
  const fileInputRef = useRef()

  const [task, setTask]             = useState(null)
  const [comments, setComments]     = useState([])
  const [newComment, setNewComment] = useState('')
  const [newSubtask, setNewSubtask] = useState('')
  const [uploading, setUploading]   = useState(false)

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

  const addSubtask = async () => {
    if (!newSubtask.trim()) return
    await update({ subtasks: arrayUnion({ id: Date.now().toString(), title: newSubtask.trim(), done: false }) })
    setNewSubtask('')
  }

  const toggleSubtask = async (subtask) => {
    const updated = (task.subtasks || []).map(s => s.id === subtask.id ? { ...s, done: !s.done } : s)
    await update({ subtasks: updated })
  }

  const uploadAttachment = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const { url, name, type } = await uploadToCloudinary(file)
      await update({ attachments: arrayUnion({ name, url, type, uploadedBy: user.uid }) })
    } finally { setUploading(false) }
  }

  const getMember = uid => members.find(m => m.id === uid)

  if (!task) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const p = PRIORITY[task.priority] || PRIORITY.medium
  const doneCount = (task.subtasks || []).filter(s => s.done).length
  const totalCount = (task.subtasks || []).length

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
            return (
              <span className="text-xs text-gray-500">
                · Scade {format(d, 'd MMM', { locale: it })}
              </span>
            )
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

      {/* Subtask */}
      <div style={{ ...CARD, padding: '1rem' }}>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Subtask</SectionLabel>
          {totalCount > 0 && (
            <span className="text-xs text-gray-600">{doneCount}/{totalCount}</span>
          )}
        </div>
        {totalCount > 0 && (
          <div className="w-full rounded-full h-1 mb-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-1 rounded-full bg-emerald-500 transition-all"
              style={{ width: `${(doneCount / totalCount) * 100}%` }} />
          </div>
        )}
        <div className="space-y-2 mb-3">
          {(task.subtasks || []).map(s => (
            <button key={s.id} onClick={() => toggleSubtask(s)}
              className="flex items-center gap-3 w-full text-left py-0.5">
              <div className="w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  borderColor: s.done ? '#6366f1' : 'rgba(255,255,255,0.2)',
                  background:  s.done ? '#6366f1' : 'transparent',
                }}>
                {s.done && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className={`text-sm ${s.done ? 'line-through text-gray-600' : 'text-gray-300'}`}>{s.title}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newSubtask} onChange={e => setNewSubtask(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSubtask()}
            placeholder="Aggiungi subtask..."
            className="flex-1 px-3 py-2 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={INPUT_STYLE} />
          <button onClick={addSubtask}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Allegati */}
      <div style={{ ...CARD, padding: '1rem' }}>
        <SectionLabel>Allegati</SectionLabel>
        <div className="space-y-2 mt-3 mb-3">
          {(task.attachments || []).map((a, i) => (
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-2.5 rounded-xl transition-colors"
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
              <span className="text-sm text-gray-300 truncate">{a.name}</span>
            </a>
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
            return (
              <div key={c.id} className="flex gap-3">
                {m?.photoURL
                  ? <img src={m.photoURL} className="w-7 h-7 rounded-full flex-shrink-0" alt="" />
                  : <div className="w-7 h-7 rounded-full bg-primary-800 flex items-center justify-center text-xs font-bold text-primary-300 flex-shrink-0">
                      {m?.name?.charAt(0) || '?'}
                    </div>
                }
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">
                    <span className="font-semibold text-gray-400">{m?.name?.split(' ')[0]}</span>
                    {c.createdAt ? ` · ${format(c.createdAt.toDate(), 'd MMM HH:mm', { locale: it })}` : ''}
                  </p>
                  <p className="text-sm text-gray-300">{c.text}</p>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex gap-2">
          <input value={newComment} onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addComment()}
            placeholder="Scrivi un commento..."
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
