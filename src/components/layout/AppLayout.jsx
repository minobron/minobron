import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import BottomNav from './BottomNav'
import Header from './Header'

export default function AppLayout() {
  const location = useLocation()

  return (
    <div className="bg-[#0d0d14] font-sans" style={{ minHeight: '100dvh' }}>
      <Header />
      <main
        style={{
          paddingTop:    'var(--header-h)',
          paddingBottom: 'var(--bottomnav-h)',
          minHeight:     '100dvh',
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav />
    </div>
  )
}
