import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, onSnapshot, updateDoc, addDoc, collection, serverTimestamp, arrayUnion, deleteDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { uploadToCloudinary } from '../../utils/cloudinary'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

const PRIORITY = {
  high:   { label: 'Alta',   bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-600 dark:text-rose-400' },
  medium: { label: 'Media',  bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-600 dark:text-amber-400' },
  low:    { label: 'Bassa',  bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-600 dark:text-emerald-400' },
}

export default function TaskDetail() {
  const { taskId }         = useParams()
  const navigate           = useNavigate()
  const { activeWorkspace, members } = useWorkspace()
  const { user }           = useAuth()
  const wsId               = activeWorkspace?.id
  const fileInputRef       = useRef()

  const [task, setTask]       = useState(null)
  const [comments, setComments] = useState([])
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
      snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.createdAt?.seconds - b.createdAt?.seconds))
    )
    return () => { unsub1(); unsub2() }
  }, [wsId, taskId])

  const update = (data) => updateDoc(doc(db, `workspaces/${wsId}/tasks/${taskId}`), { ...data, updatedAt: serverTimestamp() })

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
    } finally {
      setUploading(false)
    }
  }

  const getMember = uid => members.find(m => m.id === uid)

  if (!task) return <div className="flex items-center justify-center h-40 text-gray-400">Caricamento...</div>

  const p = PRIORITY[task.priority] || PRIORITY.medium
  const doneSubtasks = (task.subtasks || []).filter(s => s.done).length

  return (
    <div className="max-w-lg mx-auto px-4 py-2 space-y-5 pb-10">
      {/* Titolo */}
      <div>
        <div className="flex items-start gap-3">
          <button onClick={() => update({ status: task.status === 'done' ? 'todo' : 'done' })} className="mt-1 flex-shrink-0">
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${task.status === 'done' ? 'border-emerald-400 bg-emerald-400' : 'border-gray-300 dark:border-gray-600'}`}>
              {task.status === 'done' && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
            </div>
          </button>
          <h1 className={`text-xl font-bold leading-snug flex-1 ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'}`}>{task.title}</h1>
        </div>
        <span className={`inline-block mt-2 ml-9 text-xs px-2 py-1 rounded-full font-semibold ${p.bg} ${p.text}`}>{p.label} priorità</span>
      </div>

      {/* Priorità selector */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 space-y-3">
        <Row label="Priorità">
          <div className="flex gap-1.5">
            {Object.entries(PRIORITY).map(([k, v]) => (
              <button key={k} onClick={() => update({ priority: k })}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${task.priority === k ? `${v.bg} ${v.text}` : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                {v.label}
              </button>
            ))}
          </div>
        </Row>

        <Row label="Stato">
          <div className="flex gap-1.5">
            {[['todo','Da fare'],['inprogress','In corso'],['done','Fatto']].map(([k, l]) => (
              <button key={k} onClick={() => update({ status: k })}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${task.status === k ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                {l}
              </button>
            ))}
          </div>
        </Row>

        <Row label="Scadenza">
          <input type="date" defaultValue={task.dueDate ? format(task.dueDate.toDate?.() || new Date(task.dueDate), 'yyyy-MM-dd') : ''}
            onChange={e => update({ dueDate: e.target.value ? new Date(e.target.value) : null })}
            className="text-sm text-gray-700 dark:text-gray-300 bg-transparent border-none outline-none" />
        </Row>

        <Row label="Assegnati">
          <div className="flex gap-1.5 flex-wrap">
            {members.map(m => (
              <button key={m.id} onClick={() => {
                const cur = task.assignees || []
                update({ assignees: cur.includes(m.id) ? cur.filter(x => x !== m.id) : [...cur, m.id] })
              }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${(task.assignees||[]).includes(m.id) ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'}`}>
                {m.photoURL ? <img src={m.photoURL} className="w-4 h-4 rounded-full" alt="" /> : <span className="w-4 h-4 rounded-full bg-primary-200 text-primary-700 flex items-center justify-center text-xs font-bold">{m.name?.charAt(0)}</span>}
                {m.name?.split(' ')[0]}
              </button>
            ))}
          </div>
        </Row>
      </div>

      {/* Subtask */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Subtask</h3>
          {task.subtasks?.length > 0 && (
            <span className="text-xs text-gray-400">{doneSubtasks}/{task.subtasks.length}</span>
          )}
        </div>
        <div className="space-y-2 mb-3">
          {(task.subtasks || []).map(s => (
            <button key={s.id} onClick={() => toggleSubtask(s)} className="flex items-center gap-3 w-full text-left">
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${s.done ? 'border-primary-400 bg-primary-400' : 'border-gray-300 dark:border-gray-600'}`}>
                {s.done && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span className={`text-sm ${s.done ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>{s.title}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newSubtask} onChange={e => setNewSubtask(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSubtask()}
            placeholder="Aggiungi subtask..."
            className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400" />
          <button onClick={addSubtask} className="p-2 rounded-xl bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>
      </div>

      {/* Allegati */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-3">Allegati</h3>
        <div className="space-y-2 mb-3">
          {(task.attachments || []).map((a, i) => (
            <a key={i} href={a.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-900 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              {a.type?.startsWith('image/') ? <img src={a.url} className="w-10 h-10 rounded-lg object-cover" alt="" />
                : <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  </div>
              }
              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{a.name}</span>
            </a>
          ))}
        </div>
        <input ref={fileInputRef} type="file" className="hidden" onChange={e => uploadAttachment(e.target.files[0])} />
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
          className="flex items-center gap-2 text-sm text-primary-500 font-medium disabled:opacity-40">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
          {uploading ? 'Caricamento...' : 'Aggiungi allegato'}
        </button>
      </div>

      {/* Commenti */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-3">Commenti</h3>
        <div className="space-y-3 mb-3">
          {comments.map(c => {
            const m = getMember(c.userId)
            return (
              <div key={c.id} className="flex gap-3">
                {m?.photoURL ? <img src={m.photoURL} className="w-7 h-7 rounded-full flex-shrink-0" alt="" />
                  : <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-xs font-bold text-primary-700 dark:text-primary-300 flex-shrink-0">{m?.name?.charAt(0)}</div>}
                <div>
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">{m?.name?.split(' ')[0]} · {c.createdAt ? format(c.createdAt.toDate(), 'd MMM HH:mm', { locale: it }) : ''}</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200 mt-0.5">{c.text}</p>
                </div>
              </div>
            )
          })}
          {comments.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">Nessun commento</p>}
        </div>
        <div className="flex gap-2">
          <input value={newComment} onChange={e => setNewComment(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addComment()}
            placeholder="Scrivi un commento..."
            className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400" />
          <button onClick={addComment} className="p-2 rounded-xl bg-primary-500 text-white">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 dark:text-gray-500 w-20 flex-shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}
