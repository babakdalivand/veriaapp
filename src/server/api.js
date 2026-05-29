const { Router } = require('express');
const crypto = require('crypto');
const { Op } = require('sequelize');
const User = require('../database/models/User');
const Admin = require('../database/models/Admin');
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

    const [totalUsers, premiumUsers, newToday, newThisWeek, totalAdmins] = await Promise.all([
      User.count(),
      User.count({ where: { role: 'premium', premiumExpiry: { [Op.gt]: now } } }).catch(() => 0),
      User.count({ where: { createdAt: { [Op.gte]: todayStart } } }).catch(() => 0),
      User.count({ where: { createdAt: { [Op.gte]: weekStart } } }).catch(() => 0),
      Admin.count(),
    ]);

    res.json({ totalUsers, premiumUsers, newToday, newThisWeek, totalAdmins });
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

module.exports = router;
