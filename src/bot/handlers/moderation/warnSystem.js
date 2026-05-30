const Warn = require('../../../database/models/Warn');
const Settings = require('../../../database/models/Settings');
const { isAdmin, isOwner } = require('../../middleware/auth');

async function warnUser(ctx, targetId, groupId, reason, warnedBy, opts = {}) {
  const { messageText = null, firstName = null, username = null } = opts;
  const settings = await Settings.getSettings();
  const limit = settings.warnLimit || 3;

  await Warn.create({ telegramId: targetId, groupId, reason, warnedBy });

  const count = await Warn.count({ where: { telegramId: targetId, groupId } });

  let action;
  if (count >= limit + 2) {
    await ctx.banChatMember(targetId).catch(() => {});
    await Warn.destroy({ where: { telegramId: targetId, groupId } });
    action = 'ban';
  } else if (count >= limit) {
    const until = Math.floor(Date.now() / 1000) + 60 * 60;
    await ctx.restrictChatMember(targetId, {
      permissions: { can_send_messages: false },
      until_date: until,
    }).catch(() => {});
    action = 'mute';
  } else {
    action = 'warn';
  }

  // Log to ViolationLog (non-blocking)
  try {
    const ViolationLog = require('../../../database/models/ViolationLog');
    const violationType =
      reason.includes('اسپم') ? 'spam' :
      reason.includes('کلمه') ? 'keyword' :
      reason.includes('لینک') ? 'link' : 'other';
    await ViolationLog.create({
      telegramId: targetId,
      firstName,
      username,
      groupId,
      violationType,
      messageText: messageText ? String(messageText).slice(0, 1000) : null,
      action,
      warnCount: count,
      reason,
    });
  } catch (_) {}

  if (action === 'ban')  return { action: 'ban', count };
  if (action === 'mute') return { action: 'mute', count };
  return { action: 'warn', count, remaining: limit - count };
}

async function warnCommand(ctx) {
  if (!ctx.chat || ctx.chat.type === 'private') return;
  if (!(await isAdmin(ctx)) && !await isOwner(ctx)) return;

  const reply = ctx.message.reply_to_message;
  if (!reply) return ctx.reply('⚠️ باید روی یک پیام ریپلای کنی.');

  const targetId = reply.from.id;
  const reason = ctx.message.text.split(' ').slice(1).join(' ') || 'تخلف';
  const result = await warnUser(ctx, targetId, ctx.chat.id, reason, ctx.from.id, {
    messageText: reply.text || reply.caption || null,
    firstName: reply.from.first_name || null,
    username: reply.from.username || null,
  });

  const name = reply.from.first_name || 'کاربر';

  if (result.action === 'ban') {
    return ctx.reply(`🚫 <b>${name}</b> به دلیل تخلف مکرر از گروه اخراج شد.`, { parse_mode: 'HTML' });
  } else if (result.action === 'mute') {
    return ctx.reply(`🔇 <b>${name}</b> ${result.count} اخطار دریافت کرده و ۱ ساعت بی‌صدا شد.`, { parse_mode: 'HTML' });
  } else {
    return ctx.reply(`⚠️ <b>${name}</b> اخطار ${result.count} دریافت کرد. دلیل: ${reason}\nاخطارهای باقی‌مانده تا مکالمه: ${result.remaining}`, { parse_mode: 'HTML' });
  }
}

async function unwarnCommand(ctx) {
  if (!ctx.chat || ctx.chat.type === 'private') return;
  if (!(await isAdmin(ctx)) && !await isOwner(ctx)) return;

  const reply = ctx.message.reply_to_message;
  if (!reply) return ctx.reply('⚠️ باید روی یک پیام ریپلای کنی.');

  const targetId = reply.from.id;
  const lastWarn = await Warn.findOne({
    where: { telegramId: targetId, groupId: ctx.chat.id },
    order: [['createdAt', 'DESC']],
  });

  if (!lastWarn) return ctx.reply('این کاربر اخطاری ندارد.');

  await lastWarn.destroy();
  const count = await Warn.count({ where: { telegramId: targetId, groupId: ctx.chat.id } });

  ctx.reply(`✅ یک اخطار از <b>${reply.from.first_name}</b> حذف شد. اخطارهای فعلی: ${count}`, { parse_mode: 'HTML' });
}

async function warnsCommand(ctx) {
  if (!ctx.chat || ctx.chat.type === 'private') return;

  const reply = ctx.message.reply_to_message;
  if (!reply) return ctx.reply('⚠️ باید روی یک پیام ریپلای کنی.');

  const targetId = reply.from.id;
  const count = await Warn.count({ where: { telegramId: targetId, groupId: ctx.chat.id } });
  const settings = await Settings.getSettings();

  ctx.reply(`📋 اخطارهای <b>${reply.from.first_name}</b>: ${count} از ${settings.warnLimit}`, { parse_mode: 'HTML' });
}

async function muteCommand(ctx) {
  if (!ctx.chat || ctx.chat.type === 'private') return;
  if (!(await isAdmin(ctx)) && !await isOwner(ctx)) return;

  const reply = ctx.message.reply_to_message;
  if (!reply) return ctx.reply('⚠️ باید روی یک پیام ریپلای کنی.');

  const parts = ctx.message.text.split(' ');
  const minutes = parseInt(parts[1]) || 60;
  const until = Math.floor(Date.now() / 1000) + minutes * 60;

  await ctx.restrictChatMember(reply.from.id, {
    permissions: { can_send_messages: false },
    until_date: until,
  }).catch(() => {});

  ctx.reply(`🔇 <b>${reply.from.first_name}</b> برای ${minutes} دقیقه بی‌صدا شد.`, { parse_mode: 'HTML' });
}

async function banCommand(ctx) {
  if (!ctx.chat || ctx.chat.type === 'private') return;
  if (!(await isAdmin(ctx)) && !await isOwner(ctx)) return;

  const reply = ctx.message.reply_to_message;
  if (!reply) return ctx.reply('⚠️ باید روی یک پیام ریپلای کنی.');

  await ctx.banChatMember(reply.from.id).catch(() => {});
  ctx.reply(`🚫 <b>${reply.from.first_name}</b> از گروه اخراج شد.`, { parse_mode: 'HTML' });
}

module.exports = { warnUser, warnCommand, unwarnCommand, warnsCommand, muteCommand, banCommand };
