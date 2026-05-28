const { OWNER_ID } = require('../../config');
const Admin = require('../../database/models/Admin');
const User = require('../../database/models/User');

async function saveUser(ctx, next) {
  const tg = ctx.from;
  if (!tg) return next();

  await User.findOneAndUpdate(
    { telegramId: tg.id },
    {
      telegramId: tg.id,
      username: tg.username,
      firstName: tg.first_name,
      lastName: tg.last_name,
      lastSeen: new Date(),
      ...(tg.id === OWNER_ID ? { role: 'owner' } : {}),
    },
    { upsert: true, new: true }
  );

  return next();
}

async function isOwner(ctx) {
  return ctx.from?.id === OWNER_ID;
}

async function isAdmin(ctx) {
  if (await isOwner(ctx)) return true;
  const admin = await Admin.findOne({ telegramId: ctx.from?.id });
  return !!admin;
}

async function requireOwner(ctx, next) {
  if (await isOwner(ctx)) return next();
  return ctx.reply('⛔️ این دستور فقط برای مالک بات است.');
}

async function requireAdmin(ctx, next) {
  if (await isAdmin(ctx)) return next();
  return ctx.reply('⛔️ دسترسی محدود است.');
}

module.exports = { saveUser, isOwner, isAdmin, requireOwner, requireAdmin };
