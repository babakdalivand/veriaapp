const Settings = require('../../../database/models/Settings');
const { isAdmin, isOwner } = require('../../middleware/auth');
const { warnUser } = require('./warnSystem');

async function keywordFilterMiddleware(ctx, next) {
  if (!ctx.chat || ctx.chat.type === 'private') return next();
  if (!ctx.message?.text && !ctx.message?.caption) return next();

  // skip stale queued messages
  const messageAge = Date.now() - ctx.message.date * 1000;
  if (messageAge > 30000) return next();

  const settings = await Settings.getSettings().catch(() => null);
  if (!settings || !settings.keywords) return next();

  if (await isOwner(ctx) || await isAdmin(ctx)) return next();

  const keywordList = settings.keywords
    .split(',')
    .map(k => k.trim().toLowerCase())
    .filter(Boolean);

  if (keywordList.length === 0) return next();

  const text = (ctx.message.text || ctx.message.caption || '').toLowerCase();
  const matched = keywordList.find(k => text.includes(k));

  if (!matched) return next();

  await ctx.deleteMessage().catch(() => {});

  const userId = ctx.from.id;
  const groupId = ctx.chat.id;
  const botId = ctx.botInfo?.id ?? 0;
  const result = await warnUser(ctx, userId, groupId, `کلمه ممنوع: ${matched}`, botId, {
    messageText: ctx.message?.text || ctx.message?.caption || null,
    firstName: ctx.from?.first_name || null,
    username: ctx.from?.username || null,
  }).catch(() => null);

  if (result) {
    const name = ctx.from.first_name || 'کاربر';
    if (result.action === 'ban') {
      await ctx.reply(`🚫 <b>${name}</b> به دلیل استفاده از کلمه ممنوع اخراج شد.`, { parse_mode: 'HTML' }).catch(() => {});
    } else if (result.action === 'mute') {
      await ctx.reply(`🔇 <b>${name}</b> به دلیل کلمه ممنوع بی‌صدا شد.`, { parse_mode: 'HTML' }).catch(() => {});
    } else {
      await ctx.reply(`⚠️ <b>${name}</b> پیام حاوی کلمه ممنوع را حذف کردیم. اخطار: ${result.count}`, { parse_mode: 'HTML' }).catch(() => {});
    }
  }
}

module.exports = { keywordFilterMiddleware };
