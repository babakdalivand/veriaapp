import { useState, useEffect, useCallback } from 'react'
import './AdminPanel.css'

const TABS = [
  { id: 'settings',  label: '⚙️ تنظیمات' },
  { id: 'announce',  label: '📢 اعلان' },
  { id: 'promos',    label: '📣 تبلیغات' },
  { id: 'payment',   label: '💳 پرداخت' },
  { id: 'keywords',  label: '🔤 کلمات' },
  { id: 'commands',  label: '🤖 دستورات' },
  { id: 'quotes',    label: '💬 نقل‌قول' },
  { id: 'scheduled', label: '📅 زمان‌بندی' },
  { id: 'users',     label: '👥 کاربران' },
  { id: 'ytmonitor', label: '📺 یوتیوب' },
]

export default function AdminPanel({ me, qs: qsProp, initData: initDataProp }) {
  const [tab, setTab] = useState('settings')
  const initData = initDataProp || window?.Telegram?.WebApp?.initData || ''
  const qs = qsProp || `?initData=${encodeURIComponent(initData || 'dev')}`

  return (
    <div className="page">
      <div className="ap-header">
        <div className="ap-orb" />
        <div className="ap-title">🛠 پنل مدیریت</div>
        <div className="ap-sub">VeriaApp Admin Panel — {me?.role || 'admin'}</div>
      </div>

      <div className="ap-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`ap-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        {tab === 'settings'  && <SettingsTab qs={qs} initData={initData} />}
        {tab === 'announce'  && <AnnouncementTab qs={qs} initData={initData} />}
        {tab === 'promos'    && <PromotionsTab qs={qs} initData={initData} />}
        {tab === 'payment'   && <PaymentTab qs={qs} initData={initData} />}
        {tab === 'keywords'  && <KeywordsTab qs={qs} initData={initData} />}
        {tab === 'commands' && <CommandsTab qs={qs} initData={initData} />}
        {tab === 'quotes'   && <QuotesTab qs={qs} initData={initData} />}
        {tab === 'scheduled' && <ScheduledTab qs={qs} initData={initData} />}
        {tab === 'users'    && <UsersTab qs={qs} initData={initData} me={me} />}
        {tab === 'ytmonitor' && <YtMonitorTab qs={qs} initData={initData} />}
      </div>
      <div style={{ height: 80 }} />
    </div>
  )
}

/* ── Settings ── */
function SettingsTab({ qs, initData }) {
  const [s, setS] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [groupInput, setGroupInput] = useState('')
  const [groupSaving, setGroupSaving] = useState(false)
  const [twInput, setTwInput] = useState('')
  const [twSaving, setTwSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/settings${qs}`).then(r => r.json()).then(setS).catch(() => {})
  }, [qs])

  async function save(patch) {
    setSaving(true); setMsg('')
    try {
      const r = await fetch(`/api/admin/settings${qs}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...patch, initData }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setMsg(`❌ خطا: ${d.error || r.status}`)
      } else {
        setS(p => ({ ...p, ...patch }))
        setMsg('✅ ذخیره شد')
      }
    } catch { setMsg('❌ خطا در اتصال') }
    setSaving(false)
    setTimeout(() => setMsg(''), 4000)
  }

  async function toggle(key) {
    if (!s) return
    await save({ [key]: !s[key] })
  }

  function parseGroups(raw) {
    return raw ? raw.split(',').map(g => g.trim()).filter(Boolean) : []
  }

  async function addGroup() {
    const val = groupInput.trim()
    if (!val || !s) return
    const groups = parseGroups(s.groupIds)
    if (groups.includes(val)) { setGroupInput(''); return }
    const updated = [...groups, val]
    setGroupSaving(true)
    await fetch(`/api/admin/settings${qs}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupIds: updated.join(','), mainGroupId: updated[0], initData }),
    })
    setS(p => ({ ...p, groupIds: updated.join(','), mainGroupId: updated[0] }))
    setGroupInput('')
    setGroupSaving(false)
  }

  async function removeGroup(gid) {
    if (!s) return
    const updated = parseGroups(s.groupIds).filter(g => g !== gid)
    await fetch(`/api/admin/settings${qs}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupIds: updated.join(','), mainGroupId: updated[0] || null, initData }),
    })
    setS(p => ({ ...p, groupIds: updated.join(','), mainGroupId: updated[0] || null }))
  }

  if (!s) return <div className="ap-empty">در حال بارگذاری...</div>

  const groups = parseGroups(s.groupIds)
  const twAccounts = parseGroups(s.twitterAccounts)

  async function addTwAccount() {
    const val = twInput.trim().replace('@', '')
    if (!val) return
    if (twAccounts.includes(val)) { setTwInput(''); return }
    const updated = [...twAccounts, val]
    setTwSaving(true)
    await fetch(`/api/admin/settings${qs}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ twitterAccounts: updated.join(','), initData }),
    })
    setS(p => ({ ...p, twitterAccounts: updated.join(',') }))
    setTwInput('')
    setTwSaving(false)
  }

  async function removeTwAccount(acc) {
    const updated = twAccounts.filter(a => a !== acc)
    await fetch(`/api/admin/settings${qs}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ twitterAccounts: updated.join(','), initData }),
    })
    setS(p => ({ ...p, twitterAccounts: updated.join(',') }))
  }

  return (
    <div>
      {msg && <div style={{ padding: '8px 16px', fontSize: '.8rem', color: msg.startsWith('✅') ? '#4caf50' : '#f85149' }}>{msg}</div>}

      <p className="sec-title">وضعیت سیستم</p>
      <div className="card" style={{ marginBottom: 0 }}>
        {[
          ['botEnabled', '🤖 بات', 'روشن/خاموش کردن کل بات'],
          ['captchaEnabled', '🔐 کپچا ورود', 'احراز هویت اعضای جدید گروه'],
          ['antiSpamEnabled', '🛡️ ضد اسپم', 'مسدود کردن پیام‌های تکراری'],
          ['antiLinkEnabled', '🔗 ضد لینک', 'حذف لینک‌های غیرمجاز در گروه'],
        ].map(([key, label, sub], i) => (
          <div key={key}>
            {i > 0 && <div className="ap-divider" />}
            <div className="ap-setting-row">
              <div>
                <div className="ap-setting-label">{label}</div>
                <div className="ap-setting-sub">{sub}</div>
              </div>
              <button
                className={`ap-toggle ${s[key] ? 'on' : 'off'}`}
                onClick={() => toggle(key)}
                disabled={saving}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="sec-title">📢 کانال ارسال محتوا</p>
      <div className="card">
        <div style={{ padding: '12px 16px 4px' }}>
          <div className="ap-setting-sub" style={{ marginBottom: 8 }}>نقل‌قول روزانه و پست‌های ادمین به این کانال ارسال می‌شوند</div>
          {s.mainChannelId && (
            <div style={{ padding: '8px 0 2px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '.72rem', color: 'var(--t3)' }}>فعلی:</span>
              <div className="ap-kw-chip" style={{ background: 'rgba(90,160,255,.12)', borderColor: 'rgba(90,160,255,.3)' }}>
                <span style={{ direction: 'ltr', color: 'var(--blue)', fontSize: '.75rem' }}>{s.mainChannelId}</span>
              </div>
            </div>
          )}
          <input className="ap-input" value={s.mainChannelId || ''} placeholder="@channel_username یا -100xxxxxxxxxx"
            onChange={e => setS(p => ({ ...p, mainChannelId: e.target.value }))} dir="ltr" />
        </div>
        <button className="ap-save-btn" onClick={() => save({ mainChannelId: s.mainChannelId })} disabled={saving}>
          {saving ? 'در حال ذخیره...' : '💾 ذخیره کانال'}
        </button>
      </div>

      <p className="sec-title">💬 گروه‌ها ({groups.length})</p>
      <div className="card">
        <div style={{ padding: '8px 16px 4px' }}>
          <div className="ap-setting-sub" style={{ marginBottom: 10 }}>ضد اسپم، کپچا و کلمات ممنوعه در این گروه‌ها فعال می‌شوند</div>
          {groups.length > 0 && (
            <div className="ap-kw-list" style={{ padding: 0, marginBottom: 10 }}>
              {groups.map(gid => (
                <div key={gid} className="ap-kw-chip">
                  <span style={{ direction: 'ltr', fontFamily: 'monospace', fontSize: '.72rem' }}>{gid}</span>
                  <button className="ap-kw-del" onClick={() => removeGroup(gid)}>✕</button>
                </div>
              ))}
            </div>
          )}
          {groups.length === 0 && <div style={{ color: '#44445a', fontSize: '.78rem', marginBottom: 10 }}>هنوز گروهی اضافه نشده</div>}
        </div>
        <div className="ap-kw-add-row" style={{ padding: '0 16px 12px' }}>
          <input className="ap-kw-input" value={groupInput} dir="ltr"
            placeholder="@group_username یا -100xxxxxxxxxx"
            onChange={e => setGroupInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addGroup()} />
          <button className="ap-kw-btn" onClick={addGroup} disabled={groupSaving || !groupInput.trim()}>
            + افزودن
          </button>
        </div>
      </div>

      <p className="sec-title">🐦 اکانت‌های توییتر ({twAccounts.length || 'پیش‌فرض'})</p>
      <div className="card">
        <div style={{ padding: '8px 16px 4px' }}>
          <div className="ap-setting-sub" style={{ marginBottom: 10 }}>اکانت‌هایی که در تب توییتر Mini App نمایش داده می‌شوند</div>
          {twAccounts.length > 0 ? (
            <div className="ap-kw-list" style={{ padding: 0, marginBottom: 10 }}>
              {twAccounts.map(acc => (
                <div key={acc} className="ap-kw-chip">
                  <span style={{ direction: 'ltr', fontSize: '.75rem' }}>@{acc}</span>
                  <button className="ap-kw-del" onClick={() => removeTwAccount(acc)}>✕</button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--t3)', fontSize: '.78rem', marginBottom: 10 }}>از اکانت‌های پیش‌فرض استفاده می‌شود</div>
          )}
        </div>
        <div className="ap-kw-add-row" style={{ padding: '0 16px 12px' }}>
          <input className="ap-kw-input" value={twInput} dir="ltr"
            placeholder="@username یا username"
            onChange={e => setTwInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTwAccount()} />
          <button className="ap-kw-btn" onClick={addTwAccount} disabled={twSaving || !twInput.trim()}>
            + افزودن
          </button>
        </div>
      </div>

      <p className="sec-title">⚙️ سایر تنظیمات</p>
      <div className="card">
        <div style={{ padding: '12px 16px 4px' }}>
          <div className="ap-setting-label" style={{ marginBottom: 6 }}>📝 پیام خوش‌آمدگویی</div>
          <textarea className="ap-input" rows={3} value={s.welcomeMessage || ''} dir="rtl"
            onChange={e => setS(p => ({ ...p, welcomeMessage: e.target.value }))} />
          <div className="ap-setting-label" style={{ marginBottom: 6, marginTop: 10 }}>⚠️ حد اخطار گروه (۱ تا ۱۰)</div>
          <input className="ap-input" type="number" min={1} max={10} value={s.warnLimit ?? 3} dir="ltr"
            onChange={e => setS(p => ({ ...p, warnLimit: e.target.value === '' ? '' : Number(e.target.value) }))} />
        </div>
        <button className="ap-save-btn" onClick={() => save({ welcomeMessage: s.welcomeMessage, warnLimit: Math.max(1, Math.min(10, parseInt(s.warnLimit) || 3)) })} disabled={saving}>
          {saving ? 'در حال ذخیره...' : '💾 ذخیره تنظیمات'}
        </button>
      </div>

      <p className="sec-title">📋 قوانین گروه و کانال</p>
      <div className="card">
        <div style={{ padding: '12px 16px 4px' }}>
          <div className="ap-setting-sub" style={{ marginBottom: 8 }}>در صفحه اول همه کاربران نمایش داده می‌شود</div>
          <textarea className="ap-input" rows={8} value={s.rulesText || ''} dir="rtl"
            placeholder={'۱. احترام متقابل را رعایت کنید\n۲. تبلیغات ممنوع\n۳. ...'}
            onChange={e => setS(p => ({ ...p, rulesText: e.target.value }))} />
        </div>
        <button className="ap-save-btn" onClick={() => save({ rulesText: s.rulesText })} disabled={saving}>
          {saving ? 'در حال ذخیره...' : '💾 ذخیره قوانین'}
        </button>
      </div>
    </div>
  )
}

/* ── Payment Settings ── */
function PaymentTab({ qs, initData }) {
  const [form, setForm] = useState({ paypalUrl: '', walletBTC: '', walletUSDT: '', premiumPrice: 100 })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    fetch(`/api/payment-info${qs}`).then(r => r.json()).then(d => {
      setForm({
        paypalUrl:    d.paypalUrl    || '',
        walletBTC:    d.walletBTC    || '',
        walletUSDT:   d.walletUSDT   || '',
        premiumPrice: d.premiumPrice || 100,
      })
    }).catch(() => {})
  }, [qs])

  async function save() {
    setSaving(true); setMsg('')
    try {
      const r = await fetch(`/api/admin/payment-settings${qs}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, premiumPrice: parseInt(form.premiumPrice) || 100, initData }),
      })
      if (r.ok) setMsg('✅ ذخیره شد')
      else setMsg('❌ خطا در ذخیره')
    } catch { setMsg('❌ خطا در اتصال') }
    setSaving(false)
    setTimeout(() => setMsg(''), 4000)
  }

  return (
    <div>
      <p className="sec-title">تنظیمات پرداخت پریمیوم</p>
      <div className="card" style={{ margin: '0 16px' }}>
        <div style={{ padding: '12px 16px 8px' }}>
          <div className="ap-setting-sub" style={{ marginBottom: 14 }}>
            آدرس‌های پرداخت که کاربران هنگام خرید پریمیوم می‌بینند. هر فیلد که خالی باشد نمایش داده نمی‌شود.
          </div>

          <div className="ap-field">
            <label>💰 قیمت پریمیوم (ستاره تلگرام)</label>
            <input type="number" min={1} value={form.premiumPrice} dir="ltr"
              onChange={e => setForm(p => ({ ...p, premiumPrice: e.target.value }))}
              placeholder="مثال: 100" />
          </div>

          <div className="ap-field">
            <label>💳 لینک PayPal</label>
            <input value={form.paypalUrl} dir="ltr"
              onChange={e => setForm(p => ({ ...p, paypalUrl: e.target.value }))}
              placeholder="https://paypal.me/yourusername" />
          </div>

          <div className="ap-field">
            <label>₿ آدرس کیف پول Bitcoin (BTC)</label>
            <input value={form.walletBTC} dir="ltr"
              onChange={e => setForm(p => ({ ...p, walletBTC: e.target.value }))}
              placeholder="bc1q..." />
          </div>

          <div className="ap-field">
            <label>💵 آدرس کیف پول USDT (TRC20)</label>
            <input value={form.walletUSDT} dir="ltr"
              onChange={e => setForm(p => ({ ...p, walletUSDT: e.target.value }))}
              placeholder="T..." />
          </div>

          {msg && <div style={{ fontSize: '.8rem', color: msg.startsWith('✅') ? '#4caf50' : '#f85149', marginBottom: 8 }}>{msg}</div>}
        </div>
        <button className="ap-save-btn" onClick={save} disabled={saving}>
          {saving ? 'در حال ذخیره...' : '💾 ذخیره تنظیمات پرداخت'}
        </button>
      </div>

      <div className="card" style={{ margin: '12px 16px 0', padding: '12px 16px' }}>
        <div style={{ fontSize: '.78rem', color: 'var(--t3)', lineHeight: 1.7 }}>
          <div style={{ fontWeight: 700, color: 'var(--t2)', marginBottom: 6 }}>📌 راهنما</div>
          <div>• کاربران پس از کلیک «خرید پریمیوم» این روش‌های پرداخت را می‌بینند</div>
          <div>• پس از دریافت پرداخت، از پنل کاربران نقش پریمیوم را دستی تخصیص دهید</div>
          <div>• برای USDT از شبکه TRC20 (ترون) استفاده کنید</div>
        </div>
      </div>
    </div>
  )
}

/* ── Keywords ── */
function KeywordsTab({ qs, initData }) {
  const [keywords, setKeywords] = useState([])
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    const r = await fetch(`/api/admin/settings${qs}`)
    const d = await r.json()
    setKeywords(d.keywords ? d.keywords.split(',').map(k => k.trim()).filter(Boolean) : [])
  }

  useEffect(() => { load() }, [qs])

  async function addKeyword() {
    const kw = input.trim().toLowerCase()
    if (!kw || keywords.includes(kw)) return
    const updated = [...keywords, kw]
    setSaving(true)
    await fetch(`/api/admin/settings${qs}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: updated.join(','), initData }),
    })
    setKeywords(updated)
    setInput('')
    setSaving(false)
  }

  async function removeKeyword(kw) {
    const updated = keywords.filter(k => k !== kw)
    await fetch(`/api/admin/settings${qs}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: updated.join(','), initData }),
    })
    setKeywords(updated)
  }

  return (
    <div>
      <p className="sec-title">کلمات ممنوعه ({keywords.length})</p>
      <div className="ap-kw-add-row">
        <input className="ap-kw-input" value={input} onChange={e => setInput(e.target.value)}
          placeholder="کلمه ممنوعه..." onKeyDown={e => e.key === 'Enter' && addKeyword()} />
        <button className="ap-kw-btn" onClick={addKeyword} disabled={saving || !input.trim()}>+ افزودن</button>
      </div>
      {keywords.length === 0 ? (
        <p className="ap-empty">هنوز کلمه ممنوعه‌ای ثبت نشده</p>
      ) : (
        <div className="ap-kw-list">
          {keywords.map(kw => (
            <div key={kw} className="ap-kw-chip">
              <span>{kw}</span>
              <button className="ap-kw-del" onClick={() => removeKeyword(kw)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Bot Commands ── */
function CommandsTab({ qs, initData }) {
  const [commands, setCommands] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ command: '', description: '', response: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch(`/api/admin/commands${qs}`)
    if (r.ok) setCommands(await r.json())
    setLoading(false)
  }, [qs])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setForm({ command: '', description: '', response: '' })
    setModal({ mode: 'add' })
  }

  function openEdit(c) {
    setForm({ command: c.command, description: c.description, response: c.response || '' })
    setModal({ mode: 'edit', item: c })
  }

  async function saveForm() {
    if (!form.command || !form.description) return
    setSaving(true)
    const isEdit = modal?.mode === 'edit'
    const url = isEdit ? `/api/admin/commands/${modal.item.id}${qs}` : `/api/admin/commands${qs}`
    const method = isEdit ? 'PUT' : 'POST'
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, initData }),
    })
    setSaving(false)
    setModal(null)
    await load()
  }

  async function deleteCmd(c) {
    await fetch(`/api/admin/commands/${c.id}${qs}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    })
    setCommands(prev => prev.filter(x => x.id !== c.id))
  }

  async function toggleCmd(c) {
    await fetch(`/api/admin/commands/${c.id}${qs}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !c.isActive, initData }),
    })
    setCommands(prev => prev.map(x => x.id === c.id ? { ...x, isActive: !x.isActive } : x))
  }

  return (
    <div>
      <div style={{ padding: '4px 16px 0' }}>
        <button className="ap-save-btn" style={{ width: '100%', margin: 0 }} onClick={openAdd}>
          + افزودن دستور سفارشی
        </button>
      </div>
      <p className="sec-title">دستورات slash سفارشی</p>
      {loading ? <div className="ap-empty">در حال بارگذاری...</div>
        : commands.length === 0 ? <p className="ap-empty">هنوز دستوری اضافه نشده</p>
        : commands.map(c => (
          <div key={c.id} className={`ap-cmd-item card ${!c.isActive ? 'qa-item-inactive' : ''}`} style={{ margin: '0 16px 10px' }}>
            <div className="ap-cmd-name">/{c.command}</div>
            <div className="ap-cmd-desc">{c.description}</div>
            {c.response && <div className="ap-cmd-resp">↳ {c.response.slice(0, 80)}{c.response.length > 80 ? '...' : ''}</div>}
            <div className="ap-cmd-btns">
              <button className="qa-btn-sm qa-btn-edit" onClick={() => openEdit(c)}>ویرایش</button>
              <button className="qa-btn-sm qa-btn-toggle" onClick={() => toggleCmd(c)}>{c.isActive ? 'غیرفعال' : 'فعال'}</button>
              <button className="qa-btn-sm qa-btn-del" onClick={() => deleteCmd(c)}>حذف</button>
            </div>
          </div>
        ))
      }

      {modal && (
        <div className="ap-modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="ap-modal">
            <div className="ap-modal-title">{modal.mode === 'add' ? '+ دستور جدید' : '✏️ ویرایش دستور'}</div>
            <div className="ap-field">
              <label>نام دستور (بدون /) *</label>
              <input value={form.command} onChange={e => setForm(p => ({ ...p, command: e.target.value.replace(/\//g,'').toLowerCase() }))}
                placeholder="مثال: about" disabled={modal.mode === 'edit'} />
            </div>
            <div className="ap-field">
              <label>توضیح (در منوی تلگرام) *</label>
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="مثال: درباره ما" />
            </div>
            <div className="ap-field">
              <label>پاسخ بات (اختیاری)</label>
              <textarea dir="rtl" rows={3} value={form.response}
                onChange={e => setForm(p => ({ ...p, response: e.target.value }))}
                placeholder="متنی که بات در پاسخ به این دستور ارسال می‌کند..." />
            </div>
            <div className="ap-modal-actions">
              <button className="ap-btn-primary" onClick={saveForm} disabled={saving}>{saving ? 'ذخیره...' : 'ذخیره'}</button>
              <button className="ap-btn-cancel" onClick={() => setModal(null)}>لغو</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Quotes (embedded) ── */
function QuotesTab({ qs, initData }) {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ text: '', author: '', category: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch(`/api/admin/quotes${qs}`)
    if (r.ok) setQuotes(await r.json())
    setLoading(false)
  }, [qs])

  useEffect(() => { load() }, [load])

  async function triggerNow() {
    setTriggering(true)
    const r = await fetch(`/api/admin/trigger-quote${qs}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    })
    const d = await r.json()
    window?.Telegram?.WebApp?.showAlert(d.ok ? '✅ ارسال شد!' : '❌ ' + d.error)
    setTriggering(false)
  }

  async function saveForm() {
    if (!form.text.trim() || !form.author.trim()) return
    setSaving(true)
    const isEdit = modal?.mode === 'edit'
    const url = isEdit ? `/api/admin/quotes/${modal.quote.id}${qs}` : `/api/admin/quotes${qs}`
    await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, initData }),
    })
    setSaving(false); setModal(null); await load()
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, padding: '4px 16px 0' }}>
        <button className="ap-save-btn" style={{ flex: 1, margin: 0 }} onClick={() => { setForm({ text:'', author:'', category:'' }); setModal({ mode:'add' }) }}>
          + نقل‌قول
        </button>
        <button className="ap-save-btn" style={{ margin: 0, background: 'rgba(139,92,246,.15)', borderColor: 'rgba(139,92,246,.3)', color: '#8b5cf6' }}
          onClick={triggerNow} disabled={triggering}>{triggering ? '⏳' : '📤'}</button>
      </div>
      <p className="sec-title">{quotes.length} نقل‌قول</p>
      {loading ? <div className="ap-empty">در حال بارگذاری...</div>
        : quotes.length === 0 ? <p className="ap-empty">خالی است</p>
        : quotes.map(q => (
          <div key={q.id} className={`qa-item card ${!q.isActive ? 'qa-item-inactive' : ''}`} style={{ margin: '0 16px 10px' }}>
            <div className="qa-item-author">— {q.author}</div>
            <div className="qa-item-text">{q.text}</div>
            <div className="qa-item-btns">
              <button className="qa-btn-sm qa-btn-edit" onClick={() => { setForm({ text: q.text, author: q.author, category: q.category||'' }); setModal({ mode:'edit', quote: q }) }}>ویرایش</button>
              <button className="qa-btn-sm qa-btn-toggle" onClick={async () => {
                await fetch(`/api/admin/quotes/${q.id}${qs}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ isActive:!q.isActive, initData }) })
                setQuotes(p => p.map(x => x.id===q.id ? {...x, isActive:!x.isActive} : x))
              }}>{q.isActive ? 'غیرفعال' : 'فعال'}</button>
              <button className="qa-btn-sm qa-btn-del" onClick={async () => {
                await fetch(`/api/admin/quotes/${q.id}${qs}`, { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ initData }) })
                setQuotes(p => p.filter(x => x.id!==q.id))
              }}>حذف</button>
            </div>
          </div>
        ))
      }
      {modal && (
        <div className="ap-modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="ap-modal">
            <div className="ap-modal-title">{modal.mode==='add' ? '+ نقل‌قول جدید' : '✏️ ویرایش'}</div>
            <div className="ap-field"><label>متن *</label><textarea dir="rtl" rows={3} value={form.text} onChange={e => setForm(p=>({...p,text:e.target.value}))} /></div>
            <div className="ap-field"><label>نویسنده *</label><input value={form.author} onChange={e => setForm(p=>({...p,author:e.target.value}))} /></div>
            <div className="ap-field"><label>دسته‌بندی</label><input value={form.category} onChange={e => setForm(p=>({...p,category:e.target.value}))} /></div>
            <div className="ap-modal-actions">
              <button className="ap-btn-primary" onClick={saveForm} disabled={saving}>{saving?'ذخیره...':'ذخیره'}</button>
              <button className="ap-btn-cancel" onClick={() => setModal(null)}>لغو</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Scheduled Posts ── */
function ScheduledTab({ qs, initData }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ content: '', mediaType: 'text', channelId: '', scheduledAt: '' })

  function defaultScheduledAt() {
    const d = new Date(Date.now() + 60 * 60 * 1000)
    const pad = n => String(n).padStart(2,'0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch(`/api/admin/scheduled${qs}`)
    if (r.ok) setPosts(await r.json())
    setLoading(false)
  }, [qs])

  useEffect(() => { load() }, [load])

  async function saveForm() {
    if (!form.scheduledAt) return
    if (form.mediaType === 'text' && !form.content.trim()) return
    setSaving(true)
    const r = await fetch(`/api/admin/scheduled${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, scheduledAt: new Date(form.scheduledAt).toISOString(), initData }),
    })
    if (r.ok) { setModal(false); await load() }
    setSaving(false)
  }

  async function deletePost(id) {
    await fetch(`/api/admin/scheduled/${id}${qs}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    })
    setPosts(p => p.filter(x => x.id !== id))
  }

  function formatDate(d) {
    const dt = new Date(d)
    return dt.toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' })
  }

  return (
    <div>
      <div style={{ padding: '4px 16px 0' }}>
        <button className="ap-save-btn" style={{ width: '100%', margin: 0 }}
          onClick={() => { setForm({ content: '', mediaType: 'text', channelId: '', scheduledAt: defaultScheduledAt() }); setModal(true) }}>
          + زمان‌بندی پست جدید
        </button>
      </div>
      <p className="sec-title">پست‌های زمان‌بندی شده ({posts.length})</p>
      {loading ? <div className="ap-empty">در حال بارگذاری...</div>
        : posts.length === 0 ? <p className="ap-empty">پستی در صف نیست</p>
        : posts.map(p => (
          <div key={p.id} className="card" style={{ margin: '0 16px 10px', padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '.7rem', color: 'var(--gold)', marginBottom: 4 }}>
                  📅 {formatDate(p.scheduledAt)}
                  {p.channelId && <span style={{ color: 'var(--t3)', marginRight: 8 }}> → {p.channelId}</span>}
                </div>
                {p.mediaType === 'quote'
                  ? <div style={{ fontSize: '.8rem', color: 'var(--blue)' }}>🎲 نقل‌قول تصادفی</div>
                  : <div style={{ fontSize: '.8rem', color: 'var(--t1)', direction: 'rtl' }}>{p.content?.slice(0, 100)}{p.content?.length > 100 ? '...' : ''}</div>
                }
              </div>
              <button className="ap-kw-del" style={{ fontSize: '1rem', padding: '2px 6px' }} onClick={() => deletePost(p.id)}>✕</button>
            </div>
          </div>
        ))
      }

      {modal && (
        <div className="ap-modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="ap-modal">
            <div className="ap-modal-title">📅 پست جدید</div>
            <div className="ap-field">
              <label>نوع محتوا</label>
              <select style={{ background: 'var(--bg-input)', border: '1px solid var(--b1)', borderRadius: 8, padding: '10px 12px', color: 'var(--t1)', fontFamily: 'inherit', fontSize: '.83rem' }}
                value={form.mediaType} onChange={e => setForm(p => ({ ...p, mediaType: e.target.value }))}>
                <option value="text">📝 متن</option>
                <option value="quote">💬 نقل‌قول تصادفی</option>
              </select>
            </div>
            {form.mediaType === 'text' && (
              <div className="ap-field">
                <label>متن پست *</label>
                <textarea dir="rtl" rows={4} value={form.content}
                  onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  placeholder="متن پستی که به کانال ارسال می‌شود..." />
              </div>
            )}
            <div className="ap-field">
              <label>آیدی کانال (اختیاری — پیش‌فرض: کانال اصلی)</label>
              <input dir="ltr" value={form.channelId} placeholder="@channel یا -100xxxxxxxxxx"
                onChange={e => setForm(p => ({ ...p, channelId: e.target.value }))} />
            </div>
            <div className="ap-field">
              <label>زمان ارسال *</label>
              <input type="datetime-local" value={form.scheduledAt}
                onChange={e => setForm(p => ({ ...p, scheduledAt: e.target.value }))} />
            </div>
            <div className="ap-modal-actions">
              <button className="ap-btn-primary" onClick={saveForm} disabled={saving}>{saving ? 'ذخیره...' : 'زمان‌بندی'}</button>
              <button className="ap-btn-cancel" onClick={() => setModal(false)}>لغو</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Users ── */
function UsersTab({ qs, initData, me }) {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  async function doSearch() {
    setLoading(true)
    const r = await fetch(`/api/admin/users${qs}&search=${encodeURIComponent(search)}&limit=20`)
    if (r.ok) setUsers(await r.json())
    setLoading(false)
  }

  useEffect(() => { doSearch() }, [])

  async function updateUser(telegramId, patch) {
    await fetch(`/api/admin/users/${telegramId}${qs}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...patch, initData }),
    })
    setUsers(p => p.map(u => u.telegramId === telegramId ? { ...u, ...patch } : u))
  }

  async function givePremium(u) {
    const expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    await updateUser(u.telegramId, { role: 'premium', premiumExpiry: expiry })
  }

  const roleClass = (r) => {
    if (r === 'owner') return 'ap-role-owner'
    if (r === 'admin') return 'ap-role-admin'
    if (r === 'premium') return 'ap-role-premium'
    return 'ap-role-user'
  }

  return (
    <div>
      <div className="ap-search-row">
        <input className="ap-search-input" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="نام، یوزرنیم یا آیدی..." onKeyDown={e => e.key==='Enter' && doSearch()} />
        <button className="ap-search-btn" onClick={doSearch}>جستجو</button>
      </div>
      {loading ? <div className="ap-empty">در حال جستجو...</div>
        : users.length === 0 ? <p className="ap-empty">کاربری یافت نشد</p>
        : users.map(u => (
          <div key={u.telegramId} className="ap-user-item card" style={{ margin: '0 16px 10px' }}>
            <div className="ap-user-name">{u.firstName || 'بدون نام'} {u.username ? `(@${u.username})` : ''}</div>
            <div className="ap-user-id" dir="ltr">ID: {u.telegramId}</div>
            <div className="ap-user-meta">
              <span className={`ap-role-badge ${roleClass(u.role)}`}>{u.role}</span>
              {u.isBlocked && <span className="ap-blocked-badge">بلاک‌شده</span>}
              {u.premiumExpiry && new Date(u.premiumExpiry) > new Date() && (
                <span style={{ fontSize:'.65rem', color:'#44445a' }}>
                  پریمیوم تا {new Date(u.premiumExpiry).toLocaleDateString('fa-IR')}
                </span>
              )}
            </div>
            <div className="ap-user-btns">
              {/* پریمیوم */}
              {u.role !== 'premium' && u.role !== 'owner' && u.role !== 'admin' && (
                <button className="qa-btn-sm" style={{ background:'rgba(201,160,42,.1)', border:'1px solid rgba(201,160,42,.25)', color:'#c9a02a' }}
                  onClick={() => givePremium(u)}>⭐ پریمیوم</button>
              )}
              {u.role === 'premium' && (
                <button className="qa-btn-sm qa-btn-toggle" onClick={() => updateUser(u.telegramId, { role:'user', premiumExpiry:null })}>
                  لغو پریمیوم
                </button>
              )}
              {/* ادمین — فقط owner می‌تونه بده/بگیره */}
              {me?.role === 'owner' && u.role !== 'owner' && u.role !== 'admin' && (
                <button className="qa-btn-sm" style={{ background:'rgba(139,92,246,.1)', border:'1px solid rgba(139,92,246,.25)', color:'#8b5cf6' }}
                  onClick={() => updateUser(u.telegramId, { role:'admin' })}>🛠 ادمین</button>
              )}
              {me?.role === 'owner' && u.role === 'admin' && (
                <button className="qa-btn-sm" style={{ background:'rgba(248,81,73,.1)', border:'1px solid rgba(248,81,73,.2)', color:'#f85149' }}
                  onClick={() => updateUser(u.telegramId, { role:'user' })}>لغو ادمین</button>
              )}
              <button className="qa-btn-sm" style={{ background: u.isBlocked ? 'rgba(61,139,255,.1)' : 'rgba(248,81,73,.1)', border: `1px solid ${u.isBlocked ? 'rgba(61,139,255,.25)' : 'rgba(248,81,73,.2)'}`, color: u.isBlocked ? '#3d8bff' : '#f85149' }}
                onClick={() => updateUser(u.telegramId, { isBlocked: !u.isBlocked })}>
                {u.isBlocked ? 'رفع بلاک' : 'بلاک'}
              </button>
            </div>
          </div>
        ))
      }
    </div>
  )
}

/* ── YouTube Monitor ── */
function YtMonitorTab({ qs, initData }) {
  const [monitors,   setMonitors]  = useState([])
  const [loading,    setLoading]   = useState(true)
  const [input,      setInput]     = useState('')
  const [adding,     setAdding]    = useState(false)
  const [msg,        setMsg]       = useState(null)
  const [checking,   setChecking]  = useState(false)
  const [testingId,  setTestingId] = useState(null)

  const showMsg = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 5000) }

  const load = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/youtube-monitor${qs}`)
      .then(r => r.json()).then(d => setMonitors(Array.isArray(d) ? d : [])).catch(() => setMonitors([]))
      .finally(() => setLoading(false))
  }, [qs])

  useEffect(() => { load() }, [load])

  async function addChannel() {
    if (!input.trim()) return
    setAdding(true)
    try {
      const r = await fetch(`/api/admin/youtube-monitor${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelUrl: input.trim(), initData }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
      showMsg('success', `✅ کانال «${d.channelTitle}» ${d.created ? 'اضافه' : 'فعال'} شد`)
      setInput('')
      load()
    } catch (e) { showMsg('error', `❌ ${e.message}`) }
    setAdding(false)
  }

  async function toggleActive(m) {
    try {
      const r = await fetch(`/api/admin/youtube-monitor/${m.id}${qs}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !m.isActive, initData }),
      })
      if (!r.ok) throw new Error((await r.json()).error)
      setMonitors(prev => prev.map(x => x.id === m.id ? { ...x, isActive: !x.isActive } : x))
    } catch (e) { showMsg('error', `❌ ${e.message}`) }
  }

  async function remove(m) {
    if (!confirm(`حذف کانال «${m.channelTitle}»؟`)) return
    try {
      const r = await fetch(`/api/admin/youtube-monitor/${m.id}${qs}`, { method: 'DELETE' })
      if (!r.ok) throw new Error((await r.json()).error)
      setMonitors(prev => prev.filter(x => x.id !== m.id))
      showMsg('success', '✅ کانال حذف شد')
    } catch (e) { showMsg('error', `❌ ${e.message}`) }
  }

  async function checkNow() {
    setChecking(true)
    try {
      const r = await fetch(`/api/admin/youtube-monitor/check-now${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      showMsg('success', `✅ ${d.message}`)
    } catch (e) { showMsg('error', `❌ ${e.message}`) }
    setChecking(false)
  }

  async function testChannel(m) {
    setTestingId(m.id)
    try {
      const r = await fetch(`/api/admin/youtube-monitor/${m.id}/test${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error)
      showMsg('success', `✅ ${d.message}`)
    } catch (e) { showMsg('error', `❌ ${e.message}`) }
    setTestingId(null)
  }

  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div className="ap-section-title" style={{ marginBottom: 12 }}>
        📺 مانیتور کانال‌های یوتیوب
      </div>
      <p style={{ fontSize: '.8rem', color: 'var(--t3)', margin: '0 0 16px', lineHeight: 1.6 }}>
        هر ۱۵ دقیقه ویدیوها، شورت‌ها و لایوهای جدید به‌صورت خودکار در کانال تلگرام پست می‌شوند.
      </p>

      <div className="card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: '.8rem', color: 'var(--t3)', marginBottom: 8, fontWeight: 700 }}>
          افزودن کانال یوتیوب:
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="ap-input"
            placeholder="URL کانال یا @handle یا UCxxxxxx"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addChannel()}
            dir="ltr"
            style={{ flex: 1, fontSize: '.82rem' }}
          />
          <button className="ap-btn" onClick={addChannel} disabled={adding || !input.trim()} style={{ whiteSpace: 'nowrap' }}>
            {adding ? '⏳' : '➕ افزودن'}
          </button>
        </div>
        <div style={{ fontSize: '.72rem', color: 'var(--t3)', marginTop: 6, opacity: .7 }}>
          مثال: https://youtube.com/@channelname یا @channelname
        </div>
      </div>

      {msg && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 12, fontSize: '.85rem', fontWeight: 700,
          background: msg.type === 'success' ? 'rgba(78,199,96,.12)' : 'rgba(255,107,107,.1)',
          border: `1px solid ${msg.type === 'success' ? 'rgba(78,199,96,.25)' : 'rgba(255,107,107,.25)'}`,
          color: msg.type === 'success' ? 'var(--green)' : 'var(--red)',
        }}>
          {msg.text}
        </div>
      )}

      {monitors.length > 0 && (
        <button className="ap-btn" onClick={checkNow} disabled={checking} style={{ marginBottom: 14, width: '100%' }}>
          {checking ? '⏳ در حال بررسی...' : '🔍 بررسی فوری همه کانال‌ها'}
        </button>
      )}

      {loading ? (
        <div className="ap-empty">در حال بارگذاری...</div>
      ) : monitors.length === 0 ? (
        <div className="ap-empty">هنوز کانالی اضافه نشده.</div>
      ) : monitors.map(m => (
        <div key={m.id} className="card" style={{
          padding: 12, marginBottom: 10, opacity: m.isActive ? 1 : 0.55,
          display: 'flex', gap: 12, alignItems: 'center',
        }}>
          {m.thumbnailUrl && (
            <img src={m.thumbnailUrl} alt={m.channelTitle}
              style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              onError={e => { e.target.style.display = 'none' }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.channelTitle}
            </div>
            {m.channelHandle && (
              <div style={{ fontSize: '.72rem', color: 'var(--t3)', direction: 'ltr', textAlign: 'left' }}>
                {m.channelHandle}
              </div>
            )}
            <div style={{ fontSize: '.68rem', color: 'var(--t3)', marginTop: 2 }}>
              {m.postedCount} پست‌شده · {m.isActive ? '🟢 فعال' : '🔴 متوقف'}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            <button className="qa-btn-sm" onClick={() => testChannel(m)} disabled={testingId === m.id}
              style={{ background: 'rgba(61,139,255,.1)', border: '1px solid rgba(61,139,255,.25)', color: 'var(--blue)' }}>
              {testingId === m.id ? '⏳' : '🧪 تست'}
            </button>
            <button className="qa-btn-sm" onClick={() => toggleActive(m)}
              style={{
                background: m.isActive ? 'rgba(248,81,73,.1)' : 'rgba(78,199,96,.1)',
                border: `1px solid ${m.isActive ? 'rgba(248,81,73,.2)' : 'rgba(78,199,96,.25)'}`,
                color: m.isActive ? 'var(--red)' : 'var(--green)',
              }}>
              {m.isActive ? '⏸ توقف' : '▶️ فعال'}
            </button>
            <button className="qa-btn-sm" onClick={() => remove(m)}
              style={{ background: 'rgba(248,81,73,.1)', border: '1px solid rgba(248,81,73,.2)', color: 'var(--red)' }}>
              🗑 حذف
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Announcement ── */
function AnnouncementTab({ qs, initData }) {
  const [s, setS]       = useState({ announcementActive: false, announcementTitle: '', announcementText: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]   = useState('')

  useEffect(() => {
    fetch(`/api/admin/settings${qs}`).then(r => r.json()).then(d => {
      setS({
        announcementActive: !!d.announcementActive,
        announcementTitle:  d.announcementTitle || '',
        announcementText:   d.announcementText  || '',
      })
    }).catch(() => {})
  }, [qs])

  async function save() {
    setSaving(true); setMsg('')
    try {
      const r = await fetch(`/api/admin/announcement${qs}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...s, initData }),
      })
      if (r.ok) setMsg('✅ ذخیره شد')
      else setMsg('❌ خطا')
    } catch { setMsg('❌ خطا در اتصال') }
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
  }

  return (
    <div>
      <p className="sec-title">اعلان عمومی</p>
      <div className="card" style={{ margin: '0 16px' }}>
        <div style={{ padding: '12px 16px 8px' }}>
          <div className="ap-setting-row" style={{ marginBottom: 12 }}>
            <div>
              <div className="ap-setting-label">نمایش اعلان</div>
              <div className="ap-setting-sub">در صفحه اول همه کاربران نشان داده می‌شود</div>
            </div>
            <button className={`ap-toggle ${s.announcementActive ? 'on' : 'off'}`}
              onClick={() => setS(p => ({ ...p, announcementActive: !p.announcementActive }))} />
          </div>
          <div className="ap-field">
            <label>عنوان اعلان</label>
            <input value={s.announcementTitle} onChange={e => setS(p => ({ ...p, announcementTitle: e.target.value }))}
              placeholder="مثال: اطلاعیه مهم" dir="rtl" />
          </div>
          <div className="ap-field">
            <label>متن اعلان</label>
            <textarea rows={4} value={s.announcementText}
              onChange={e => setS(p => ({ ...p, announcementText: e.target.value }))}
              placeholder="متن اعلان که به کاربران نمایش داده می‌شود..." dir="rtl" />
          </div>
          {msg && <div style={{ fontSize: '.8rem', color: msg.startsWith('✅') ? '#4caf50' : '#f85149', marginBottom: 8 }}>{msg}</div>}
        </div>
        <button className="ap-save-btn" onClick={save} disabled={saving}>
          {saving ? 'در حال ذخیره...' : '💾 ذخیره اعلان'}
        </button>
      </div>
    </div>
  )
}

/* ── Promotions ── */
function PromotionsTab({ qs, initData }) {
  const [promos,  setPromos]  = useState([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState(null)
  const [form,    setForm]    = useState({ title: '', description: '', imageUrl: '', linkUrl: '', sortOrder: 0 })
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState(null)

  const showMsg = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 4000) }

  async function load() {
    setLoading(true)
    const r = await fetch(`/api/admin/promotions${qs}`)
    if (r.ok) setPromos(await r.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [qs])

  async function saveForm() {
    if (!form.title || !form.linkUrl) return
    setSaving(true)
    const isEdit = modal?.mode === 'edit'
    const url    = isEdit ? `/api/admin/promotions/${modal.item.id}${qs}` : `/api/admin/promotions${qs}`
    const method = isEdit ? 'PUT' : 'POST'
    const r = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, initData }),
    })
    if (r.ok) { setModal(null); await load(); showMsg('success', isEdit ? '✅ ویرایش شد' : '✅ اضافه شد') }
    else showMsg('error', '❌ خطا')
    setSaving(false)
  }

  async function toggleActive(p) {
    await fetch(`/api/admin/promotions/${p.id}${qs}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !p.isActive, initData }),
    })
    setPromos(prev => prev.map(x => x.id === p.id ? { ...x, isActive: !x.isActive } : x))
  }

  async function remove(p) {
    if (!confirm(`حذف «${p.title}»؟`)) return
    await fetch(`/api/admin/promotions/${p.id}${qs}`, { method: 'DELETE' })
    setPromos(prev => prev.filter(x => x.id !== p.id))
    showMsg('success', '✅ حذف شد')
  }

  function openAdd() {
    setForm({ title: '', description: '', imageUrl: '', linkUrl: '', sortOrder: 0 })
    setModal({ mode: 'add' })
  }

  function openEdit(p) {
    setForm({ title: p.title, description: p.description||'', imageUrl: p.imageUrl||'', linkUrl: p.linkUrl, sortOrder: p.sortOrder||0 })
    setModal({ mode: 'edit', item: p })
  }

  return (
    <div>
      <div style={{ padding: '4px 16px 0' }}>
        <button className="ap-save-btn" style={{ width: '100%', margin: 0 }} onClick={openAdd}>
          + افزودن تبلیغ جدید
        </button>
      </div>

      {msg && (
        <div style={{
          margin: '10px 16px 0', padding: '10px 14px', borderRadius: 10, fontSize: '.85rem', fontWeight: 700,
          background: msg.type === 'success' ? 'rgba(78,199,96,.12)' : 'rgba(255,107,107,.1)',
          color: msg.type === 'success' ? 'var(--green)' : 'var(--red)',
        }}>{msg.text}</div>
      )}

      <p className="sec-title">تبلیغات فعال ({promos.length})</p>
      {loading ? <div className="ap-empty">در حال بارگذاری...</div>
        : promos.length === 0 ? <p className="ap-empty">هنوز تبلیغی اضافه نشده</p>
        : promos.map(p => (
          <div key={p.id} className="card" style={{
            margin: '0 16px 10px', padding: 12, opacity: p.isActive ? 1 : 0.55,
            display: 'flex', gap: 10, alignItems: 'center',
          }}>
            {p.imageUrl && (
              <img src={p.imageUrl} alt={p.title} style={{
                width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0,
              }} onError={e => { e.target.style.display='none' }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '.85rem', color: 'var(--t1)', marginBottom: 2 }}>{p.title}</div>
              <div style={{ fontSize: '.7rem', color: 'var(--t3)', direction: 'ltr' }}>{p.linkUrl?.slice(0,40)}</div>
              <div style={{ fontSize: '.68rem', marginTop: 4, color: 'var(--t3)' }}>
                👁 {p.viewCount} بازدید · 👆 {p.clickCount} کلیک
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
              <button className="qa-btn-sm" onClick={() => openEdit(p)}
                style={{ background: 'rgba(61,139,255,.1)', border: '1px solid rgba(61,139,255,.25)', color: 'var(--blue)' }}>
                ✏️ ویرایش
              </button>
              <button className="qa-btn-sm" onClick={() => toggleActive(p)}
                style={{
                  background: p.isActive ? 'rgba(248,81,73,.1)' : 'rgba(78,199,96,.1)',
                  border: `1px solid ${p.isActive ? 'rgba(248,81,73,.2)' : 'rgba(78,199,96,.25)'}`,
                  color: p.isActive ? 'var(--red)' : 'var(--green)',
                }}>
                {p.isActive ? '⏸' : '▶️'}
              </button>
              <button className="qa-btn-sm" onClick={() => remove(p)}
                style={{ background: 'rgba(248,81,73,.1)', border: '1px solid rgba(248,81,73,.2)', color: 'var(--red)' }}>
                🗑
              </button>
            </div>
          </div>
        ))
      }

      {modal && (
        <div className="ap-modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="ap-modal">
            <div className="ap-modal-title">{modal.mode === 'add' ? '+ تبلیغ جدید' : '✏️ ویرایش تبلیغ'}</div>
            <div className="ap-field">
              <label>عنوان *</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="مثال: کانال یوتیوب ما" dir="rtl" />
            </div>
            <div className="ap-field">
              <label>توضیح مختصر</label>
              <textarea rows={2} value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="چند خط معرفی..." dir="rtl" />
            </div>
            <div className="ap-field">
              <label>لینک تصویر (URL)</label>
              <input value={form.imageUrl} onChange={e => setForm(p => ({ ...p, imageUrl: e.target.value }))}
                placeholder="https://example.com/image.jpg" dir="ltr" />
            </div>
            <div className="ap-field">
              <label>لینک مقصد *</label>
              <input value={form.linkUrl} onChange={e => setForm(p => ({ ...p, linkUrl: e.target.value }))}
                placeholder="https://youtube.com/@channel" dir="ltr" />
            </div>
            <div className="ap-field">
              <label>ترتیب نمایش (عدد کمتر = اول)</label>
              <input type="number" value={form.sortOrder}
                onChange={e => setForm(p => ({ ...p, sortOrder: Number(e.target.value) }))} dir="ltr" />
            </div>
            {form.imageUrl && (
              <img src={form.imageUrl} alt="preview" style={{
                width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 10,
              }} onError={e => { e.target.style.display='none' }} />
            )}
            <div className="ap-modal-actions">
              <button className="ap-btn-primary" onClick={saveForm} disabled={saving}>{saving ? 'ذخیره...' : 'ذخیره'}</button>
              <button className="ap-btn-cancel" onClick={() => setModal(null)}>لغو</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
