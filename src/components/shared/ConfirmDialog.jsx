import { motion, AnimatePresence } from 'framer-motion'

/**
 * Bottom sheet di conferma riutilizzabile.
 * Props:
 *   open         — bool: visibile o no
 *   title        — stringa: titolo bold
 *   message      — stringa: messaggio secondario (opzionale)
 *   confirmLabel — stringa: testo del pulsante di conferma (default: "Elimina")
 *   danger       — bool: il pulsante di conferma è rosso (default: true)
 *   onConfirm    — callback: chiamata quando l'utente conferma
 *   onCancel     — callback: chiamata quando l'utente annulla o chiude
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Elimina',
  danger = true,
  onConfirm,
  onCancel,
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end"
          style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={onCancel}
        >
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="w-full max-w-lg mx-auto rounded-t-3xl p-6 space-y-4"
            style={{
              background: 'var(--c-surface2)',
              paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto" style={{ background: 'rgba(255,255,255,0.1)' }} />

            <div className="space-y-1.5 pb-1">
              <h3 className="text-base font-bold text-white">{title}</h3>
              {message && (
                <p className="text-sm text-gray-400 leading-snug">{message}</p>
              )}
            </div>

            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={onCancel}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold text-gray-400"
                style={{ background: 'rgba(255,255,255,0.06)' }}
              >
                Annulla
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={onConfirm}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                style={
                  danger
                    ? { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }
                    : { background: '#6366f1', color: 'white' }
                }
              >
                {confirmLabel}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
