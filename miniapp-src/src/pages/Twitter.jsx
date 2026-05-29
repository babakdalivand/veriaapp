import { useState } from 'react'
import { useApi } from '../hooks.js'
import './Twitter.css'

const ACCOUNTS = ['IranIntl_Fa', 'bbcpersian', 'AlinejadMasih']

export default function Twitter() {
  const [selected, setSelected] = useState(ACCOUNTS[0])
  const { data, loading, error } = useApi(`/api/tweets?username=${selected}`)

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
        {ACCOUNTS.map(a => (
          <button
            key={a}
            className={`tw-tab ${selected === a ? 'active' : ''}`}
            onClick={() => setSelected(a)}
          >
            @{a}
          </button>
        ))}
      </div>

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
          <span>خطا در دریافت توییت‌ها. Nitter ممکنه در دسترس نباشه.</span>
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
