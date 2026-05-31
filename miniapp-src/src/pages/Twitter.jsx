import { useState, useEffect } from 'react'
import './Twitter.css'

const FALLBACK_ACCOUNTS = ['IranIntl_Fa', 'bbcpersian', 'AlinejadMasih']

function fmt(n) {
  if (!n) return '?'
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

function TweetCard({ tweet }) {
  return (
    <a href={tweet.url} target="_blank" rel="noreferrer" className="tw-tweet-card card" style={{ textDecoration: 'none', display: 'block' }}>
      <p style={{ fontSize: '.82rem', color: 'var(--t1)', lineHeight: 1.7, direction: 'auto', margin: 0 }}>
        {tweet.text}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <span style={{ fontSize: '.7rem', color: 'var(--t3)' }}>{tweet.date}</span>
        <div style={{ display: 'flex', gap: 12, fontSize: '.72rem', color: 'var(--t3)' }}>
          <span>♻ {fmt(tweet.retweets)}</span>
          <span>♡ {fmt(tweet.likes)}</span>
        </div>
      </div>
    </a>
  )
}

function ProfileCard({ username }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [tweets, setTweets] = useState(null)
  const [tweetsLoading, setTweetsLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    setProfile(null)
    setTweets(null)
    setExpanded(false)
    fetch(`/api/twitter/profile?username=${username}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setProfile(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [username])

  function loadTweets() {
    if (tweets !== null || tweetsLoading) { setExpanded(e => !e); return; }
    setExpanded(true)
    setTweetsLoading(true)
    fetch(`/api/twitter/tweets?username=${username}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { setTweets(d?.tweets || []); setTweetsLoading(false) })
      .catch(() => { setTweets([]); setTweetsLoading(false) })
  }

  if (loading) {
    return (
      <div className="tw-card card" style={{ padding: '16px' }}>
        <div className="skeleton" style={{ height: 16, width: '60%', borderRadius: 6, marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 12, width: '90%', borderRadius: 6 }} />
      </div>
    )
  }

  if (!profile) {
    return (
      <a href={`https://x.com/${username}`} target="_blank" rel="noreferrer" className="tw-card card" style={{ textDecoration: 'none' }}>
        <div className="tw-account">@{username}</div>
        <div style={{ fontSize: '.78rem', color: 'var(--t3)', marginTop: 4 }}>برای مشاهده روی X کلیک کنید</div>
      </a>
    )
  }

  return (
    <div className="tw-card card">
      <a href={profile.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--t1)' }}>{profile.name}</div>
            <div className="tw-account" style={{ marginTop: 2 }}>@{profile.username}</div>
          </div>
          <div style={{ display: 'flex', gap: 14, flexShrink: 0 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--orange)' }}>{fmt(profile.followers)}</div>
              <div style={{ fontSize: '.65rem', color: 'var(--t3)' }}>فالوور</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--t2)' }}>{fmt(profile.tweets)}</div>
              <div style={{ fontSize: '.65rem', color: 'var(--t3)' }}>توییت</div>
            </div>
          </div>
        </div>
        {profile.description && (
          <p style={{ fontSize: '.78rem', color: 'var(--t2)', marginTop: 8, lineHeight: 1.6, direction: 'auto' }}>
            {profile.description.slice(0, 140)}
          </p>
        )}
      </a>
      <button
        onClick={loadTweets}
        style={{
          marginTop: 10, width: '100%', padding: '7px',
          background: 'var(--orange-dim)', border: '1px solid var(--b-orange)',
          borderRadius: 8, fontSize: '.75rem', color: 'var(--orange)',
          cursor: 'pointer', fontWeight: 600,
        }}
      >
        {expanded ? '▲ بستن توییت‌ها' : '▼ مشاهده توییت‌ها'}
      </button>
      {expanded && (
        <div style={{ marginTop: 10 }}>
          {tweetsLoading && (
            <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--t3)', fontSize: '.78rem' }}>در حال بارگذاری...</div>
          )}
          {!tweetsLoading && tweets?.length === 0 && (
            <div style={{ padding: '10px', textAlign: 'center', color: 'var(--t3)', fontSize: '.75rem' }}>
              توییت‌ها در دسترس نیستند — <a href={profile.url} target="_blank" rel="noreferrer" style={{ color: 'var(--orange)' }}>مشاهده در X</a>
            </div>
          )}
          {!tweetsLoading && tweets?.map(t => <TweetCard key={t.id} tweet={t} />)}
        </div>
      )}
    </div>
  )
}

export default function Twitter() {
  const [accounts, setAccounts] = useState(FALLBACK_ACCOUNTS)
  const [customInput, setCustomInput] = useState('')
  const [customAccounts, setCustomAccounts] = useState([])

  useEffect(() => {
    fetch('/api/twitter/accounts')
      .then(r => r.json())
      .then(d => { if (d.accounts?.length) setAccounts(d.accounts) })
      .catch(() => {})
  }, [])

  function handleCustomSubmit(e) {
    e.preventDefault()
    const val = customInput.trim().replace('@', '')
    if (val && !customAccounts.includes(val) && !accounts.includes(val)) {
      setCustomAccounts(prev => [val, ...prev])
      setCustomInput('')
    }
  }

  const displayAccounts = [...customAccounts, ...accounts]

  return (
    <div className="page tw-page">
      <div className="tw-hero">
        <div className="tw-orb" />
        <div className="tw-icon">✦</div>
        <h2 className="tw-title">اکانت‌های X / توییتر</h2>
        <p className="tw-sub">پروفایل و توییت‌های اکانت‌های منتخب</p>
      </div>

      <p className="sec-title">جستجوی اکانت</p>
      <form onSubmit={handleCustomSubmit} style={{ display: 'flex', gap: 8, padding: '0 16px 8px' }}>
        <input
          className="ap-search-input"
          style={{ flex: 1, direction: 'ltr' }}
          placeholder="نام کاربری توییتر..."
          value={customInput}
          onChange={e => setCustomInput(e.target.value.replace('@', ''))}
        />
        <button type="submit" className="ap-search-btn">جستجو</button>
      </form>

      <p className="sec-title">اکانت‌های منتخب</p>
      <div className="tw-feed">
        {displayAccounts.map(a => (
          <ProfileCard key={a} username={a} />
        ))}
      </div>
    </div>
  )
}
