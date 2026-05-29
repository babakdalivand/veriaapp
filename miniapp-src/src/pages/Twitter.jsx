import { useState, useEffect } from 'react'
import { useApi } from '../hooks.js'
import './Twitter.css'

const FALLBACK_ACCOUNTS = ['IranIntl_Fa', 'bbcpersian', 'AlinejadMasih']

export default function Twitter() {
  const [accounts, setAccounts] = useState(FALLBACK_ACCOUNTS)
  const [selected, setSelected] = useState(FALLBACK_ACCOUNTS[0])
  const [customInput, setCustomInput] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  useEffect(() => {
    fetch('/api/twitter/accounts')
      .then(r => r.json())
      .then(d => {
        if (d.accounts?.length) {
          setAccounts(d.accounts)
          setSelected(d.accounts[0])
        }
      })
      .catch(() => {})
  }, [])

  const { data, loading, error } = useApi(
    showCustom && customInput ? `/api/tweets?username=${customInput}` : `/api/tweets?username=${selected}`
  )

  function handleCustomSubmit(e) {
    e.preventDefault()
    const val = customInput.trim().replace('@', '')
    if (val) { setCustomInput(val); setShowCustom(true) }
  }

  return (
    <div className="page tw-page">
      <div className="tw-hero">
        <div className="tw-orb" />
        <div className="tw-icon">✦</div>
        <h2 className="tw-title">فید توییتر</h2>
        <p className="tw-sub">آخرین توییت‌های اکانت‌های منتخب</p>
      </div>

      <p className="sec-title">انتخاب اکانت</p>
      <div className="tw-tabs">
        {accounts.map(a => (
          <button
            key={a}
            className={`tw-tab ${!showCustom && selected === a ? 'active' : ''}`}
            onClick={() => { setSelected(a); setShowCustom(false) }}
          >
            @{a}
          </button>
        ))}
        <button
          className={`tw-tab ${showCustom ? 'active' : ''}`}
          onClick={() => setShowCustom(true)}
        >
          ✏️ دلخواه
        </button>
      </div>

      {showCustom && (
        <form onSubmit={handleCustomSubmit} style={{ display: 'flex', gap: 8, padding: '8px 16px 0' }}>
          <input
            className="ap-search-input"
            style={{ flex: 1, direction: 'ltr' }}
            placeholder="نام کاربری توییتر..."
            value={customInput}
            onChange={e => setCustomInput(e.target.value.replace('@', ''))}
          />
          <button type="submit" className="ap-search-btn">جستجو</button>
        </form>
      )}

      <p className="sec-title">توییت‌های اخیر</p>

      {loading && (
        <div className="tw-feed">
          {[1,2,3].map(i => (
            <div key={i} className="tw-card card">
              <div className="skeleton" style={{ height:14, borderRadius:6, marginBottom:8 }} />
              <div className="skeleton" style={{ height:14, borderRadius:6, width:'70%' }} />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="tw-error">
          <span>⚠️</span>
          <div>
            <div>سرویس توییتر موقتاً در دسترس نیست</div>
            <div style={{ fontSize: '.72rem', marginTop: 4, opacity: .7 }}>سرورهای Nitter گاهی قطع می‌شوند — چند دقیقه دیگر امتحان کنید</div>
          </div>
        </div>
      )}

      {!loading && !error && data?.tweets?.length > 0 && (
        <div className="tw-feed">
          {data.tweets.map((t, i) => (
            <a key={i} href={t.link} target="_blank" rel="noreferrer" className="tw-card card">
              <div className="tw-account">@{selected}</div>
              <p className="tw-text">{t.title}</p>
              {t.date && <div className="tw-date">{t.date}</div>}
            </a>
          ))}
        </div>
      )}

      {!loading && !error && (!data?.tweets || data.tweets.length === 0) && (
        <div className="tw-empty">
          <span>🐦</span>
          <p>توییتی پیدا نشد</p>
        </div>
      )}
    </div>
  )
}
