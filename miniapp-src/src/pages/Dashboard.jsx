import './Dashboard.css'

const ROLE_LABEL = { user:'کاربر', vip:'VIP', premium:'پریمیوم', admin:'ادمین', owner:'مالک' }

function fmt(n) {
  if (n == null) return '—'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return String(n)
}

function StatCard({ icon, value, label, color, loading }) {
  return (
    <div className={`stat-card card stat-${color}`}>
      <div className="stat-icon-wrap">
        <span className="stat-icon">{icon}</span>
      </div>
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

export default function Dashboard({ me, stats, meLoading, statsLoading, tgUser, navigate }) {
  const name  = me?.firstName || tgUser?.first_name || 'کاربر'
  const uname = me?.username  || tgUser?.username   || ''
  const role  = me?.role      || 'user'
  const refs  = me?.referralCount ?? 0
  const isPremium = role === 'premium'

  return (
    <div className="page">
      {/* ── Hero ────────────────────────────────────────── */}
      <div className={`hero ${isPremium ? 'hero-gold' : 'hero-blue'}`}>
        <div className="hero-bg-orb" />
        <div className="hero-avatar">
          <span>{name[0]?.toUpperCase() || '?'}</span>
        </div>
        <div className="hero-info">
          <h1 className="hero-name">
            {meLoading ? <span className="skeleton" style={{ width:120, height:22, display:'block', borderRadius:6 }} /> : name}
          </h1>
          {uname && <p className="hero-sub">@{uname}</p>}
          <div className="hero-badges">
            <span className={`badge badge-${role}`}>{ROLE_LABEL[role] || role}</span>
            {isPremium && <span className="hero-star">✦ Premium</span>}
          </div>
        </div>
      </div>

      {/* ── Stats ───────────────────────────────────────── */}
      <p className="sec-title">آنالیتیکس</p>
      <div className="stats-grid">
        <StatCard icon="👥" value={stats?.totalUsers}   label="کل اعضا"        color="blue"  loading={statsLoading} />
        <StatCard icon="🆕" value={stats?.newToday}     label="عضو امروز"      color="green" loading={statsLoading} />
        <StatCard icon="⭐" value={stats?.premiumUsers}  label="پریمیوم فعال"  color="gold"  loading={statsLoading} />
        <StatCard icon="🛡️" value={stats?.totalWarns}   label="اسپم مسدود"    color="red"   loading={statsLoading} />
      </div>

      {/* ── Premium banner (non-premium users) ──────────── */}
      {!isPremium && !meLoading && (
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

      {/* ── Quick actions ────────────────────────────────── */}
      <p className="sec-title">دسترسی سریع</p>
      <div className="qa-grid">
        <QuickAction icon="▶"  label="یوتیوب"    desc="دانلود ویدیو"   onClick={() => navigate('youtube')}   />
        <QuickAction icon="✦"  label="توییتر"    desc="فید اکانت‌ها"  onClick={() => navigate('twitter')}   />
        <QuickAction icon="❝"  label="نقل‌قول"   desc="اندیشمندان"    onClick={() => navigate('quotes')}    />
        <QuickAction icon="🔗" label="دعوت"      desc={`${refs} نفر`}  onClick={() => navigate('profile')}   />
      </div>

      {/* ── This week ────────────────────────────────────── */}
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
    </div>
  )
}
