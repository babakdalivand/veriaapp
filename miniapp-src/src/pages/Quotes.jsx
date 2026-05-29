import { useApi } from '../hooks.js'
import './Quotes.css'

export default function Quotes() {
  const { data, loading } = useApi('/api/quote')

  return (
    <div className="page qt-page">
      <div className="qt-hero">
        <div className="qt-orb" />
        <div className="qt-icon">❝</div>
        <h2 className="qt-title">نقل‌قول روز</h2>
        <p className="qt-sub">اندیشمندان آزاداندیش ایرانی و جهانی</p>
      </div>

      <p className="sec-title">نقل‌قول امروز</p>

      {loading ? (
        <div className="qt-card card">
          <div className="skeleton" style={{ height:16, borderRadius:6, marginBottom:10 }} />
          <div className="skeleton" style={{ height:16, borderRadius:6, marginBottom:10, width:'85%' }} />
          <div className="skeleton" style={{ height:16, borderRadius:6, width:'60%', marginBottom:24 }} />
          <div className="skeleton" style={{ height:12, borderRadius:6, width:'40%', alignSelf:'flex-end' }} />
        </div>
      ) : data ? (
        <div className="qt-card card card-glow-blue">
          <div className="qt-quote-mark">❝</div>
          <blockquote className="qt-text">{data.text}</blockquote>
          <div className="qt-author">— {data.author}</div>
        </div>
      ) : (
        <div className="qt-card card">
          <p style={{ color:'#44445a', fontSize:'.85rem', textAlign:'center' }}>خطا در دریافت نقل‌قول</p>
        </div>
      )}

      <p className="sec-title">درباره این بخش</p>
      <div className="qt-about card">
        <div className="qt-about-row">
          <span className="qt-about-icon">🇮🇷</span>
          <div>
            <div className="qt-about-title">اندیشمندان ایرانی</div>
            <div className="qt-about-sub">صادق هدایت، احمد کسروی، میرزا فتحعلی آخوندزاده و دیگران</div>
          </div>
        </div>
        <div className="qt-about-divider" />
        <div className="qt-about-row">
          <span className="qt-about-icon">🌍</span>
          <div>
            <div className="qt-about-title">فیلسوفان جهان</div>
            <div className="qt-about-sub">نیچه، راسل، داوکینز، هیچنز، هاوکینگ و دیگران</div>
          </div>
        </div>
        <div className="qt-about-divider" />
        <div className="qt-about-row">
          <span className="qt-about-icon">🔄</span>
          <div>
            <div className="qt-about-title">تناوب روزانه</div>
            <div className="qt-about-sub">هر روز یک نقل‌قول جدید به‌طور خودکار نمایش داده می‌شود</div>
          </div>
        </div>
      </div>
    </div>
  )
}
