import { useState, useEffect } from 'react'
import { useTelegram, useApi } from './hooks.js'
import Dashboard from './pages/Dashboard.jsx'
import YouTube   from './pages/YouTube.jsx'
import Twitter   from './pages/Twitter.jsx'
import Quotes    from './pages/Quotes.jsx'
import Profile   from './pages/Profile.jsx'
import BottomNav from './BottomNav.jsx'

const PAGES = { dashboard: Dashboard, youtube: YouTube, twitter: Twitter, quotes: Quotes, profile: Profile }

export default function App() {
  const [page, setPage] = useState('dashboard')
  const { tg, user: tgUser, initData } = useTelegram()

  // Fetch core data once for the whole app
  const meUrl    = initData ? `/api/me?initData=${encodeURIComponent(initData)}` : null
  const { data: me,    loading: meLoading }    = useApi(meUrl)
  const { data: stats, loading: statsLoading } = useApi('/api/stats')

  const Page = PAGES[page] ?? Dashboard

  function navigate(p) { setPage(p) }

  return (
    <>
      <Page
        me={me}
        stats={stats}
        meLoading={meLoading}
        statsLoading={statsLoading}
        tgUser={tgUser}
        navigate={navigate}
      />
      <BottomNav current={page} onChange={navigate} />
    </>
  )
}
