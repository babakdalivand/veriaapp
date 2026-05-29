const { OWNER_ID } = require('../../config');
const { ownerKeyboard, adminKeyboard, userKeyboard } = require('../keyboards/mainMenu');
const Admin = require('../../database/models/Admin');

async function startHandler(ctx) {
  const userId = ctx.from.id;
  const name = ctx.from.first_name || 'کاربر';

  if (userId === OWNER_ID) {
    return ctx.reply(
      `🎙️ *خوش آمدید، مالک عزیز!*\n\nپنل مدیریت veriaapp در اختیار شماست.`,
      { parse_mode: 'Markdown', ...ownerKeyboard }
    );
  }

  const admin = await Admin.findOne({ telegramId: userId });
  if (admin) {
    return ctx.reply(
      `🎙️ *خوش آمدی ${name}!*\n\nبه پنل ادمین veriaapp خوش آمدی.`,
      { parse_mode: 'Markdown', ...adminKeyboard }
    );
  }

  return ctx.reply(
    `🎙️ *سلام ${name}!*\n\nبه veriaapp خوش آمدی.`,
    { parse_mode: 'Markdown', ...userKeyboard }
  );
}

module.exports = { startHandler };
