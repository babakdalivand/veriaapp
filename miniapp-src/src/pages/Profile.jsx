import { useState } from 'react'
import './Profile.css'

const ROLE_LABEL = { user:'کاربر', vip:'VIP', premium:'پریمیوم', admin:'ادمین', owner:'مالک' }

export default function Profile({ me, meLoading, tgUser }) {
  const [copied, setCopied] = useState(false)

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
              <span className="price-num">۱۰۰</span>
              <span className="price-unit">⭐/ماه</span>
            </div>
          </div>
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
