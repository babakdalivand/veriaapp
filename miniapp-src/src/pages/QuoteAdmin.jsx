import { useState, useEffect, useCallback } from 'react'
import './QuoteAdmin.css'

export default function QuoteAdmin({ me, navigate }) {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [modal, setModal] = useState(null) // null | { mode: 'add' | 'edit', quote?: {} }
  const [form, setForm] = useState({ text: '', author: '', category: '' })
  const [saving, setSaving] = useState(false)

  const initData = window?.Telegram?.WebApp?.initData || ''
  const qs = initData ? `?initData=${encodeURIComponent(initData)}` : '?initData=dev'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/quotes${qs}`)
      if (r.ok) setQuotes(await r.json())
    } catch {}
    setLoading(false)
  }, [qs])

  useEffect(() => { load() }, [load])

  async function triggerNow() {
    setTriggering(true)
    try {
      const r = await fetch(`/api/admin/trigger-quote${qs.replace('?', '?')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
      const data = await r.json()
      if (data.ok) window?.Telegram?.WebApp?.showAlert('✅ نقل‌قول در کانال ارسال شد!')
      else window?.Telegram?.WebApp?.showAlert('❌ ' + (data.error || 'خطا'))
    } catch { window?.Telegram?.WebApp?.showAlert('❌ خطای شبکه') }
    setTriggering(false)
  }

  function openAdd() {
    setForm({ text: '', author: '', category: '' })
    setModal({ mode: 'add' })
  }

  function openEdit(q) {
    setForm({ text: q.text, author: q.author, category: q.category || '' })
    setModal({ mode: 'edit', quote: q })
  }

  async function saveForm() {
    if (!form.text.trim() || !form.author.trim()) return
    setSaving(true)
    try {
      const isEdit = modal?.mode === 'edit'
      const url = isEdit ? `/api/admin/quotes/${modal.quote.id}${qs}` : `/api/admin/quotes${qs}`
      const r = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, initData }),
      })
      if (r.ok) { setModal(null); await load() }
      else { const d = await r.json(); window?.Telegram?.WebApp?.showAlert('❌ ' + d.error) }
    } catch {}
    setSaving(false)
  }

  async function toggleActive(q) {
    try {
      await fetch(`/api/admin/quotes/${q.id}${qs}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !q.isActive, initData }),
      })
      setQuotes(prev => prev.map(x => x.id === q.id ? { ...x, isActive: !x.isActive } : x))
    } catch {}
  }

  async function deleteQuote(q) {
    const ok = await new Promise(resolve => {
      window?.Telegram?.WebApp?.showConfirm('حذف این نقل‌قول؟', resolve)
      if (!window?.Telegram?.WebApp?.showConfirm) resolve(window.confirm('حذف این نقل‌قول؟'))
    })
    if (!ok) return
    try {
      await fetch(`/api/admin/quotes/${q.id}${qs}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })
      setQuotes(prev => prev.filter(x => x.id !== q.id))
    } catch {}
  }

  return (
    <div className="page">
      <div className="qa-hero">
        <div className="qa-orb" />
        <div className="qa-icon">📝</div>
        <h2 className="qa-title">مدیریت نقل‌قول‌ها</h2>
        <p className="qa-sub">{quotes.length} نقل‌قول در پایگاه داده</p>
      </div>

      <div className="qa-actions">
        <button className="qa-btn-add" onClick={openAdd}>+ افزودن نقل‌قول</button>
        <button className="qa-btn-trigger" onClick={triggerNow} disabled={triggering}>
          {triggering ? '⏳' : '📤'} ارسال همین الان
        </button>
      </div>

      <p className="sec-title">لیست نقل‌قول‌ها</p>

      {loading ? (
        <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 10 }} />)}
        </div>
      ) : quotes.length === 0 ? (
        <p className="qa-empty">هنوز نقل‌قولی وجود ندارد</p>
      ) : (
        <div className="qa-list">
          {quotes.map(q => (
            <div key={q.id} className={`qa-item card ${!q.isActive ? 'qa-item-inactive' : ''}`}>
              <div className="qa-item-author">— {q.author}</div>
              <div className="qa-item-text">{q.text}</div>
              <div className="qa-item-meta">
                {q.category && <span className="qa-item-cat">{q.category}</span>}
                <span className="qa-item-used">استفاده: {q.usedCount}×</span>
                {!q.isActive && <span className="qa-badge-inactive">غیرفعال</span>}
              </div>
              <div className="qa-item-btns">
                <button className="qa-btn-sm qa-btn-edit" onClick={() => openEdit(q)}>ویرایش</button>
                <button className="qa-btn-sm qa-btn-toggle" onClick={() => toggleActive(q)}>
                  {q.isActive ? 'غیرفعال' : 'فعال'}
                </button>
                <button className="qa-btn-sm qa-btn-del" onClick={() => deleteQuote(q)}>حذف</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="qa-modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="qa-modal">
            <div className="qa-modal-title">
              {modal.mode === 'add' ? '+ افزودن نقل‌قول جدید' : '✏️ ویرایش نقل‌قول'}
            </div>
            <div className="qa-field">
              <label>متن نقل‌قول *</label>
              <textarea rows={4} value={form.text} onChange={e => setForm(p => ({ ...p, text: e.target.value }))} placeholder="متن را وارد کنید..." />
            </div>
            <div className="qa-field">
              <label>نام نویسنده *</label>
              <input value={form.author} onChange={e => setForm(p => ({ ...p, author: e.target.value }))} placeholder="مثلاً: صادق هدایت" />
            </div>
            <div className="qa-field">
              <label>دسته‌بندی</label>
              <input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="مثلاً: ایرانی / جهانی" />
            </div>
            <div className="qa-modal-actions">
              <button className="qa-btn-save" onClick={saveForm} disabled={saving}>
                {saving ? 'در حال ذخیره...' : 'ذخیره'}
              </button>
              <button className="qa-btn-cancel" onClick={() => setModal(null)}>لغو</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: 80 }} />
    </div>
  )
}
