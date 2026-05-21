import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { doc, setDoc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore'
import { auth, googleProvider, db } from '../firebase/config'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubUser = null

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubUser) { unsubUser(); unsubUser = null }

      if (firebaseUser) {
        const ref = doc(db, 'users', firebaseUser.uid)

        // Crea il documento utente se non esiste
        await setDoc(ref, {
          uid:       firebaseUser.uid,
          name:      firebaseUser.displayName,
          email:     firebaseUser.email,
          photoURL:  firebaseUser.photoURL,
          createdAt: serverTimestamp()
        }, { merge: true })

        // Listener in tempo reale: se il nome cambia su Firestore, si aggiorna subito
        unsubUser = onSnapshot(ref, (snap) => {
          if (snap.exists()) {
            const data = snap.data()
            setUser({
              uid:      firebaseUser.uid,
              name:     data.name || firebaseUser.displayName,
              email:    data.email || firebaseUser.email,
              photoURL: data.photoURL || firebaseUser.photoURL,
            })
          }
          setLoading(false)
        })
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => {
      unsubAuth()
      if (unsubUser) unsubUser()
    }
  }, [])

  const loginWithGoogle = () => signInWithPopup(auth, googleProvider)
  const logout          = () => signOut(auth)

  // Aggiorna nome: scrive su Firestore → il listener lo riporta subito nello stato
  const updateUserName = async (name) => {
    if (!user?.uid || !name.trim()) return
    await updateDoc(doc(db, 'users', user.uid), { name: name.trim() })
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginWithGoogle, logout, updateUserName }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
