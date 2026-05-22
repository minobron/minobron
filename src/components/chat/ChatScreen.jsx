import { useState, useEffect, useRef } from 'react'
import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, updateDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useWorkspace } from '../../context/WorkspaceContext'
import { useAuth } from '../../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { useLongPress } from '../../hooks/useLongPress'

export default function ChatScreen() {
  const { activeWorkspace, members } = useWorkspace()
  const { user }   = useAuth()
  const wsId       = activeWorkspace?.id
  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)

  const [messages, setMessages]         = useState([])
  const [text, setText]                 = useState('')
  const [pinned, setPinned]             = useState([])
  const [showPinned, setShowPinned]     = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMentions, setShowMentions] = useState(false)
  const [replyTo, setReplyTo]           = useState(null) // messaggio citato

  useEffect(() => {
    if (!wsId) return
    const q = query(collection(db, `workspaces/${wsId}/messages`), orderBy('createdAt', 'asc'))
    return onSnapshot(q, snap => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setMessages(msgs)
      setPinned(msgs.filter(m => m.pinned))
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }))
    })
  }, [wsId])

  // Scroll quando la tastiera appare
  useEffect(() => {
    const onResize = () => {
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'instant' }))
    }
    window.visualViewport?.addEventListener('resize', onResize)
    return () => window.visualViewport?.removeEventListener('resize', onResize)
  }, [])

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
    setText(text.replace(/@\w*$/, `@${member.name?.split(' ')[0]} `))
    setShowMentions(false)
    inputRef.current?.focus()
  }

  const sendMessage = async () => {
    if (!text.trim() || !wsId) return
    const msg = text.trim()
    setText('')
    setShowMentions(false)
    const mentions = members.filter(m => msg.includes(`@${m.name?.split(' ')[0]}`)).map(m => m.id)
    const payload = {
      text: msg, userId: user.uid, userName: user.name || user.email,
      mentions, pinned: false, createdAt: serverTimestamp()
    }
    if (replyTo) {
      payload.replyTo = {
        id: replyTo.id,
        text: replyTo.text?.substring(0, 80),
        userName: replyTo.userName || getMember(replyTo.userId)?.name || 'Utente',
      }
    }
    setReplyTo(null)
    await addDoc(collection(db, `workspaces/${wsId}/messages`), payload)
  }

  const pinMessage = async (msg) => {
    const next = !msg.pinned
    await updateDoc(doc(db, `workspaces/${wsId}/messages/${msg.id}`), { pinned: next })
    if (next) {
      await addDoc(collection(db, `workspaces/${wsId}/pins`), {
        title: msg.text.substring(0, 60), content: msg.text,
        emoji: '💬', messageId: msg.id, createdAt: serverTimestamp()
      })
    }
  }

  const getMember  = uid => members.find(m => m.id === uid)
  const filteredMembers = members.filter(m => m.name?.toLowerCase().includes(mentionQuery))

  const renderText = (t) => {
    if (!t) return null
    return t.split(/(@\w+)/g).map((part, i) =>
      part.startsWith('@')
        ? <span key={i} className="text-primary-300 font-semibold">{part}</span>
        : part
    )
  }

  // Raggruppa messaggi per giorno — gestisce createdAt null (messaggio in volo)
  const grouped = messages.reduce((acc, msg) => {
    const key = msg.createdAt
      ? format(msg.createdAt.toDate(), 'yyyy-MM-dd')
      : format(new Date(), 'yyyy-MM-dd')
    if (!acc[key]) acc[key] = []
    acc[key].push(msg)
    return acc
  }, {})

  return (
    <div className="flex flex-col max-w-lg mx-auto"
      style={{ height: 'calc(100dvh - var(--header-h) - var(--bottomnav-h))' }}>

      {/* Banner messaggi in evidenza */}
      {pinned.length > 0 && (
        <button onClick={() => setShowPinned(s => !s)}
          className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0"
          style={{ background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.15)' }}>
          <span className="text-sm">📌</span>
          <span className="text-xs font-semibold text-amber-400 flex-1">
            {pinned.length} in evidenza
          </span>
          <svg className={`w-4 h-4 text-amber-500 transition-transform ${showPinned ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      <AnimatePresence>
        {showPinned && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden flex-shrink-0"
            style={{ background: 'rgba(245,158,11,0.06)', borderBottom: '1px solid rgba(245,158,11,0.12)' }}>
            <div className="p-3 space-y-1">
              {pinned.map(m => {
                const sender = getMember(m.userId)
                return (
                  <div key={m.id} className="text-xs text-gray-300">
                    <span className="font-semibold text-amber-400">{sender?.name?.split(' ')[0] || m.userName}: </span>
                    {m.text}
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lista messaggi */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 overscroll-contain">
        {Object.entries(grouped).map(([date, msgs]) => (
          <div key={date}>
            {/* Separatore data */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <span className="text-[10px] text-gray-600 capitalize font-medium px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {format(new Date(date + 'T12:00:00'), 'EEEE d MMMM', { locale: it })}
              </span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            </div>

            {msgs.map((msg, i) => {
              const isMe       = msg.userId === user.uid
              const sender     = getMember(msg.userId)
              const senderName = msg.userName || sender?.name || 'Utente'
              const showAvatar = i === 0 || msgs[i - 1]?.userId !== msg.userId

              return (
                <MessageBubble key={msg.id} msg={msg} isMe={isMe}
                  senderName={senderName} sender={sender}
                  showAvatar={showAvatar}
                  onLongPress={() => setReplyTo(msg)}
                  onPin={() => pinMessage(msg)}
                  renderText={renderText}
                />
              )
            })}
          </div>
        ))}

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-20">
            <span className="text-4xl opacity-30">👋</span>
            <p className="text-sm text-gray-700">Inizia a scrivere al tuo team!</p>
          </div>
        )}
        <div ref={bottomRef} className="h-2" />
      </div>

      {/* @mentions dropdown */}
      <AnimatePresence>
        {showMentions && filteredMembers.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="mx-4 mb-1 rounded-2xl overflow-hidden flex-shrink-0"
            style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            {filteredMembers.map(m => (
              <button key={m.id}
                onMouseDown={e => { e.preventDefault(); insertMention(m) }}
                onTouchStart={e => { e.preventDefault(); insertMention(m) }}
                className="flex items-center gap-3 w-full px-4 py-3 transition-colors"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {m.photoURL
                  ? <img src={m.photoURL} className="w-7 h-7 rounded-full" alt="" />
                  : <div className="w-7 h-7 rounded-full bg-primary-800 flex items-center justify-center text-xs font-bold text-primary-300">
                      {m.name?.charAt(0)}
                    </div>
                }
                <span className="text-sm font-medium text-gray-200">{m.name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Banner reply */}
      <AnimatePresence>
        {replyTo && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="mx-3 mb-1 px-3 py-2 rounded-xl flex items-center gap-2 flex-shrink-0"
            style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
            <div className="w-1 rounded-full self-stretch bg-primary-400" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-primary-400">
                {replyTo.userName || getMember(replyTo.userId)?.name || 'Utente'}
              </p>
              <p className="text-xs text-gray-400 truncate">{replyTo.text}</p>
            </div>
            <button onClick={() => setReplyTo(null)} className="text-gray-500 flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div className="px-3 py-2.5 flex items-center gap-2 flex-shrink-0"
        style={{ background: 'var(--c-bg)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>

        <div className="flex-1 flex items-center rounded-2xl px-4 py-2.5"
          style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
          <input ref={inputRef} value={text} onChange={handleTextChange}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="Scrivi un messaggio…"
            autoComplete="off"
            autoCorrect="on"
            autoCapitalize="sentences"
            spellCheck="true"
            data-form-type="other"
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none" />
        </div>

        <motion.button whileTap={{ scale: 0.9 }} onClick={sendMessage} disabled={!text.trim()}
          className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-primary-500 text-white disabled:opacity-40">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </motion.button>
      </div>
    </div>
  )
}

function MessageBubble({ msg, isMe, senderName, sender, showAvatar, onLongPress, onPin, renderText }) {
  const lp = useLongPress(onLongPress)

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={`flex gap-2 mb-1 ${isMe ? 'flex-row-reverse' : 'flex-row'} ${!showAvatar ? (isMe ? 'mr-9' : 'ml-9') : ''}`}
      {...lp}>

      {/* Avatar */}
      {!isMe && showAvatar && (
        sender?.photoURL
          ? <img src={sender.photoURL} className="w-7 h-7 rounded-full flex-shrink-0 mt-auto" alt="" />
          : <div className="w-7 h-7 rounded-full bg-primary-800 flex items-center justify-center text-xs font-bold text-primary-300 flex-shrink-0 mt-auto">
              {senderName?.charAt(0) || '?'}
            </div>
      )}
      {!isMe && !showAvatar && <div className="w-7 flex-shrink-0" />}

      <div className={`group max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
        {/* Nome mittente — sempre visibile per il primo messaggio della sequenza */}
        {showAvatar && (
          <p className={`text-[11px] mb-0.5 ml-1 font-semibold ${isMe ? 'text-primary-400 mr-1' : 'text-gray-500'}`}>
            {isMe ? 'Tu' : senderName?.split(' ')[0]}
          </p>
        )}

        <div className="relative">
          <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed break-words ${isMe ? 'rounded-br-md' : 'rounded-bl-md'}`}
            style={{
              background: isMe ? '#6366f1' : '#111118',
              color:      isMe ? '#fff'    : '#e5e7eb',
              border:     isMe ? 'none'    : '1px solid rgba(255,255,255,0.07)',
            }}>
            {/* Citazione reply */}
            {msg.replyTo && (
              <div className="mb-1.5 px-2 py-1 rounded-lg text-xs"
                style={{
                  background: isMe ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                  borderLeft: `2px solid ${isMe ? 'rgba(255,255,255,0.5)' : '#6366f1'}`,
                }}>
                <p className={`font-semibold mb-0.5 ${isMe ? 'text-white/80' : 'text-primary-400'}`}>
                  {msg.replyTo.userName}
                </p>
                <p className={`truncate ${isMe ? 'text-white/60' : 'text-gray-500'}`}>
                  {msg.replyTo.text}
                </p>
              </div>
            )}
            {renderText(msg.text)}
          </div>

          {/* Pin button — visibile all'hover */}
          <button onClick={() => onPin()}
            className={`absolute ${isMe ? 'right-full mr-1' : 'left-full ml-1'} top-1/2 -translate-y-1/2 hidden group-hover:flex w-7 h-7 items-center justify-center rounded-full text-sm transition-colors`}
            style={{ background: 'rgba(255,255,255,0.06)' }}
            title={msg.pinned ? 'Rimuovi da evidenza' : 'Metti in evidenza'}>
            📌
          </button>
        </div>

        <p className={`text-[10px] text-gray-600 mt-0.5 px-1 ${isMe ? 'text-right' : 'text-left'}`}>
          {msg.createdAt ? format(msg.createdAt.toDate(), 'HH:mm') : ''}
          {msg.pinned && ' · 📌'}
        </p>
      </div>
    </motion.div>
  )
}
