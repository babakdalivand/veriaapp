const User = require('../../database/models/User');
const botState = require('../botState');

async function referralHandler(ctx) {
  const userId = ctx.from.id;

  if (!botState.username) {
    const info = await ctx.telegram.getMe();
    botState.username = info.username;
  }

  const inviteLink = `https://t.me/${botState.username}?start=ref_${userId}`;
  const referralCount = await User.count({ where: { referredBy: String(userId) } });

  await ctx.reply(
    `🔗 *لینک دعوت شما:*\n\`${inviteLink}\`\n\n` +
    `👥 دوستان دعوت‌شده: *${referralCount}* نفر\n\n` +
    `_هر کسی که از لینک شما بات رو استارت کنه، به لیست دعوت‌شده‌های شما اضافه می‌شه._`,
    { parse_mode: 'Markdown' }
  );
}

module.exports = { referralHandler };
