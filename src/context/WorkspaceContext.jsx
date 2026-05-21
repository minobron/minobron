import { createContext, useContext, useState, useEffect } from 'react'
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from './AuthContext'

const WorkspaceContext = createContext(null)

export function WorkspaceProvider({ children }) {
  const { user } = useAuth()
  const [workspaces, setWorkspaces]         = useState([])
  const [activeWorkspace, setActiveWorkspace] = useState(null)
  const [members, setMembers]               = useState([])
  const [loading, setLoading]               = useState(true)

  // Carica i workspace di cui l'utente fa parte
  useEffect(() => {
    if (!user) { setWorkspaces([]); setActiveWorkspace(null); setLoading(false); return }
    const q = query(collection(db, 'workspaces'), where('memberIds', 'array-contains', user.uid))
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setWorkspaces(list)
      // Ripristina workspace precedente o prendi il primo
      const saved = localStorage.getItem('minobron_workspace')
      const found = list.find(w => w.id === saved) || list[0]
      setActiveWorkspace(found || null)
      setLoading(false)
    })
    return unsub
  }, [user])

  // Carica i membri del workspace attivo
  useEffect(() => {
    if (!activeWorkspace) { setMembers([]); return }
    const fetchMembers = async () => {
      const ids = activeWorkspace.memberIds || []
      const promises = ids.map(id => getDoc(doc(db, 'users', id)))
      const snaps = await Promise.all(promises)
      setMembers(snaps.filter(s => s.exists()).map(s => ({ id: s.id, ...s.data() })))
    }
    fetchMembers()
  }, [activeWorkspace])

  const switchWorkspace = (ws) => {
    setActiveWorkspace(ws)
    localStorage.setItem('minobron_workspace', ws.id)
  }

  const isAdmin = activeWorkspace?.adminIds?.includes(user?.uid)

  return (
    <WorkspaceContext.Provider value={{ workspaces, activeWorkspace, switchWorkspace, members, isAdmin, loading }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export const useWorkspace = () => useContext(WorkspaceContext)
