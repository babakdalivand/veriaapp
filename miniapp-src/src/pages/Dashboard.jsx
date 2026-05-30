import { useState, useEffect } from 'react'
import './Dashboard.css'

const ROLE_LABEL = { user:'کاربر', vip:'VIP', premium:'پریمیوم', admin:'ادمین', owner:'مالک' }
const IS_ADMIN   = r => r === 'admin' || r === 'owner'

function fmt(n) {
  if (n == null) return '—'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

function StatCard({ icon, value, label, color, loading }) {
  return (
    <div className={`stat-card card stat-${color}`}>
      <div className="stat-icon-wrap"><span className="stat-icon">{icon}</span></div>
      <div className="stat-value">
        {loading ? <span className="skeleton" style={{ width:48, height:28, display:'inline-block' }} /> : fmt(value)}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function QuickAction({ icon, label, desc, onClick }) {
  return (
    <button className="qa-btn" onClick={onClick}>
      <span className="qa-icon">{icon}</span>
      <span className="qa-label">{label}</span>
      <span className="qa-desc">{desc}</span>
    </button>
  )
}

function AnnouncementBox({ announcement }) {
  if (!announcement?.text) return null
  return (
    <div className="ann-box card" style={{
      margin: '0 16px 4px',
      padding: '12px 14px',
      background: 'rgba(61,139,255,.07)',
      border: '1px solid rgba(61,139,255,.2)',
      borderRadius: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: '1rem' }}>📢</span>
        <span style={{ fontWeight: 700, fontSize: '.85rem', color: 'var(--blue)' }}>
          {announcement.title || 'اطلاع‌رسانی'}
        </span>
      </div>
      <p style={{ fontSize: '.82rem', color: 'var(--t1)', lineHeight: 1.7, margin: 0, direction: 'rtl' }}>
        {announcement.text}
      </p>
    </div>
  )
}

function PromotionCard({ p, qs }) {
  function handleClick() {
    fetch(`/api/promotions/${p.id}/click`, { method: 'POST' }).catch(() => {})
    window.open(p.linkUrl, '_blank')
  }
  return (
    <div className="promo-card card" onClick={handleClick} style={{
      cursor: 'pointer',
      overflow: 'hidden',
      flexShrink: 0,
      width: 160,
      borderRadius: 12,
      padding: 0,
    }}>
      {p.imageUrl ? (
        <img src={p.imageUrl} alt={p.title} style={{
          width: '100%', height: 110, objectFit: 'cover', display: 'block',
        }} onError={e => { e.target.style.display='none' }} />
      ) : (
        <div style={{
          width: '100%', height: 110,
          background: 'linear-gradient(135deg,rgba(61,139,255,.15),rgba(139,92,246,.15))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem',
        }}>🔗</div>
      )}
      <div style={{ padding: '8px 10px' }}>
        <div style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--t1)', direction: 'rtl', lineHeight: 1.4 }}>
          {p.title}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard({ me, stats, meLoading, statsLoading, tgUser, navigate, qs }) {
  const name      = me?.firstName || tgUser?.first_name || 'کاربر'
  const uname     = me?.username  || tgUser?.username   || ''
  const role      = me?.role      || 'user'
  const refs      = me?.referralCount ?? 0
  const isPremium = role === 'premium'
  const isAdmin   = IS_ADMIN(role)

  const [homeData, setHomeData] = useState(null)

  useEffect(() => {
    if (!qs) return
    fetch(`/api/home-data${qs}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setHomeData(d))
      .catch(() => {})
  }, [qs])

  // Avatar: try Telegram photo_url first, fallback to initial
  const photoUrl = tgUser?.photo_url || null

  return (
    <div className="page">
      {/* ── Hero ─────────────────────────────────────────── */}
      <div className={`hero ${isPremium ? 'hero-gold' : isAdmin ? 'hero-purple' : 'hero-blue'}`}>
        <div className="hero-bg-orb" />
        <div className="hero-avatar" style={photoUrl ? { padding: 0, overflow: 'hidden' } : {}}>
          {photoUrl
            ? <img src={photoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            : <span>{name[0]?.toUpperCase() || '?'}</span>
          }
        </div>
        <div className="hero-info">
          <h1 className="hero-name">
            {meLoading
              ? <span className="skeleton" style={{ width:120, height:22, display:'block', borderRadius:6 }} />
              : name}
          </h1>
          {uname && <p className="hero-sub">@{uname}</p>}
          <div className="hero-badges">
            <span className={`badge badge-${role}`}>{ROLE_LABEL[role] || role}</span>
            {isPremium && <span className="hero-star">✦ Premium</span>}
          </div>
        </div>
      </div>

      {/* ── اعلان ────────────────────────────────────────── */}
      {homeData?.announcement && (
        <>
          <p className="sec-title">اطلاع‌رسانی</p>
          <AnnouncementBox announcement={homeData.announcement} />
        </>
      )}

      {/* ── آنالیتیکس — فقط ادمین ────────────────────────── */}
      {isAdmin && (
        <>
          <p className="sec-title">آنالیتیکس</p>
          <div className="stats-grid">
            <StatCard icon="👥" value={stats?.totalUsers}  label="کل اعضا"       color="blue"  loading={statsLoading} />
            <StatCard icon="🆕" value={stats?.newToday}    label="عضو امروز"     color="green" loading={statsLoading} />
            <StatCard icon="⭐" value={stats?.premiumUsers} label="پریمیوم فعال" color="gold"  loading={statsLoading} />
            <StatCard icon="🛡️" value={stats?.totalWarns}  label="اسپم مسدود"   color="red"   loading={statsLoading} />
          </div>
        </>
      )}

      {/* ── Premium banner — کاربر غیر پریمیوم ──────────── */}
      {!isPremium && !isAdmin && !meLoading && (
        <>
          <p className="sec-title">پیشنهاد ویژه</p>
          <div className="prem-banner card card-glow-gold" onClick={() => navigate('profile')}>
            <div className="prem-banner-left">
              <span className="prem-crown">✦</span>
              <div>
                <div className="prem-title">VeriaApp Premium</div>
                <div className="prem-sub">دسترسی نامحدود — ۱۰۰ ⭐ ماهانه</div>
              </div>
            </div>
            <span className="prem-arrow">›</span>
          </div>
        </>
      )}

      {/* ── تبلیغات ──────────────────────────────────────── */}
      {homeData?.promotions?.length > 0 && (
        <>
          <p className="sec-title">معرفی</p>
          <div style={{
            display: 'flex', gap: 12, overflowX: 'auto', padding: '0 16px 8px',
            scrollbarWidth: 'none',
          }}>
            {homeData.promotions.map(p => <PromotionCard key={p.id} p={p} qs={qs} />)}
          </div>
        </>
      )}

      {/* ── دسترسی سریع ──────────────────────────────────── */}
      <p className="sec-title">دسترسی سریع</p>
      <div className="qa-grid">
        <QuickAction icon="▶"  label="یوتیوب"   desc="دانلود ویدیو"  onClick={() => navigate('youtube')}  />
        <QuickAction icon="✦"  label="توییتر"   desc="فید اکانت‌ها" onClick={() => navigate('twitter')}  />
        <QuickAction icon="❝"  label="نقل‌قول"  desc="اندیشمندان"   onClick={() => navigate('quotes')}   />
        <QuickAction icon="🔗" label="دعوت"     desc={`${refs} نفر`} onClick={() => navigate('profile')}  />
      </div>

      {/* ── آمار این هفته — فقط ادمین ───────────────────── */}
      {isAdmin && (
        <>
          <p className="sec-title">آمار این هفته</p>
          <div className="week-card card">
            <div className="week-row">
              <span className="week-label">عضو جدید</span>
              <span className="week-val blue">{statsLoading ? '—' : fmt(stats?.newThisWeek)}</span>
            </div>
            <div className="week-divider" />
            <div className="week-row">
              <span className="week-label">ادمین فعال</span>
              <span className="week-val">{statsLoading ? '—' : fmt(stats?.totalAdmins)}</span>
            </div>
            <div className="week-divider" />
            <div className="week-row">
              <span className="week-label">دعوت‌شده از شما</span>
              <span className="week-val gold">{meLoading ? '—' : refs}</span>
            </div>
          </div>
        </>
      )}

      {/* ── تماس با ادمین — کاربر عادی ──────────────────── */}
      {!isAdmin && (
        <div style={{ padding: '4px 16px 16px' }}>
          <div className="card" style={{
            padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
            cursor: 'pointer', border: '1px solid rgba(248,81,73,.15)',
          }} onClick={() => window.open('https://t.me/' + (window.__ADMIN_USERNAME__ || 'veriaapp'), '_blank')}>
            <span style={{ fontSize: '1.4rem' }}>🚨</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '.85rem', color: 'var(--t1)' }}>گزارش تخلف</div>
              <div style={{ fontSize: '.75rem', color: 'var(--t3)', marginTop: 2 }}>ارتباط مستقیم با ادمین</div>
            </div>
            <span style={{ marginRight: 'auto', color: 'var(--t3)', fontSize: '1.1rem' }}>›</span>
          </div>
        </div>
      )}
    </div>
  )
}
