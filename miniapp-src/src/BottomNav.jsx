import './BottomNav.css'

const TABS = [
  { id: 'dashboard', icon: '⊞',  label: 'خانه'    },
  { id: 'download',  icon: '⬇',  label: 'دانلود'  },
  { id: 'youtube',   icon: '▶',  label: 'یوتیوب'  },
  { id: 'quotes',    icon: '❝',  label: 'نقل‌قول' },
  { id: 'profile',   icon: '◉',  label: 'پروفایل' },
]

const ADMIN_TAB  = { id: 'admin', icon: '🛠', label: 'ادمین' }
const ADMIN_TABS = TABS.filter(t => t.id !== 'quotes')

export default function BottomNav({ current, onChange, isAdmin }) {
  const tabs = isAdmin ? [...ADMIN_TABS, ADMIN_TAB] : TABS

  return (
    <nav className="bottom-nav">
      {tabs.map(t => (
        <button
          key={t.id}
          className={`nav-tab ${current === t.id ? 'active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          <span className="nav-icon">{t.icon}</span>
          <span className="nav-label">{t.label}</span>
          {current === t.id && <span className="nav-dot" />}
        </button>
      ))}
    </nav>
  )
}
