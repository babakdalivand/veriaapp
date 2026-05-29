const Settings = require('../../../database/models/Settings');
const { isAdmin, isOwner } = require('../../middleware/auth');
const { warnUser } = require('./warnSystem');

const URL_REGEX = /(?:https?:\/\/|www\.|t\.me\/|@\w{5,})[^\s]*/gi;
const TG_INVITE_REGEX = /(?:t\.me\/(?:joinchat\/|\+)[^\s]+)/gi;

async function antiLinkMiddleware(ctx, next) {
  try {
    if (!ctx.chat || ctx.chat.type === 'private') return next();
    if (!ctx.message?.text && !ctx.message?.caption) return next();

    const settings = await Settings.getSettings().catch(() => null);
    if (!settings || !settings.antiLinkEnabled) return next();

    if (isOwner(ctx) || await isAdmin(ctx)) return next();

    const text = ctx.message.text || ctx.message.caption || '';
    const hasLink = URL_REGEX.test(text) || TG_INVITE_REGEX.test(text);
    URL_REGEX.lastIndex = 0;
    TG_INVITE_REGEX.lastIndex = 0;

    if (!hasLink) return next();

    console.log('[ANTILINK] deleting msg from', ctx.from.id);
    await ctx.deleteMessage().catch(e => console.log('[ANTILINK] delete error:', e.message));

    const userId = ctx.from.id;
    const groupId = ctx.chat.id;
    const botId = ctx.botInfo?.id ?? 0;
    const result = await warnUser(ctx, userId, groupId, 'ارسال لینک', botId).catch(e => {
      console.log('[ANTILINK] warnUser error:', e.message);
      return null;
    });

    console.log('[ANTILINK] warn result:', result?.action);

    if (result) {
      const name = ctx.from.first_name || 'کاربر';
      if (result.action === 'ban') {
        await ctx.reply(`🚫 <b>${name}</b> به دلیل ارسال لینک از گروه اخراج شد.`, { parse_mode: 'HTML' }).catch(() => {});
      } else if (result.action === 'mute') {
        await ctx.reply(`🔇 <b>${name}</b> به دلیل ارسال لینک بی‌صدا شد.`, { parse_mode: 'HTML' }).catch(() => {});
      } else {
        await ctx.reply(`⚠️ <b>${name}</b> لینک ارسال کرد و اخطار گرفت (${result.count}).`, { parse_mode: 'HTML' }).catch(() => {});
      }
    }
  } catch (e) {
    console.log('[ANTILINK] unexpected error:', e.message);
    return next();
  }
}

module.exports = { antiLinkMiddleware };
