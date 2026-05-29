const User = require('../../database/models/User');

const broadcastSessions = new Map();

async function broadcastMenuHandler(ctx) {
  broadcastSessions.set(ctx.from.id, { state: 'waiting_message' });
  await ctx.reply(
    '📢 *ارسال پیام همگانی*\n\nپیام مورد نظر را بفرست.\nمی‌تونی متن، عکس، ویدیو یا هر چیزی بفرستی.\n\n_(❌ انصراف برای لغو)_',
    { parse_mode: 'Markdown' }
  );
}

async function handleBroadcastMessage(ctx) {
  const userId = ctx.from.id;
  const text = ctx.message?.text?.trim();

  if (text === '❌ انصراف') {
    broadcastSessions.delete(userId);
    const { ownerKeyboard } = require('../keyboards/mainMenu');
    return ctx.reply('لغو شد.', ownerKeyboard);
  }

  broadcastSessions.delete(userId);

  const users = await User.findAll({ attributes: ['telegramId'], where: { isBlocked: false } });
  const statusMsg = await ctx.reply(`⏳ در حال ارسال به ${users.length} کاربر...`);

  let sent = 0, failed = 0;

  for (const user of users) {
    try {
      await ctx.telegram.copyMessage(Number(user.telegramId), ctx.chat.id, ctx.message.message_id);
      sent++;
    } catch {
      failed++;
    }
    // Rate limit: ~15 messages/sec
    if ((sent + failed) % 15 === 0) await new Promise(r => setTimeout(r, 1000));
  }

  await ctx.telegram.editMessageText(
    ctx.chat.id, statusMsg.message_id, null,
    `✅ ارسال تمام شد\n\n📤 موفق: ${sent}\n❌ ناموفق: ${failed}`
  );
}

function isWaitingBroadcast(userId) {
  return broadcastSessions.get(userId)?.state === 'waiting_message';
}

module.exports = { broadcastMenuHandler, handleBroadcastMessage, isWaitingBroadcast };
