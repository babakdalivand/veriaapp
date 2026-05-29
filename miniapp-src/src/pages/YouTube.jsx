import './YouTube.css'
import { useTelegram } from '../hooks.js'

const STEPS = [
  { n:'۱', text: 'بات را در تلگرام باز کن' },
  { n:'۲', text: 'روی 📺 دانلود یوتیوب بزن' },
  { n:'۳', text: 'لینک یوتیوب را بفرست' },
  { n:'۴', text: 'کیفیت دلخواه را انتخاب کن' },
  { n:'۵', text: 'دانلود شروع می‌شه ⚡' },
]

export default function YouTube({ me }) {
  const { close } = useTelegram()
  const isPrem = me?.role === 'premium'

  return (
    <div className="page yt-page">
      <div className="yt-hero">
        <div className="yt-orb" />
        <div className="yt-icon">▶</div>
        <h2 className="yt-title">دانلود یوتیوب</h2>
        <p className="yt-sub">ویدیوهای یوتیوب رو مستقیم توی تلگرام دانلود کن</p>
      </div>

      {!isPrem && (
        <div className="yt-limit-banner">
          <span>⚠️</span>
          <span>کیفیت ۷۲۰p+ نیاز به پریمیوم دارد</span>
        </div>
      )}

      <p className="sec-title">نحوه استفاده</p>
      <div className="yt-steps">
        {STEPS.map(s => (
          <div key={s.n} className="yt-step card">
            <div className="yt-step-num">{s.n}</div>
            <div className="yt-step-text">{s.text}</div>
          </div>
        ))}
      </div>

      <p className="sec-title">کیفیت‌های موجود</p>
      <div className="yt-qualities">
        {[
          { q:'360p', free:true,  label:'SD' },
          { q:'720p', free:false, label:'HD' },
          { q:'1080p',free:false, label:'FHD' },
        ].map(q => (
          <div key={q.q} className={`yt-q card ${!q.free ? 'yt-q-prem' : ''}`}>
            <span className="yt-q-res">{q.q}</span>
            <span className="yt-q-tag">{q.label}</span>
            {!q.free && <span className="yt-q-lock">✦</span>}
          </div>
        ))}
      </div>

      <div className="yt-cta">
        <button className="btn btn-blue btn-full" onClick={close}>
          رفتن به بات ›
        </button>
      </div>
    </div>
  )
}
