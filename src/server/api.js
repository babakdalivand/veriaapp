const express = require('express');
const { Router } = express;
const crypto = require('crypto');
const { Op } = require('sequelize');
const User = require('../database/models/User');
const Admin = require('../database/models/Admin');
const Warn = require('../database/models/Warn');
const Quote = require('../database/models/Quote');
const BotCommand = require('../database/models/BotCommand');
const ScheduledPost = require('../database/models/ScheduledPost');
const Settings = require('../database/models/Settings');
const Parser = require('rss-parser');
const botState = require('../bot/botState');
const schedulerState = require('../bot/schedulerState');
const { BOT_TOKEN } = require('../config');
const { detectPlatform, PLATFORM_INFO, downloadToChannel, downloadToUser } = require('../bot/handlers/downloader');
const { extractVideoId, isYoutubeUrl, getYoutubeVideoInfo, downloadYoutubeToChannel } = require('../bot/handlers/youtube');
const { resolveChannel, checkAllChannels } = require('../bot/handlers/youtubeMonitor');
const YoutubeMonitor = require('../database/models/YoutubeMonitor');
const Promotion = require('../database/models/Promotion');
const ViolationLog = require('../database/models/ViolationLog');

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

// GET /api/twitter/profile?username=bbcpersian  (fxtwitter public API)
router.get('/twitter/profile', async (req, res) => {
  const { username } = req.query;
  if (!username || username.length > 50) return res.status(400).json({ error: 'invalid username' });
  try {
    const https = require('https');
    const data = await new Promise((resolve, reject) => {
      const req2 = https.get(`https://api.fxtwitter.com/${username}`, {
        headers: { 'User-Agent': 'VeriaApp/2.0' },
        timeout: 8000,
      }, (r) => {
        let body = '';
        r.on('data', c => body += c);
        r.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch { reject(new Error('invalid json')); }
        });
      });
      req2.on('error', reject);
      req2.on('timeout', () => { req2.destroy(); reject(new Error('timeout')); });
    });
    if (data.code !== 200) return res.status(404).json({ error: 'not found' });
    const u = data.user;
    res.json({
      username: u.screen_name,
      name: u.name,
      description: u.description,
      followers: u.followers,
      tweets: u.tweets,
      url: `https://x.com/${u.screen_name}`,
    });
  } catch (e) {
    res.status(502).json({ error: 'api_error', message: e.message });
  }
});

// GET /api/twitter/tweets?username=X  — try syndication API (no auth required)
router.get('/twitter/tweets', async (req, res) => {
  const { username } = req.query;
  if (!username || username.length > 50) return res.status(400).json({ error: 'invalid' });
  try {
    const https = require('https');
    const result = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'syndication.twitter.com',
        path: `/srv/timeline-profile/screen-name/${encodeURIComponent(username)}?lang=en`,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 10000,
      };
      const req2 = https.get(options, r => {
        let body = '';
        r.on('data', c => { body += c; });
        r.on('end', () => resolve({ status: r.statusCode, body }));
      });
      req2.on('error', reject);
      req2.on('timeout', () => { req2.destroy(); reject(new Error('timeout')); });
    });
    if (result.status !== 200) throw new Error(`HTTP ${result.status}`);
    const m = result.body.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]+?)<\/script>/);
    if (!m) throw new Error('no data');
    const json = JSON.parse(m[1]);
    const entries = json?.props?.pageProps?.timeline?.entries || [];
    const tweets = entries
      .filter(e => e.type === 'tweet')
      .slice(0, 10)
      .map(e => {
        const t = e.content?.tweet;
        if (!t) return null;
        const text = (t.full_text || t.text || '').replace(/https?:\/\/t\.co\/\S+/g, '').trim();
        return {
          id: t.id_str,
          text,
          date: t.created_at ? new Date(t.created_at).toLocaleDateString('fa-IR') : '',
          url: `https://x.com/${username}/status/${t.id_str}`,
          likes: t.favorite_count || 0,
          retweets: t.retweet_count || 0,
        };
      })
      .filter(Boolean);
    res.json({ tweets });
  } catch (e) {
    res.status(503).json({ error: 'unavailable' });
  }
});

// GET /api/tweets — backward compat
router.get('/tweets', async (req, res) => {
  const { username } = req.query;
  if (!username || username.length > 50) return res.status(400).json({ error: 'invalid username' });
  res.status(503).json({ error: 'nitter_down' });
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

async function checkOwnerRole(userId) {
  const user = await User.findOne({ where: { telegramId: userId } });
  return user && user.role === 'owner';
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

// ── Admin: scheduled posts ─────────────────────────────────────────────────

// GET /api/admin/scheduled
router.get('/admin/scheduled', requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  try {
    const posts = await ScheduledPost.findAll({
      where: { isPosted: false },
      order: [['scheduledAt', 'ASC']],
    });
    res.json(posts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/scheduled
router.post('/admin/scheduled', express.json(), requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  const { content, mediaType, channelId, scheduledAt } = req.body;
  if (!scheduledAt) return res.status(400).json({ error: 'scheduledAt required' });
  if (mediaType !== 'quote' && !content) return res.status(400).json({ error: 'content required' });
  try {
    const post = await ScheduledPost.create({
      content: content || null,
      mediaType: mediaType || 'text',
      channelId: channelId || null,
      scheduledAt: new Date(scheduledAt),
      createdBy: req.tgUserId,
    });
    res.json(post);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/admin/scheduled/:id
router.delete('/admin/scheduled/:id', express.json(), requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  try {
    const post = await ScheduledPost.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'not found' });
    await post.destroy();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
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

// ── Violations log ───────────────────────────────────────────────────────────

// GET /api/admin/violations?telegramId=&limit=50&offset=0
router.get('/admin/violations', requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  try {
    const { telegramId, limit = 50, offset = 0 } = req.query;
    const where = telegramId ? { telegramId } : {};
    const rows = await ViolationLog.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: Math.min(parseInt(limit) || 50, 200),
      offset: parseInt(offset) || 0,
    });
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/admin/violations/:id  — حذف یک رکورد لاگ
router.delete('/admin/violations/:id', requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  await ViolationLog.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// POST /api/admin/violations/unwarn/:telegramId  — حذف یک اخطار از Warn table
router.post('/admin/violations/unwarn/:telegramId', express.json(), requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  try {
    const last = await Warn.findOne({
      where: { telegramId: req.params.telegramId },
      order: [['createdAt', 'DESC']],
    });
    if (last) await last.destroy();
    const warnCount = await Warn.count({ where: { telegramId: req.params.telegramId } });
    res.json({ ok: true, warnCount });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/admin/violations/user/:telegramId  — پاک‌سازی کامل اخطارها
router.delete('/admin/violations/user/:telegramId', requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  try {
    await ViolationLog.destroy({ where: { telegramId: req.params.telegramId } });
    await Warn.destroy({ where: { telegramId: req.params.telegramId } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── YouTube Monitor API ───────────────────────────────────────────────────────

// GET /api/admin/youtube-monitor
router.get('/admin/youtube-monitor', requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  try {
    const monitors = await YoutubeMonitor.findAll({ order: [['createdAt', 'DESC']] });
    res.json(monitors.map(m => ({
      id: m.id,
      channelId: m.channelId,
      channelTitle: m.channelTitle,
      channelHandle: m.channelHandle,
      thumbnailUrl: m.thumbnailUrl,
      isActive: m.isActive,
      postedCount: JSON.parse(m.postedIds || '[]').length,
      createdAt: m.createdAt,
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/youtube-monitor  — add channel
// Body: { channelUrl }
router.post('/admin/youtube-monitor', express.json(), requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  const { channelUrl } = req.body;
  if (!channelUrl) return res.status(400).json({ error: 'channelUrl الزامی است.' });
  try {
    const info = await resolveChannel(channelUrl);
    const [monitor, created] = await YoutubeMonitor.findOrCreate({
      where: { channelId: info.channelId },
      defaults: {
        channelTitle:  info.channelTitle,
        channelHandle: info.channelHandle,
        thumbnailUrl:  info.thumbnailUrl,
        postedIds:     JSON.stringify(info.existingIds),
        isActive:      true,
      },
    });
    if (!created) {
      // Reactivate if it was disabled
      await monitor.update({ isActive: true, channelTitle: info.channelTitle, thumbnailUrl: info.thumbnailUrl });
    }
    res.json({
      ok: true,
      created,
      channelTitle: info.channelTitle,
      channelHandle: info.channelHandle,
      thumbnailUrl: info.thumbnailUrl,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/admin/youtube-monitor/:id  — toggle isActive
router.put('/admin/youtube-monitor/:id', express.json(), requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  try {
    const m = await YoutubeMonitor.findByPk(req.params.id);
    if (!m) return res.status(404).json({ error: 'not found' });
    const { isActive } = req.body;
    await m.update({ isActive: isActive !== undefined ? isActive : !m.isActive });
    res.json({ ok: true, isActive: m.isActive });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/admin/youtube-monitor/:id
router.delete('/admin/youtube-monitor/:id', requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  try {
    const m = await YoutubeMonitor.findByPk(req.params.id);
    if (!m) return res.status(404).json({ error: 'not found' });
    await m.destroy();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin/youtube-monitor/check-now  — manual trigger
router.post('/admin/youtube-monitor/check-now', requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  const bot = botState.bot;
  if (!bot) return res.status(503).json({ error: 'Bot not ready' });
  checkAllChannels(bot).catch(e => console.error('[YTMonitor] manual check error:', e.message));
  res.json({ ok: true, message: 'بررسی شروع شد — نتیجه در چند ثانیه ارسال خواهد شد.' });
});

// POST /api/admin/youtube-monitor/:id/test  — force-send latest video
router.post('/admin/youtube-monitor/:id/test', express.json(), requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  const bot = botState.bot;
  if (!bot) return res.status(503).json({ error: 'Bot not ready' });

  const monitor = await YoutubeMonitor.findByPk(req.params.id).catch(() => null);
  if (!monitor) return res.status(404).json({ error: 'کانال پیدا نشد' });

  const settings = await Settings.getSettings().catch(() => null);
  const tgChannel = settings?.mainChannelId;
  if (!tgChannel) return res.status(400).json({ error: 'کانال تلگرام تنظیم نشده' });

  try {
    const { fetchRssLatest } = require('../bot/handlers/youtubeMonitor');
    const item = await fetchRssLatest(monitor.channelId);
    if (!item) return res.status(404).json({ error: 'ویدیویی در RSS پیدا نشد' });

    const { postItemDirect } = require('../bot/handlers/youtubeMonitor');
    await postItemDirect(bot, tgChannel, item, monitor);
    res.json({ ok: true, message: `ویدیو «${item.data.title.slice(0, 40)}» ارسال شد` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Promotions & Announcements ───────────────────────────────────────────────

// GET /api/home-data  — public: announcement + active promotions
router.get('/home-data', requireAdmin, async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const announcement = settings.announcementActive ? {
      title: settings.announcementTitle,
      text:  settings.announcementText,
    } : null;
    const rules = settings.rulesText || null;
    const promotions = await Promotion.findAll({
      where: { isActive: true },
      order: [['sortOrder', 'ASC'], ['createdAt', 'DESC']],
      attributes: ['id', 'title', 'imageUrl', 'linkUrl'],
    });
    // Increment view counts
    if (promotions.length) {
      await Promotion.increment('viewCount', { where: { id: promotions.map(p => p.id) } });
    }
    res.json({ announcement, promotions, rules });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/promotions/:id/click  — track click
router.post('/promotions/:id/click', async (req, res) => {
  await Promotion.increment('clickCount', { where: { id: req.params.id } }).catch(() => {});
  res.json({ ok: true });
});

// ── Admin: Promotions CRUD ────────────────────────────────────────────────────

router.get('/admin/promotions', requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  const rows = await Promotion.findAll({ order: [['sortOrder', 'ASC'], ['createdAt', 'DESC']] });
  res.json(rows);
});

router.post('/admin/promotions', express.json(), requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  const { title, description, imageUrl, linkUrl, sortOrder } = req.body;
  if (!title || !linkUrl) return res.status(400).json({ error: 'عنوان و لینک الزامی است' });
  const p = await Promotion.create({ title, description, imageUrl, linkUrl, sortOrder: sortOrder || 0 });
  res.json(p);
});

router.put('/admin/promotions/:id', express.json(), requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  const p = await Promotion.findByPk(req.params.id);
  if (!p) return res.status(404).json({ error: 'پیدا نشد' });
  const { title, description, imageUrl, linkUrl, isActive, sortOrder } = req.body;
  await p.update({ title, description, imageUrl, linkUrl, isActive, sortOrder });
  res.json(p);
});

router.delete('/admin/promotions/:id', express.json(), requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  await Promotion.destroy({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// GET /api/payment-info  — public: get payment addresses for premium purchase
router.get('/payment-info', requireAdmin, async (req, res) => {
  const s = await Settings.getSettings().catch(() => null);
  res.json({
    paypalUrl:    s?.paypalUrl    || null,
    walletBTC:    s?.walletBTC    || null,
    walletUSDT:   s?.walletUSDT   || null,
    premiumPrice: s?.premiumPrice || 100,
  });
});

// PUT /admin/payment-settings  — save payment info (owner only)
router.put('/admin/payment-settings', express.json(), requireAdmin, async (req, res) => {
  if (!(await checkOwnerRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  const { paypalUrl, walletBTC, walletUSDT, premiumPrice } = req.body;
  const s = await Settings.getSettings();
  await s.update({ paypalUrl, walletBTC, walletUSDT, premiumPrice: parseInt(premiumPrice) || 100 });
  res.json({ ok: true });
});

// ── Admin: Announcement ───────────────────────────────────────────────────────

router.put('/admin/announcement', express.json(), requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  const { announcementActive, announcementTitle, announcementText } = req.body;
  const settings = await Settings.getSettings();
  await settings.update({ announcementActive, announcementTitle, announcementText });
  res.json({ ok: true });
});

// ── Download API ─────────────────────────────────────────────────────────────

// ── YouTube API ──────────────────────────────────────────────────────────────

// POST /api/youtube/info  — get video title/duration/formats (admin)
// Body: { url }
router.post('/youtube/info', express.json(), requireAdmin, async (req, res) => {
  const { url } = req.body;
  if (!url || !isYoutubeUrl(url)) return res.status(400).json({ error: 'لینک یوتیوب نامعتبر است.' });
  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: 'شناسه ویدیو پیدا نشد.' });
  try {
    const info = await getYoutubeVideoInfo(videoId);
    res.json({ ...info, videoId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/youtube/to-channel  — download and post to channel with CTA (admin only)
// Body: { videoId, height }
router.post('/youtube/to-channel', express.json(), requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  const { videoId, height } = req.body;
  if (!videoId) return res.status(400).json({ error: 'videoId الزامی است.' });

  const bot = botState.bot;
  if (!bot) return res.status(503).json({ error: 'Bot not ready' });

  const settings = await Settings.getSettings();
  const channelId = settings.mainChannelId;
  if (!channelId) return res.status(400).json({ error: 'کانالی تنظیم نشده.' });

  try {
    const result = await downloadYoutubeToChannel(bot, videoId, parseInt(height) || 0, channelId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/download/detect?url=...  — detect platform (public)
router.get('/download/detect', (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });
  const platform = detectPlatform(url);
  if (!platform) return res.json({ platform: null });
  const info = PLATFORM_INFO[platform] || { name: platform, emoji: '📥' };
  res.json({ platform, name: info.name, emoji: info.emoji });
});

// POST /api/download/to-me  — download and send to user's DM via bot
// Body: { url, mode: 'video'|'audio', initData }
router.post('/download/to-me', express.json(), requireAdmin, async (req, res) => {
  const { url, mode } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });

  const bot = botState.bot;
  if (!bot) return res.status(503).json({ error: 'Bot not ready' });

  const platform = detectPlatform(url);
  if (!platform) return res.status(400).json({ error: 'unsupported platform' });

  const audioOnly = mode === 'audio';
  try {
    const result = await downloadToUser(bot, url, req.tgUserId, audioOnly);
    res.json({ ok: true, filename: result.filename });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/download/to-channel  — download and post to channel (admin only)
// Body: { url, mode: 'video'|'audio', channelId?, initData }
router.post('/download/to-channel', express.json(), requireAdmin, async (req, res) => {
  if (!(await checkAdminRole(req.tgUserId))) return res.status(403).json({ error: 'forbidden' });
  const { url, mode, channelId: bodyChannel } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });

  const bot = botState.bot;
  if (!bot) return res.status(503).json({ error: 'Bot not ready' });

  const platform = detectPlatform(url);
  if (!platform) return res.status(400).json({ error: 'unsupported platform' });

  const settings = await Settings.getSettings();
  const channelId = bodyChannel || settings.mainChannelId;
  if (!channelId) return res.status(400).json({ error: 'No channel configured' });

  const audioOnly = mode === 'audio';
  try {
    const result = await downloadToChannel(bot, url, channelId, audioOnly);
    res.json({ ok: true, filename: result.filename });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/download/preview  — get download info without downloading (public-ish)
// Body: { url }
router.post('/download/preview', express.json(), requireAdmin, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });
  const platform = detectPlatform(url);
  if (!platform) return res.status(400).json({ error: 'unsupported platform' });
  const info = PLATFORM_INFO[platform] || { name: platform, emoji: '📥' };
  res.json({ status: 'ok', platform, platformName: info.name, emoji: info.emoji });
});

module.exports = router;
