import { useState, useEffect } from 'react'
import './Profile.css'

const ROLE_LABEL = { user:'کاربر', vip:'VIP', premium:'پریمیوم', admin:'ادمین', owner:'مالک' }

export default function Profile({ me, meLoading, tgUser, qs: qsProp, initData: initDataProp }) {
  const [copied, setCopied] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [payInfo, setPayInfo] = useState(null)
  const [copiedWallet, setCopiedWallet] = useState(null)

  const initData = initDataProp || window?.Telegram?.WebApp?.initData || ''
  const qs = qsProp || `?initData=${encodeURIComponent(initData || 'dev')}`

  useEffect(() => {
    fetch(`/api/payment-info${qs}`).then(r => r.json()).then(setPayInfo).catch(() => {})
  }, [qs])

  const name    = me?.firstName || tgUser?.first_name || 'کاربر'
  const uname   = me?.username  || tgUser?.username   || ''
  const role    = me?.role      || 'user'
  const refs    = me?.referralCount ?? 0
  const link    = me?.inviteLink || ''
  const expiry  = me?.premiumExpiry ? new Date(me.premiumExpiry) : null
  const isPrem  = role === 'premium' && expiry && expiry > new Date()

  const joinDate = me?.createdAt
    ? new Date(me.createdAt).toLocaleDateString('fa-IR', { year:'numeric', month:'long', day:'numeric' })
    : null

  function copy() {
    if (!link) return
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success')
    }).catch(() => window.Telegram?.WebApp?.showAlert('لینک: ' + link))
  }

  function copyWallet(addr, key) {
    navigator.clipboard?.writeText(addr).then(() => {
      setCopiedWallet(key)
      setTimeout(() => setCopiedWallet(null), 2200)
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success')
    }).catch(() => window.Telegram?.WebApp?.showAlert(addr))
  }

  return (
    <div className="page">

      {/* ── Avatar hero ─────────────────────────────────── */}
      <div className={`prof-hero ${isPrem ? 'prof-gold' : 'prof-blue'}`}>
        <div className="prof-orb" />
        <div className="prof-avatar">
          <span>{name[0]?.toUpperCase() || '?'}</span>
          {isPrem && <span className="prof-crown">✦</span>}
        </div>
        <h2 className="prof-name">{meLoading ? '...' : name}</h2>
        {uname && <p className="prof-uname">@{uname}</p>}
        <span className={`badge badge-${role}`}>{ROLE_LABEL[role] || role}</span>
      </div>

      {/* ── Info rows ────────────────────────────────────── */}
      <p className="sec-title">اطلاعات حساب</p>
      <div className="prof-info card">
        <div className="pinfo-row">
          <span className="pinfo-label">آیدی تلگرام</span>
          <span className="pinfo-val">{tgUser?.id || '—'}</span>
        </div>
        <div className="pinfo-divider" />
        <div className="pinfo-row">
          <span className="pinfo-label">نقش</span>
          <span className={`badge badge-${role}`}>{ROLE_LABEL[role] || role}</span>
        </div>
        {joinDate && (
          <>
            <div className="pinfo-divider" />
            <div className="pinfo-row">
              <span className="pinfo-label">عضویت از</span>
              <span className="pinfo-val">{joinDate}</span>
            </div>
          </>
        )}
        {isPrem && expiry && (
          <>
            <div className="pinfo-divider" />
            <div className="pinfo-row">
              <span className="pinfo-label">انقضای پریمیوم</span>
              <span className="pinfo-val gold">
                {expiry.toLocaleDateString('fa-IR')}
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Premium upsell ───────────────────────────────── */}
      {!isPrem && !meLoading && (
        <>
          <p className="sec-title">ارتقاء حساب</p>
          <div className="upgrade-card card card-glow-gold">
            <div className="upgrade-icon">✦</div>
            <div className="upgrade-body">
              <div className="upgrade-title">VeriaApp Premium</div>
              <ul className="upgrade-list">
                <li>دانلود نامحدود یوتیوب</li>
                <li>هوش مصنوعی بدون محدودیت</li>
                <li>فید اختصاصی توییتر</li>
              </ul>
            </div>
            <div className="upgrade-price">
              <span className="price-num">{payInfo?.premiumPrice || 100}</span>
              <span className="price-unit">⭐/ماه</span>
            </div>
          </div>

          {/* Payment options */}
          {!showPayment ? (
            <button className="btn btn-full btn-gold" style={{ margin: '10px 16px', width: 'calc(100% - 32px)' }}
              onClick={() => setShowPayment(true)}>
              💳 روش‌های پرداخت
            </button>
          ) : (
            <div className="card" style={{ margin: '10px 16px', padding: '14px 16px' }}>
              <div style={{ fontWeight: 700, color: 'var(--gold)', marginBottom: 12, fontSize: '.9rem' }}>
                💳 روش پرداخت را انتخاب کنید
              </div>

              {payInfo?.paypalUrl && (
                <a href={payInfo.paypalUrl} target="_blank" rel="noreferrer"
                  style={{ display: 'block', textDecoration: 'none' }}>
                  <div style={{
                    background: 'rgba(0,112,186,.12)', border: '1px solid rgba(0,112,186,.3)',
                    borderRadius: 10, padding: '12px 14px', marginBottom: 10,
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <span style={{ fontSize: '1.4rem' }}>💳</span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#3d8bff', fontSize: '.88rem' }}>PayPal</div>
                      <div style={{ fontSize: '.72rem', color: 'var(--t3)' }}>پرداخت آنلاین با پی‌پال</div>
                    </div>
                    <span style={{ marginRight: 'auto', color: 'var(--t3)', fontSize: '.8rem' }}>←</span>
                  </div>
                </a>
              )}

              {payInfo?.walletBTC && (
                <div style={{
                  background: 'rgba(247,147,26,.08)', border: '1px solid rgba(247,147,26,.25)',
                  borderRadius: 10, padding: '12px 14px', marginBottom: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: '1.2rem' }}>₿</span>
                    <div style={{ fontWeight: 700, color: '#f7931a', fontSize: '.88rem' }}>Bitcoin (BTC)</div>
                  </div>
                  <div style={{
                    fontFamily: 'monospace', fontSize: '.7rem', color: 'var(--t2)',
                    wordBreak: 'break-all', direction: 'ltr', marginBottom: 8,
                    background: 'rgba(0,0,0,.2)', borderRadius: 6, padding: '6px 8px',
                  }}>
                    {payInfo.walletBTC}
                  </div>
                  <button className="btn btn-full" style={{
                    background: copiedWallet === 'btc' ? 'rgba(78,199,96,.15)' : 'rgba(247,147,26,.12)',
                    border: `1px solid ${copiedWallet === 'btc' ? 'rgba(78,199,96,.3)' : 'rgba(247,147,26,.3)'}`,
                    color: copiedWallet === 'btc' ? 'var(--green)' : '#f7931a',
                    fontSize: '.8rem', padding: '8px',
                  }} onClick={() => copyWallet(payInfo.walletBTC, 'btc')}>
                    {copiedWallet === 'btc' ? '✓ کپی شد' : '📋 کپی آدرس'}
                  </button>
                </div>
              )}

              {payInfo?.walletUSDT && (
                <div style={{
                  background: 'rgba(38,161,123,.08)', border: '1px solid rgba(38,161,123,.25)',
                  borderRadius: 10, padding: '12px 14px', marginBottom: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: '1.2rem' }}>💵</span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#26a17b', fontSize: '.88rem' }}>USDT (TRC20)</div>
                      <div style={{ fontSize: '.68rem', color: 'var(--t3)' }}>شبکه ترون</div>
                    </div>
                  </div>
                  <div style={{
                    fontFamily: 'monospace', fontSize: '.7rem', color: 'var(--t2)',
                    wordBreak: 'break-all', direction: 'ltr', marginBottom: 8,
                    background: 'rgba(0,0,0,.2)', borderRadius: 6, padding: '6px 8px',
                  }}>
                    {payInfo.walletUSDT}
                  </div>
                  <button className="btn btn-full" style={{
                    background: copiedWallet === 'usdt' ? 'rgba(78,199,96,.15)' : 'rgba(38,161,123,.12)',
                    border: `1px solid ${copiedWallet === 'usdt' ? 'rgba(78,199,96,.3)' : 'rgba(38,161,123,.3)'}`,
                    color: copiedWallet === 'usdt' ? 'var(--green)' : '#26a17b',
                    fontSize: '.8rem', padding: '8px',
                  }} onClick={() => copyWallet(payInfo.walletUSDT, 'usdt')}>
                    {copiedWallet === 'usdt' ? '✓ کپی شد' : '📋 کپی آدرس'}
                  </button>
                </div>
              )}

              {!payInfo?.paypalUrl && !payInfo?.walletBTC && !payInfo?.walletUSDT && (
                <div style={{ color: 'var(--t3)', fontSize: '.85rem', textAlign: 'center', padding: '12px 0' }}>
                  روش پرداختی تنظیم نشده. با ادمین تماس بگیرید.
                </div>
              )}

              <div style={{ fontSize: '.72rem', color: 'var(--t3)', marginTop: 8, lineHeight: 1.6 }}>
                پس از پرداخت، رسید را به ادمین ارسال کنید تا حساب شما ارتقاء یابد.
              </div>

              <button style={{
                marginTop: 10, width: '100%', background: 'none', border: 'none',
                color: 'var(--t3)', fontSize: '.78rem', cursor: 'pointer', padding: '4px',
              }} onClick={() => setShowPayment(false)}>
                بستن ✕
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Referral ─────────────────────────────────────── */}
      <p className="sec-title">دعوت دوستان</p>
      <div className="ref-card card">
        <div className="ref-top">
          <div>
            <div className="ref-count">{refs}</div>
            <div className="ref-count-label">نفر دعوت شده</div>
          </div>
          <div className="ref-badge">🔗</div>
        </div>
        {link ? (
          <>
            <div className="ref-link">{link}</div>
            <button className={`btn btn-full ${copied ? 'btn-gold' : 'btn-blue'}`} onClick={copy}>
              {copied ? '✓ کپی شد!' : '📋 کپی لینک دعوت'}
            </button>
          </>
        ) : (
          <p className="ref-no-link">برای مشاهده لینک دعوت، بات را از تلگرام باز کن.</p>
        )}
      </div>

    </div>
  )
}
