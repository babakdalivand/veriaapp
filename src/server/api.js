const express = require('express');
const { Router } = express;
const crypto = require('crypto');
const { Op } = require('sequelize');
const User = require('../database/models/User');
const Admin = require('../database/models/Admin');
const Warn = require('../database/models/Warn');
const Quote = require('../database/models/Quote');
const BotCommand = require('../database/models/BotCommand');
const Settings = require('../database/models/Settings');
const Parser = require('rss-parser');
const botState = require('../bot/botState');
const schedulerState = require('../bot/schedulerState');
const { BOT_TOKEN } = require('../config');

const router = Router();

function verifyInitData(initData) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    return hash === expectedHash;
  } catch {
    return false;
  }
}

// GET /api/me?initData=...
router.get('/me', async (req, res) => {
  const { initData } = req.query;

  if (!initData) return res.status(400).json({ error: 'missing initData' });

  if (process.env.NODE_ENV === 'production' && !verifyInitData(initData)) {
    return res.status(403).json({ error: 'invalid initData' });
  }

  try {
    const params = new URLSearchParams(initData);
    const userParam = params.get('user');
    if (!userParam) return res.status(400).json({ error: 'no user in initData' });

    const tgUser = JSON.parse(userParam);
    const userId = tgUser.id;

    const user = await User.findOne({ where: { telegramId: userId } });
    const referralCount = await User.count({ where: { referredBy: String(userId) } }).catch(() => 0);
    const botUsername = botState.username || 'bot';

    res.json({
      id: userId,
      firstName: tgUser.first_name || '',
      username: tgUser.username || '',
      role: user?.role || 'user',
      premiumExpiry: user?.premiumExpiry || null,
      createdAt: user?.createdAt || null,
      referralCount,
      inviteLink: `https://t.me/${botUsername}?start=ref_${userId}`,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/stats  (public)
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalUsers, premiumUsers, newToday, newThisWeek, totalAdmins, totalWarns] = await Promise.all([
      User.count(),
      User.count({ where: { role: 'premium', premiumExpiry: { [Op.gt]: now } } }).catch(() => 0),
      User.count({ where: { createdAt: { [Op.gte]: todayStart } } }).catch(() => 0),
      User.count({ where: { createdAt: { [Op.gte]: weekStart } } }).catch(() => 0),
      Admin.count(),
      Warn.count().catch(() => 0),
    ]);

    res.json({ totalUsers, premiumUsers, newToday, newThisWeek, totalAdmins, totalWarns });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Legacy: GET /api/user?id=...
router.get('/user', async (req, res) => {
  const { id, initData } = req.query;
  if (!id) return res.status(400).json({ error: 'missing id' });

  if (process.env.NODE_ENV === 'production' && initData && !verifyInitData(initData)) {
    return res.status(403).json({ error: 'invalid initData' });
  }

  try {
    const user = await User.findOne({ where: { telegramId: id } });
    if (!user) return res.json({ role: 'user' });
    res.json({ role: user.role, username: user.username, firstName: user.firstName });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const DEFAULT_TWITTER_ACCOUNTS = ['IranIntl_Fa', 'bbcpersian', 'AlinejadMasih'];

// GET /api/twitter/accounts  (public — returns configured accounts list)
router.get('/twitter/accounts', async (req, res) => {
  try {
    const s = await Settings.getSettings();
    const accounts = s.twitterAccounts
      ? s.twitterAccounts.split(',').map(a => a.trim()).filter(Boolean)
      : DEFAULT_TWITTER_ACCOUNTS;
    res.json({ accounts });
  } catch { res.json({ accounts: DEFAULT_TWITTER_ACCOUNTS }); }
});

// GET /api/tweets?username=IranIntl_Fa  (public, Nitter RSS)
const rssParser = new Parser({ timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } });
const NITTER = ['https://nitter.privacydev.net', 'https://nitter.poast.org', 'https://nitter.nl'];

router.get('/tweets', async (req, res) => {
  const { username } = req.query;
  if (!username || username.length > 50) return res.status(400).json({ error: 'invalid username' });

  for (const instance of NITTER) {
    try {
      const feed = await rssParser.parseURL(`${instance}/${username}/rss`);
      if (feed?.items?.length) {
        const tweets = feed.items.slice(0, 5).map(item => ({
          title: (item.title || '').slice(0, 220),
          link: (item.link || '').replace(instance, 'https://twitter.com'),
          date: item.pubDate ? new Date(item.pubDate).toLocaleDateString('fa-IR') : '',
        }));
        return res.json({ tweets, username });
      }
    } catch (_) {}
  }
  res.status(502).json({ error: 'could not fetch tweets' });
});

// GET /api/quote  (public, today's quote)
const QUOTES = [
  { text: 'خدا اختراع انسان است برای توجیه ترس و جهل خود.', author: 'صادق هدایت' },
  { text: 'تا وقتی که خرافات حکم‌فرماست، آزادی وجود ندارد.', author: 'احمد کسروی' },
  { text: 'شک، آغاز تفکر است و تفکر، آغاز آزادی.', author: 'میرزا فتحعلی آخوندزاده' },
  { text: 'خدا مُرده است. ما او را کشتیم — من و تو.', author: 'فریدریش نیچه' },
  { text: 'آنچه ایمان می‌نامیم، باور کردن چیزی است که هیچ دلیلی برایش نداری.', author: 'ولتر' },
  { text: 'در تاریخ، مذهب هرگز نیروی اخلاقی نبوده است.', author: 'برتراند راسل' },
  { text: 'دین وعده پاداش پس از مرگ است برای پذیرش ستم در طول زندگی.', author: 'کارل مارکس' },
  { text: 'عقل ابزار یافتن حقیقت است، نه ایمان.', author: 'توماس پین' },
  { text: 'ایمان، رها کردن عقل در برابر اقتدار است.', author: 'سام هریس' },
  { text: 'دین همه چیز را توضیح می‌دهد و در واقع هیچ چیز را توضیح نمی‌دهد.', author: 'ریچارد داوکینز' },
  { text: 'خرد، تنها راهنمای انسان آزاد است.', author: 'اسپینوزا' },
  { text: 'ترس از مرگ اولین مذهب را ساخت.', author: 'لوکرتیوس' },
  { text: 'پیشرفت واقعی زمانی آغاز می‌شود که انسان به جای دعا، عمل کند.', author: 'میرزا فتحعلی آخوندزاده' },
  { text: 'هرجا علم وارد شد، دین عقب نشست.', author: 'ویکتور هوگو' },
];

router.get('/quote', (req, res) => {
  const day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  res.json(QUOTES[day % QUOTES.length]);
});

// ── Admin: quote management ──────────────────────────────────────────────────

function requireAdmin(req, res, next) {
  const { initData } = req.query || req.body || {};
  if (!initData) return res.status(400).json({ error: 'missing initData' });
  if (process.env.NODE_ENV === 'production' && !verifyInitData(initData)) {
    return res.status(403).json({ error: 'invalid initData' });
  }
  try {
    const params = new URLSearchParams(initData);
    const tgUser = JSON.parse(params.get('user') || '{}');
    req.tgUserId = tgUser.id;
    next();
  } catch {
    res.status(400).json({ error: 'bad initData' });
  }
}

async function checkAdminRole(userId) {
  const user = await User.findOne({ where: { telegramId: userId } });
  return user && (user.role === 'admin' || user.role === 'owner');
}

// GET /api/admin/quotes
router.get('/admin/quotes', requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  try {
    const quotes = await Quote.findAll({ order: [['id', 'ASC']] });
    res.json(quotes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/quotes
router.post('/admin/quotes', express.json(), requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  const { text, author, category } = req.body;
  if (!text || !author) return res.status(400).json({ error: 'text and author required' });
  try {
    const q = await Quote.create({ text: text.trim(), author: author.trim(), category: (category || '').trim() || null });
    res.json(q);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/admin/quotes/:id
router.put('/admin/quotes/:id', express.json(), requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  try {
    const q = await Quote.findByPk(req.params.id);
    if (!q) return res.status(404).json({ error: 'not found' });
    const { text, author, category, isActive } = req.body;
    await q.update({
      ...(text !== undefined && { text: text.trim() }),
      ...(author !== undefined && { author: author.trim() }),
      ...(category !== undefined && { category: category.trim() || null }),
      ...(isActive !== undefined && { isActive }),
    });
    res.json(q);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/admin/quotes/:id
router.delete('/admin/quotes/:id', requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  try {
    const q = await Quote.findByPk(req.params.id);
    if (!q) return res.status(404).json({ error: 'not found' });
    await q.destroy();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/trigger-quote  (manual post now)
router.post('/admin/trigger-quote', requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  if (!schedulerState.triggerQuote) return res.status(503).json({ error: 'scheduler not ready' });
  try {
    await schedulerState.triggerQuote();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: settings ──────────────────────────────────────────────────────────

// GET /api/admin/settings
router.get('/admin/settings', requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  try {
    const s = await Settings.getSettings();
    res.json({
      botEnabled: s.botEnabled,
      welcomeMessage: s.welcomeMessage,
      mainChannelId: s.mainChannelId,
      mainGroupId: s.mainGroupId,
      groupIds: s.groupIds || '',
      captchaEnabled: s.captchaEnabled,
      antiSpamEnabled: s.antiSpamEnabled,
      antiLinkEnabled: s.antiLinkEnabled,
      warnLimit: s.warnLimit,
      keywords: s.keywords || '',
      twitterAccounts: s.twitterAccounts || '',
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/settings
router.put('/admin/settings', express.json(), requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  try {
    const s = await Settings.getSettings();
    const allowed = ['botEnabled','welcomeMessage','mainChannelId','mainGroupId','groupIds',
                     'captchaEnabled','antiSpamEnabled','antiLinkEnabled','warnLimit','keywords','twitterAccounts'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) s[key] = req.body[key];
    }
    await s.save();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Admin: bot commands ───────────────────────────────────────────────────────

// GET /api/admin/commands
router.get('/admin/commands', requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  try {
    res.json(await BotCommand.findAll({ order: [['command', 'ASC']] }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/commands
router.post('/admin/commands', express.json(), requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  const { command, description, response } = req.body;
  if (!command || !description) return res.status(400).json({ error: 'command and description required' });
  const cmd = command.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!cmd) return res.status(400).json({ error: 'invalid command name' });
  try {
    const [record] = await BotCommand.findOrCreate({ where: { command: cmd }, defaults: { description, response: response || '' } });
    if (record._options?.isNewRecord === false) {
      await record.update({ description, response: response || '' });
    }
    res.json(record);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/commands/:id
router.put('/admin/commands/:id', express.json(), requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  try {
    const c = await BotCommand.findByPk(req.params.id);
    if (!c) return res.status(404).json({ error: 'not found' });
    const { description, response, isActive } = req.body;
    await c.update({
      ...(description !== undefined && { description }),
      ...(response !== undefined && { response }),
      ...(isActive !== undefined && { isActive }),
    });
    res.json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/admin/commands/:id
router.delete('/admin/commands/:id', requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  try {
    const c = await BotCommand.findByPk(req.params.id);
    if (!c) return res.status(404).json({ error: 'not found' });
    await c.destroy();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Admin: users management ───────────────────────────────────────────────────

// GET /api/admin/users?search=
router.get('/admin/users', requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  const { search, limit = 30, offset = 0 } = req.query;
  try {
    const where = search ? {
      [Op.or]: [
        { username: { [Op.like]: `%${search}%` } },
        { firstName: { [Op.like]: `%${search}%` } },
        { telegramId: search },
      ]
    } : {};
    const users = await User.findAll({
      where,
      limit: Math.min(parseInt(limit) || 30, 50),
      offset: parseInt(offset) || 0,
      order: [['createdAt', 'DESC']],
      attributes: ['telegramId','username','firstName','role','premiumExpiry','isBlocked','createdAt'],
    });
    res.json(users);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/admin/users/:telegramId
router.put('/admin/users/:telegramId', express.json(), requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  try {
    const u = await User.findOne({ where: { telegramId: req.params.telegramId } });
    if (!u) return res.status(404).json({ error: 'not found' });
    const { role, premiumExpiry, isBlocked } = req.body;
    await u.update({
      ...(role !== undefined && { role }),
      ...(premiumExpiry !== undefined && { premiumExpiry }),
      ...(isBlocked !== undefined && { isBlocked }),
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
