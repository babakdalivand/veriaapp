const { Router } = require('express');
const crypto = require('crypto');
const { Op } = require('sequelize');
const User = require('../database/models/User');
const Admin = require('../database/models/Admin');
const Warn = require('../database/models/Warn');
const Parser = require('rss-parser');
const botState = require('../bot/botState');
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

module.exports = router;
