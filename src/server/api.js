const { Router } = require('express');
const crypto = require('crypto');
const User = require('../database/models/User');
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

// GET /api/user?id=123&initData=...
router.get('/user', async (req, res) => {
  const { id, initData } = req.query;
  if (!id) return res.status(400).json({ error: 'missing id' });

  // Verify Telegram initData in production
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
