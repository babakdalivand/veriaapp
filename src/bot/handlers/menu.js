const { isOwner } = require('../middleware/auth');
const Admin = require('../../database/models/Admin');
const User = require('../../database/models/User');
const { adminKeyboard } = require('../keyboards/mainMenu');

async function statsHandler(ctx) {
  const totalUsers = await User.count();
  const totalAdmins = await Admin.count();
  const blocked = await User.count({ where: { isBlocked: true } });

  return ctx.reply(
    `📊 *آمار و تحلیل*\n\n` +
    `👤 کل کاربران: ${totalUsers}\n` +
    `🔑 ادمین‌ها: ${totalAdmins}\n` +
    `🚫 بلاک‌شده‌ها: ${blocked}`,
    { parse_mode: 'Markdown' }
  );
}

async function adminManageHandler(ctx) {
  if (!(await isOwner(ctx))) {
    return ctx.reply('⛔️ این بخش فقط برای مالک بات است.');
  }

  const admins = await Admin.findAll();
  if (admins.length === 0) {
    return ctx.reply(
      `👥 *مدیریت ادمین‌ها*\n\nهیچ ادمینی ثبت نشده.\n\n` +
      `برای افزودن ادمین:\n/addadmin [user_id]`,
      { parse_mode: 'Markdown' }
    );
  }

  const list = admins.map((a, i) => `${i + 1}. ${a.firstName || 'ناشناس'} — \`${a.telegramId}\``).join('\n');
  return ctx.reply(
    `👥 *مدیریت ادمین‌ها*\n\n${list}\n\n` +
    `➕ /addadmin [user_id]\n❌ /removeadmin [user_id]`,
    { parse_mode: 'Markdown' }
  );
}

async function addAdminCommand(ctx) {
  if (!(await isOwner(ctx))) return;

  const args = ctx.message.text.split(' ');
  const targetId = parseInt(args[1]);
  if (!targetId) return ctx.reply('❌ استفاده: /addadmin [user_id]');

  const existing = await Admin.findOne({ where: { telegramId: targetId } });
  if (existing) return ctx.reply('⚠️ این کاربر قبلاً ادمین است.');

  const targetUser = await User.findOne({ where: { telegramId: targetId } });
  await Admin.create({
    telegramId: targetId,
    username: targetUser?.username || null,
    firstName: targetUser?.firstName || null,
    addedBy: ctx.from.id,
  });

  await User.update({ role: 'admin' }, { where: { telegramId: targetId } });

  try {
    await ctx.telegram.sendMessage(
      targetId,
      `🔑 *شما به عنوان ادمین veriaapp اضافه شدید!*`,
      { parse_mode: 'Markdown', ...adminKeyboard }
    );
  } catch (_) {}

  return ctx.reply(`✅ کاربر \`${targetId}\` به عنوان ادمین اضافه شد.`, { parse_mode: 'Markdown' });
}

async function removeAdminCommand(ctx) {
  if (!(await isOwner(ctx))) return;

  const args = ctx.message.text.split(' ');
  const targetId = parseInt(args[1]);
  if (!targetId) return ctx.reply('❌ استفاده: /removeadmin [user_id]');

  const deleted = await Admin.destroy({ where: { telegramId: targetId } });
  if (!deleted) return ctx.reply('⚠️ این کاربر ادمین نیست.');

  await User.update({ role: 'user' }, { where: { telegramId: targetId } });

  return ctx.reply(`✅ ادمین \`${targetId}\` حذف شد.`, { parse_mode: 'Markdown' });
}

async function settingsHandler(ctx) {
  return ctx.reply(
    `⚙️ *تنظیمات*\n\n_این بخش در فازهای بعدی تکمیل می‌شود._`,
    { parse_mode: 'Markdown' }
  );
}

async function comingSoonHandler(ctx) {
  return ctx.reply(`🔧 این بخش در حال توسعه است...`);
}

module.exports = {
  statsHandler,
  adminManageHandler,
  addAdminCommand,
  removeAdminCommand,
  settingsHandler,
  comingSoonHandler,
};
