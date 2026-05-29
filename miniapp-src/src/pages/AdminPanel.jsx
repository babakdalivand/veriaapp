import { useState, useEffect, useCallback } from 'react'
import './AdminPanel.css'

const TABS = [
  { id: 'settings', label: '⚙️ تنظیمات' },
  { id: 'keywords', label: '🔤 کلمات' },
  { id: 'commands', label: '🤖 دستورات' },
  { id: 'quotes',   label: '💬 نقل‌قول' },
  { id: 'users',    label: '👥 کاربران' },
]

export default function AdminPanel({ me }) {
  const [tab, setTab] = useState('settings')
  const initData = window?.Telegram?.WebApp?.initData || ''
  const qs = `?initData=${encodeURIComponent(initData || 'dev')}`

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
        {tab === 'settings' && <SettingsTab qs={qs} initData={initData} />}
        {tab === 'keywords' && <KeywordsTab qs={qs} initData={initData} />}
        {tab === 'commands' && <CommandsTab qs={qs} initData={initData} />}
        {tab === 'quotes'   && <QuotesTab qs={qs} initData={initData} />}
        {tab === 'users'    && <UsersTab qs={qs} initData={initData} />}
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
      await fetch(`/api/admin/settings${qs}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...patch, initData }),
      })
      setS(p => ({ ...p, ...patch }))
      setMsg('✅ ذخیره شد')
    } catch { setMsg('❌ خطا') }
    setSaving(false)
    setTimeout(() => setMsg(''), 3000)
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
            <div style={{ color: '#44445a', fontSize: '.78rem', marginBottom: 10 }}>از اکانت‌های پیش‌فرض استفاده می‌شود</div>
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
          <div className="ap-setting-label" style={{ marginBottom: 6, marginTop: 10 }}>⚠️ حد اخطار گروه</div>
          <input className="ap-input" type="number" min={1} max={10} value={s.warnLimit || 3} dir="ltr"
            onChange={e => setS(p => ({ ...p, warnLimit: parseInt(e.target.value) || 3 }))} />
        </div>
        <button className="ap-save-btn" onClick={() => save({ welcomeMessage: s.welcomeMessage, warnLimit: s.warnLimit })} disabled={saving}>
          {saving ? 'در حال ذخیره...' : '💾 ذخیره تنظیمات'}
        </button>
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

/* ── Users ── */
function UsersTab({ qs, initData }) {
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
              {u.role !== 'premium' && u.role !== 'owner' && (
                <button className="qa-btn-sm" style={{ background:'rgba(201,160,42,.1)', border:'1px solid rgba(201,160,42,.25)', color:'#c9a02a' }}
                  onClick={() => givePremium(u)}>⭐ پریمیوم</button>
              )}
              {u.role === 'premium' && (
                <button className="qa-btn-sm qa-btn-toggle" onClick={() => updateUser(u.telegramId, { role:'user', premiumExpiry:null })}>
                  لغو پریمیوم
                </button>
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
