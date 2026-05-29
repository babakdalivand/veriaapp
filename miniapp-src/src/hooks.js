import { useState, useEffect, useCallback } from 'react'

/* ── Telegram Web App ──────────────────────────────────────── */
export function useTelegram() {
  const tg = window.Telegram?.WebApp ?? null
  const user = tg?.initDataUnsafe?.user ?? null
  const initData = tg?.initData ?? ''

  useEffect(() => {
    if (!tg) return
    tg.ready()
    tg.expand()
    tg.setHeaderColor?.('#07070f')
    tg.setBackgroundColor?.('#07070f')
  }, [tg])

  const haptic = useCallback((type = 'light') => {
    tg?.HapticFeedback?.impactOccurred(type)
  }, [tg])

  const notify = useCallback((type = 'success') => {
    tg?.HapticFeedback?.notificationOccurred(type)
  }, [tg])

  const close = useCallback(() => tg?.close(), [tg])

  return { tg, user, initData, haptic, notify, close }
}

/* ── Generic data fetcher ─────────────────────────────────── */
export function useApi(url) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    if (!url) { setLoading(false); return }
    let active = true
    setLoading(true)
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json() })
      .then(d => { if (active) { setData(d); setLoading(false) } })
      .catch(e => { if (active) { setError(e.message); setLoading(false) } })
    return () => { active = false }
  }, [url])

  return { data, loading, error }
}
