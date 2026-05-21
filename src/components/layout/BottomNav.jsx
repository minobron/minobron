import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'

const tabs = [
  { to: '/home',     icon: HomeIcon,     label: 'Home' },
  { to: '/projects', icon: FolderIcon,   label: 'Progetti' },
  { to: '/chat',     icon: ChatIcon,     label: 'Chat' },
  { to: '/calendar', icon: CalendarIcon, label: 'Calendario' },
  { to: '/archive',  icon: ArchiveIcon,  label: 'Archivio' },
]

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5"
      style={{
        background:     'rgba(13,13,20,0.92)',
        backdropFilter: 'blur(16px)',
        paddingBottom:  'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-stretch h-16 max-w-lg mx-auto">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className="flex-1">
            {({ isActive }) => (
              <div className="flex flex-col items-center justify-center h-full gap-1 relative">
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-x-2 inset-y-1.5 rounded-xl bg-primary-500/15"
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  />
                )}
                <div className="relative z-10">
                  <Icon active={isActive} />
                </div>
                <span className={`text-[10px] font-medium relative z-10 transition-colors ${
                  isActive ? 'text-primary-400' : 'text-gray-600'
                }`}>
                  {label}
                </span>
              </div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

function Ico({ active, d }) {
  return (
    <svg className={`w-5 h-5 transition-colors ${active ? 'text-primary-400' : 'text-gray-600'}`}
      fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2 : 1.8} d={d} />
    </svg>
  )
}

function HomeIcon({ active }) {
  return <Ico active={active} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
}
function FolderIcon({ active }) {
  return <Ico active={active} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
}
function ChatIcon({ active }) {
  return <Ico active={active} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
}
function CalendarIcon({ active }) {
  return <Ico active={active} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
}
function ArchiveIcon({ active }) {
  return <Ico active={active} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
}
