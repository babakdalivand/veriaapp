import { useState, useEffect } from 'react'
import { useTelegram, useApi } from './hooks.js'
import Dashboard  from './pages/Dashboard.jsx'
import YouTube    from './pages/YouTube.jsx'
import Twitter    from './pages/Twitter.jsx'
import Quotes     from './pages/Quotes.jsx'
import Profile    from './pages/Profile.jsx'
import AdminPanel from './pages/AdminPanel.jsx'
import BottomNav  from './BottomNav.jsx'

const PAGES = {
  dashboard: Dashboard,
  youtube: YouTube,
  twitter: Twitter,
  quotes: Quotes,
  profile: Profile,
  admin: AdminPanel,
}

export default function App() {
  const [page, setPage] = useState('dashboard')
  const { tg, user: tgUser, initData } = useTelegram()

  const meUrl    = initData ? `/api/me?initData=${encodeURIComponent(initData)}` : null
  const { data: me,    loading: meLoading }    = useApi(meUrl)
  const { data: stats, loading: statsLoading } = useApi('/api/stats')

  const isAdmin = me?.role === 'admin' || me?.role === 'owner'

  // If user navigated to admin but lost admin role, redirect away
  useEffect(() => {
    if (page === 'admin' && !isAdmin && !meLoading) setPage('dashboard')
  }, [isAdmin, meLoading, page])

  const Page = PAGES[page] ?? Dashboard

  return (
    <>
      <Page
        me={me}
        stats={stats}
        meLoading={meLoading}
        statsLoading={statsLoading}
        tgUser={tgUser}
        navigate={setPage}
      />
      <BottomNav current={page} onChange={setPage} isAdmin={isAdmin} />
    </>
  )
}
