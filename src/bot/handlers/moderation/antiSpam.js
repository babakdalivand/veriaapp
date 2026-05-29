const Settings = require('../../../database/models/Settings');
const { warnUser } = require('./warnSystem');

// In-memory sliding window: { "userId:groupId": [timestamps] }
const messageHistory = new Map();

const SPAM_WINDOW_MS = 10000;
const SPAM_THRESHOLD = 5;

function cleanup() {
  const now = Date.now();
  for (const [key, timestamps] of messageHistory.entries()) {
    const recent = timestamps.filter(t => now - t < SPAM_WINDOW_MS * 6);
    if (recent.length === 0) messageHistory.delete(key);
    else messageHistory.set(key, recent);
  }
}
setInterval(cleanup, 60000);

async function antiSpamMiddleware(ctx, next) {
  console.log('[ANTISPAM] called');
  if (!ctx.chat || ctx.chat.type === 'private') return next();
  if (!ctx.message) return next();

  const settings = await Settings.getSettings().catch(() => null);
  if (!settings || !settings.antiSpamEnabled) return next();

  const userId = ctx.from?.id;
  const groupId = ctx.chat.id;
  if (!userId) return next();

  const key = `${userId}:${groupId}`;
  const now = Date.now();
  const history = messageHistory.get(key) || [];
  const recent = history.filter(t => now - t < SPAM_WINDOW_MS);
  recent.push(now);
  messageHistory.set(key, recent);

  if (recent.length >= SPAM_THRESHOLD) {
    await ctx.deleteMessage().catch(() => {});
    messageHistory.delete(key);

    const botId = ctx.botInfo?.id ?? 0;
    const result = await warnUser(ctx, userId, groupId, 'اسپم', botId).catch(() => null);
    if (result) {
      const name = ctx.from.first_name || 'کاربر';
      if (result.action === 'ban') {
        await ctx.reply(`🚫 <b>${name}</b> به دلیل اسپم از گروه اخراج شد.`, { parse_mode: 'HTML' }).catch(() => {});
      } else if (result.action === 'mute') {
        await ctx.reply(`🔇 <b>${name}</b> به دلیل اسپم بی‌صدا شد.`, { parse_mode: 'HTML' }).catch(() => {});
      } else {
        await ctx.reply(`⚠️ <b>${name}</b> به دلیل اسپم اخطار گرفت (${result.count}).`, { parse_mode: 'HTML' }).catch(() => {});
      }
    }
    return;
  }

  return next();
}

module.exports = { antiSpamMiddleware };
