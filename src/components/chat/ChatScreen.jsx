import { useState, useEffect, useRef } from 'react'
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, updateDoc, doc, arrayUnion } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { uploadToCloudinary } from '../../utils/cloudinary'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'

export default function ChatScreen() {
  const { activeWorkspace, members } = useWorkspace()
  const { user }   = useAuth()
  const wsId       = activeWorkspace?.id
  const bottomRef  = useRef()
  const fileRef    = useRef()

  const [messages, setMessages]     = useState([])
  const [text, setText]             = useState('')
  const [pinned, setPinned]         = useState([])
  const [showPinned, setShowPinned] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [uploading, setUploading]   = useState(false)

  useEffect(() => {
    if (!wsId) return
    const q = query(collection(db, `workspaces/${wsId}/messages`), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setMessages(msgs)
      setPinned(msgs.filter(m => m.pinned))
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    })
  }, [wsId])

  const handleTextChange = (e) => {
    const val = e.target.value
    setText(val)
    const match = val.match(/@(\w*)$/)
    if (match) {
      setMentionQuery(match[1].toLowerCase())
      setShowMentions(true)
    } else {
      setShowMentions(false)
    }
  }

  const insertMention = (member) => {
    const newText = text.replace(/@\w*$/, `@${member.name?.split(' ')[0]} `)
    setText(newText)
    setShowMentions(false)
  }

  const sendMessage = async () => {
    if (!text.trim() || !wsId) return
    const mentions = members.filter(m => text.includes(`@${m.name?.split(' ')[0]}`)).map(m => m.id)
    await addDoc(collection(db, `workspaces/${wsId}/messages`), {
      text: text.trim(), userId: user.uid, mentions,
      pinned: false, createdAt: serverTimestamp()
    })
    setText('')
  }

  const pinMessage = async (msg) => {
    await updateDoc(doc(db, `workspaces/${wsId}/messages/${msg.id}`), { pinned: !msg.pinned })
    // Salva anche in "in evidenza" workspace
    if (!msg.pinned) {
      await addDoc(collection(db, `workspaces/${wsId}/pins`), {
        title: msg.text.substring(0, 60), content: msg.text, emoji: '💬',
        messageId: msg.id, createdAt: serverTimestamp()
      })
    }
  }

  const uploadFile = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const { url, name, type } = await uploadToCloudinary(file)
      await addDoc(collection(db, `workspaces/${wsId}/messages`), {
        text: '', userId: user.uid, mentions: [],
        attachment: { name, url, type },
        pinned: false, createdAt: serverTimestamp()
      })
    } finally {
      setUploading(false)
    }
  }

  const getMember = uid => members.find(m => m.id === uid)
  const filteredMembers = members.filter(m => m.name?.toLowerCase().includes(mentionQuery))

  const renderText = (text) => {
    if (!text) return null
    const parts = text.split(/(@\w+)/g)
    return parts.map((part, i) => part.startsWith('@')
      ? <span key={i} className="text-primary-500 font-semibold">{part}</span>
      : part
    )
  }

  // Raggruppa messaggi per giorno
  const grouped = messages.reduce((acc, msg) => {
    const date = msg.createdAt ? format(msg.createdAt.toDate(), 'yyyy-MM-dd') : 'today'
    if (!acc[date]) acc[date] = []
    acc[date].push(msg)
    return acc
  }, {})

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] max-w-lg mx-auto">
      {/* In evidenza */}
      {pinned.length > 0 && (
        <button onClick={() => setShowPinned(s => !s)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800">
          <span className="text-sm">📌</span>
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">{pinned.length} messaggio/i in evidenza</span>
          <svg className={`w-4 h-4 text-amber-500 ml-auto transition-transform ${showPinned ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
      )}

      <AnimatePresence>
        {showPinned && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800">
            <div className="p-3 space-y-1">
              {pinned.map(m => {
                const sender = getMember(m.userId)
                return (
                  <div key={m.id} className="text-xs text-gray-700 dark:text-gray-300">
                    <span className="font-semibold text-amber-700 dark:text-amber-400">{sender?.name?.split(' ')[0]}: </span>
                    {m.text}
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messaggi */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {Object.entries(grouped).map(([date, msgs]) => (
          <div key={date}>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
              <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                {format(new Date(date), "EEEE d MMMM", { locale: it })}
              </span>
              <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
            </div>
            {msgs.map((msg, i) => {
              const isMe = msg.userId === user.uid
              const sender = getMember(msg.userId)
              const showAvatar = i === 0 || msgs[i-1]?.userId !== msg.userId
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${!showAvatar ? (isMe ? 'mr-9' : 'ml-9') : ''} mb-1`}
                >
                  {!isMe && showAvatar && (
                    sender?.photoURL
                      ? <img src={sender.photoURL} className="w-7 h-7 rounded-full flex-shrink-0 mt-auto" alt="" />
                      : <div className="w-7 h-7 rounded-full bg-primary-200 dark:bg-primary-800 flex items-center justify-center text-xs font-bold text-primary-700 dark:text-primary-300 flex-shrink-0 mt-auto">{sender?.name?.charAt(0)}</div>
                  )}
                  {!isMe && !showAvatar && <div className="w-7 flex-shrink-0" />}

                  <div className={`group max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                    {showAvatar && !isMe && <p className="text-xs text-gray-400 dark:text-gray-500 mb-1 ml-1">{sender?.name?.split(' ')[0]}</p>}
                    <div className="relative">
                      <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${isMe ? 'bg-primary-500 text-white rounded-br-md' : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm rounded-bl-md'}`}>
                        {msg.attachment ? (
                          msg.attachment.type?.startsWith('image/')
                            ? <img src={msg.attachment.url} className="max-w-full rounded-xl" alt="" />
                            : <a href={msg.attachment.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 underline">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                {msg.attachment.name}
                              </a>
                        ) : renderText(msg.text)}
                      </div>
                      {/* Long press / context menu */}
                      <button
                        onClick={() => pinMessage(msg)}
                        className={`absolute ${isMe ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'} top-0 hidden group-hover:flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-amber-100 hover:text-amber-500 transition-colors mx-1`}
                        title="Metti in evidenza"
                      >
                        📌
                      </button>
                    </div>
                    <p className={`text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 ${isMe ? 'text-right' : 'text-left'} px-1`}>
                      {msg.createdAt ? format(msg.createdAt.toDate(), 'HH:mm') : ''}
                      {msg.pinned && ' · 📌'}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        ))}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 gap-3">
            <span className="text-4xl">👋</span>
            <p className="text-sm">Inizia a scrivere al tuo team!</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* @mentions dropdown */}
      <AnimatePresence>
        {showMentions && filteredMembers.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="mx-4 mb-1 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
            {filteredMembers.map(m => (
              <button key={m.id} onClick={() => insertMention(m)}
                className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                {m.photoURL ? <img src={m.photoURL} className="w-7 h-7 rounded-full" alt="" />
                  : <div className="w-7 h-7 rounded-full bg-primary-200 dark:bg-primary-800 flex items-center justify-center text-xs font-bold text-primary-700 dark:text-primary-300">{m.name?.charAt(0)}</div>}
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{m.name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-4 pb-2 flex items-end gap-2">
        <input ref={fileRef} type="file" className="hidden" onChange={e => uploadFile(e.target.files[0])} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 disabled:opacity-40">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
        </button>
        <div className="flex-1 flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-2.5 gap-2 shadow-sm">
          <input
            value={text}
            onChange={handleTextChange}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
            placeholder="Scrivi un messaggio... (@nome per menzione)"
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
          />
        </div>
        <motion.button whileTap={{ scale: 0.9 }} onClick={sendMessage} disabled={!text.trim()}
          className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-primary-500 text-white disabled:opacity-40 shadow-sm">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
        </motion.button>
      </div>
    </div>
  )
}
