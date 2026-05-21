// ============================================================
//  MINOBRON — Configurazione Firebase
//  Sostituisci i valori qui sotto con quelli del tuo progetto
//  Firebase. Vedi SETUP.md per le istruzioni passo-passo.
// ============================================================
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getMessaging, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey:            "AIzaSyBWyu_RqapVTk8LZkLw2a2Q7but-q8l25M",
  authDomain:        "minobron-gg.firebaseapp.com",
  projectId:         "minobron-gg",
  storageBucket:     "minobron-gg.firebasestorage.app",
  messagingSenderId: "945317084379",
  appId:             ":945317084379:web:d4e224bbb1a2ac7917e0fe"
}

const app       = initializeApp(firebaseConfig)
export const auth      = getAuth(app)
export const db        = getFirestore(app)
export const googleProvider = new GoogleAuthProvider()

// Push notifications (solo se il browser le supporta)
export const getMessagingInstance = async () => {
  const supported = await isSupported()
  if (supported) return getMessaging(app)
  return null
}

export default app
