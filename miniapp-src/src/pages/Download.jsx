import { useState, useRef, useCallback, useEffect } from 'react'
import './Download.css'

const SUPPORTED = [
  { id: 'instagram',   name: 'اینستاگرام',  emoji: '📷', example: 'instagram.com/...' },
  { id: 'tiktok',      name: 'تیک‌تاک',     emoji: '🎵', example: 'tiktok.com/...' },
  { id: 'soundcloud',  name: 'ساندکلاد',    emoji: '🎵', example: 'soundcloud.com/...' },
  { id: 'youtube',     name: 'یوتیوب',      emoji: '📺', example: 'youtube.com/...' },
  { id: 'twitter',     name: 'توییتر / X',  emoji: '🐦', example: 'x.com/...' },
  { id: 'vimeo',       name: 'ویمیو',       emoji: '🎬', example: 'vimeo.com/...' },
  { id: 'dailymotion', name: 'دیلی‌موشن',   emoji: '🎬', example: 'dailymotion.com/...' },
  { id: 'pinterest',   name: 'پینترست',     emoji: '📌', example: 'pinterest.com/...' },
]

const PLATFORM_MAP = {
  youtube:    { name: 'یوتیوب',      emoji: '📺' },
  instagram:  { name: 'اینستاگرام',  emoji: '📷' },
  twitter:    { name: 'توییتر / X',  emoji: '🐦' },
  tiktok:     { name: 'تیک‌تاک',     emoji: '🎵' },
  soundcloud: { name: 'ساندکلاد',    emoji: '🎵' },
  vimeo:      { name: 'ویمیو',       emoji: '🎬' },
  dailymotion:{ name: 'دیلی‌موشن',   emoji: '🎬' },
  pinterest:  { name: 'پینترست',     emoji: '📌' },
}

function detectPlatformClient(url) {
  try {
    const u = url.toLowerCase()
    if (/youtube\.com|youtu\.be/.test(u)) return 'youtube'
    if (/instagram\.com/.test(u)) return 'instagram'
    if (/twitter\.com|x\.com/.test(u)) return 'twitter'
    if (/tiktok\.com|vm\.tiktok\.com/.test(u)) return 'tiktok'
    if (/soundcloud\.com/.test(u)) return 'soundcloud'
    if (/vimeo\.com/.test(u)) return 'vimeo'
    if (/dailymotion\.com|dai\.ly/.test(u)) return 'dailymotion'
    if (/pinterest\.com|pin\.it/.test(u)) return 'pinterest'
  } catch {}
  return null
}

function formatDur(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function Download({ me, meLoading }) {
  const [url, setUrl]           = useState('')
  const [platform, setPlatform] = useState(null)
  const [mode, setMode]         = useState('video')   // 'video' | 'audio'
  const [status, setStatus]     = useState(null)      // { type, msg }
  const [target, setTarget]     = useState('me')      // 'me' | 'channel'

  // YouTube-specific state
  const [ytInfo, setYtInfo]       = useState(null)    // null | {loading} | {title, duration, formats, videoId} | {error}
  const [ytQuality, setYtQuality] = useState(null)    // selected height number

  const inputRef = useRef(null)
  const isAdmin = me?.role === 'admin' || me?.role === 'owner'

  // YouTube channel mode = show quality selector
  const isYtChannelMode = platform === 'youtube' && isAdmin && target === 'channel'

  // Reset YouTube state when URL or target changes
  useEffect(() => {
    setYtInfo(null)
    setYtQuality(null)
  }, [url, target])

  const handleUrlChange = useCallback((e) => {
    const v = e.target.value
    setUrl(v)
    setPlatform(v.trim() ? detectPlatformClient(v.trim()) : null)
    setStatus(null)
  }, [])

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setUrl(text)
        setPlatform(detectPlatformClient(text.trim()))
        setStatus(null)
      }
    } catch {}
    inputRef.current?.focus()
  }, [])

  const fetchYtInfo = useCallback(async () => {
    const trimmed = url.trim()
    const initData = window.Telegram?.WebApp?.initData || ''
    if (!initData || !trimmed) return
    setYtInfo({ loading: true })
    try {
      const qs = `?initData=${encodeURIComponent(initData)}`
      const r = await fetch(`/api/youtube/info${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
      setYtInfo(d)
      setYtQuality(d.formats?.[0]?.height ?? null)
    } catch (e) {
      setYtInfo({ error: e.message })
    }
  }, [url])

  const handleDownload = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) return
    if (!platform) {
      setStatus({ type: 'error', msg: 'پلتفرم پشتیبانی نمی‌شود. لینک را بررسی کنید.' })
      return
    }

    const initData = window.Telegram?.WebApp?.initData || ''
    if (!initData) {
      setStatus({ type: 'error', msg: 'لطفاً از داخل تلگرام استفاده کنید.' })
      return
    }

    const qs = `?initData=${encodeURIComponent(initData)}`

    // YouTube → Channel: use quality-aware endpoint
    if (isYtChannelMode) {
      if (!ytInfo || !ytInfo.videoId) {
        setStatus({ type: 'error', msg: 'ابتدا اطلاعات ویدیو را دریافت کنید.' })
        return
      }
      setStatus({ type: 'loading', msg: 'در حال دانلود و ارسال به کانال...' })
      try {
        const r = await fetch(`/api/youtube/to-channel${qs}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId: ytInfo.videoId, height: ytQuality }),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
        setStatus({ type: 'success', msg: `✅ "${ytInfo.title?.slice(0, 40)}" در کانال ارسال شد!` })
        setUrl('')
        setPlatform(null)
        setYtInfo(null)
        setYtQuality(null)
      } catch (e) {
        setStatus({ type: 'error', msg: `❌ ${e.message}` })
      }
      return
    }

    // Standard cobalt flow (all other cases including YouTube → me)
    const endpoint = target === 'channel' ? '/api/download/to-channel' : '/api/download/to-me'
    setStatus({ type: 'loading', msg: target === 'channel' ? 'در حال ارسال به کانال...' : 'در حال ارسال به پیام‌های شما...' })

    try {
      const r = await fetch(`${endpoint}${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, mode }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
      const successMsg = target === 'channel'
        ? '✅ فایل در کانال ارسال شد!'
        : '✅ فایل برای شما در تلگرام ارسال شد!'
      setStatus({ type: 'success', msg: successMsg })
      setUrl('')
      setPlatform(null)
    } catch (e) {
      setStatus({ type: 'error', msg: `❌ ${e.message}` })
    }
  }, [url, platform, mode, target, isYtChannelMode, ytInfo, ytQuality])

  const pInfo = platform ? PLATFORM_MAP[platform] : null

  // Determine if download button should be disabled
  const isDownloadReady = url.trim() && pInfo && status?.type !== 'loading'
  const ytChannelReady = isYtChannelMode && ytInfo?.videoId && ytQuality

  return (
    <div className="page dl-page">
      <div className="dl-hero">
        <div className="dl-hero-icon">⬇️</div>
        <h1 className="dl-hero-title">دانلودر رسانه</h1>
        <p className="dl-hero-sub">لینک از هر پلتفرمی وارد کنید</p>
      </div>

      {/* Supported platforms chips */}
      <div className="dl-platforms">
        {SUPPORTED.map(p => (
          <span key={p.id} className={`dl-chip ${platform === p.id ? 'active' : ''}`}>
            {p.emoji} {p.name}
          </span>
        ))}
      </div>

      {/* URL input */}
      <div className="dl-input-wrap card">
        <div className="dl-input-row">
          <input
            ref={inputRef}
            className="dl-input"
            type="url"
            inputMode="url"
            placeholder="لینک را اینجا وارد کنید..."
            value={url}
            onChange={handleUrlChange}
            dir="ltr"
          />
          <button className="dl-paste-btn" onClick={handlePaste} title="جای‌گذاری از کلیپبورد">
            📋
          </button>
        </div>

        {pInfo && (
          <div className="dl-detected">
            <span className="dl-detected-icon">{pInfo.emoji}</span>
            <span className="dl-detected-name">{pInfo.name} شناسایی شد</span>
            <span className="dl-detected-ok">✓</span>
          </div>
        )}
        {url.trim() && !pInfo && (
          <div className="dl-detected dl-detected-err">
            <span>⚠️ پلتفرم ناشناخته</span>
          </div>
        )}
      </div>

      {/* Mode toggle: video / audio — hidden in YouTube channel mode */}
      {!isYtChannelMode && (
        <div className="dl-mode-row card">
          <span className="dl-mode-label">فرمت:</span>
          <div className="dl-mode-toggle">
            <button
              className={`dl-mode-btn ${mode === 'video' ? 'active' : ''}`}
              onClick={() => setMode('video')}
            >
              🎬 ویدیو
            </button>
            <button
              className={`dl-mode-btn ${mode === 'audio' ? 'active' : ''}`}
              onClick={() => setMode('audio')}
            >
              🎵 صدا MP3
            </button>
          </div>
        </div>
      )}

      {/* Target: me / channel (admin only) */}
      {isAdmin && (
        <div className="dl-target-row card">
          <span className="dl-mode-label">ارسال به:</span>
          <div className="dl-mode-toggle">
            <button
              className={`dl-mode-btn ${target === 'me' ? 'active' : ''}`}
              onClick={() => setTarget('me')}
            >
              👤 پیام‌های من
            </button>
            <button
              className={`dl-mode-btn ${target === 'channel' ? 'active' : ''}`}
              onClick={() => setTarget('channel')}
            >
              📢 کانال
            </button>
          </div>
        </div>
      )}

      {/* YouTube Channel Mode: quality selector */}
      {isYtChannelMode && pInfo && (
        <div className="dl-yt-section card">
          {!ytInfo && (
            <button
              className="btn btn-blue btn-full"
              onClick={fetchYtInfo}
              disabled={status?.type === 'loading'}
            >
              📺 دریافت کیفیت‌های موجود
            </button>
          )}

          {ytInfo?.loading && (
            <div className="dl-yt-loading">
              <span className="dl-spinner" /> در حال دریافت اطلاعات ویدیو...
            </div>
          )}

          {ytInfo?.error && (
            <div className="dl-yt-error">❌ {ytInfo.error}</div>
          )}

          {ytInfo?.videoId && (
            <>
              <div className="dl-yt-info">
                <div className="dl-yt-title">{ytInfo.title}</div>
                <div className="dl-yt-meta">
                  ⏱ {ytInfo.durationStr}
                  {ytInfo.viewCount > 0 && <> · 👁 {ytInfo.viewCount.toLocaleString()}</>}
                </div>
              </div>
              <div className="dl-yt-label">کیفیت:</div>
              <div className="dl-yt-qualities">
                {ytInfo.formats.map(f => (
                  <button
                    key={f.height}
                    className={`dl-quality-btn ${ytQuality === f.height ? 'active' : ''}`}
                    onClick={() => setYtQuality(f.height)}
                  >
                    <span className="dl-quality-res">{f.height}p</span>
                    {f.sizeMB && <span className="dl-quality-size">{f.sizeMB} MB</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Download button */}
      <button
        className={`btn btn-blue btn-full dl-btn ${!isDownloadReady || (isYtChannelMode && !ytChannelReady) ? 'disabled' : ''}`}
        onClick={handleDownload}
        disabled={!isDownloadReady || (isYtChannelMode && !ytChannelReady) || status?.type === 'loading'}
      >
        {status?.type === 'loading' ? (
          <span className="dl-spinner" />
        ) : isYtChannelMode ? (
          <>📺 پست به کانال{ytQuality ? ` (${ytQuality}p)` : ''}</>
        ) : (
          <>⬇️ {target === 'channel' ? 'ارسال به کانال' : 'دانلود برای من'}</>
        )}
      </button>

      {/* Status message */}
      {status && status.type !== 'loading' && (
        <div className={`dl-status ${status.type}`}>
          {status.msg}
        </div>
      )}

      {/* How it works */}
      <div className="dl-info card">
        <div className="dl-info-title">📖 نحوه استفاده</div>
        <ul className="dl-info-list">
          <li>لینک ویدیو/موزیک را از پلتفرم دلخواه کپی کنید</li>
          <li>اینجا Paste کنید و فرمت (ویدیو یا صدا) را انتخاب کنید</li>
          <li>برای یوتیوب → کانال: کیفیت را انتخاب کنید تا با دکمه CTA پست شود</li>
          <li>فایل مستقیماً در بات تلگرام برایتان ارسال می‌شود</li>
        </ul>
        <div className="dl-info-note">
          ⚠️ حداکثر حجم: ۴۵ MB — ویدیوهای بزرگتر ممکن است ارسال نشوند
        </div>
      </div>
    </div>
  )
}
