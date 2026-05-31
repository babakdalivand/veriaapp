import './BottomNav.css'

const TABS = [
  { id: 'dashboard', icon: '⊞',  label: 'خانه'    },
  { id: 'twitter',   icon: '✦',  label: 'X / توییتر' },
  { id: 'quotes',    icon: '❝',  label: 'نقل‌قول' },
  { id: 'profile',   icon: '◉',  label: 'پروفایل' },
]

const ADMIN_TAB  = { id: 'admin', icon: '🛠', label: 'ادمین' }
const ADMIN_TABS = [...TABS, ADMIN_TAB]

export default function BottomNav({ current, onChange, isAdmin }) {
  const tabs = isAdmin ? ADMIN_TABS : TABS

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
