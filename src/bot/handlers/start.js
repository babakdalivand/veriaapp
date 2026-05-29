const { OWNER_ID } = require('../../config');
const { ownerKeyboard, adminKeyboard, userKeyboard } = require('../keyboards/mainMenu');
const Admin = require('../../database/models/Admin');
const User = require('../../database/models/User');

async function startHandler(ctx) {
  const userId = ctx.from.id;
  const name = ctx.from.first_name || 'کاربر';

  // Track referral
  const startParam = ctx.startPayload;
  if (startParam && startParam.startsWith('ref_')) {
    const referrerId = startParam.replace('ref_', '');
    if (referrerId !== String(userId)) {
      await User.update(
        { referredBy: referrerId },
        { where: { telegramId: userId, referredBy: null } }
      ).catch(() => {});
    }
  }

  if (userId === OWNER_ID) {
    return ctx.reply(
      `🎙️ *خوش آمدید، مالک عزیز!*\n\nپنل مدیریت veriaapp در اختیار شماست.`,
      { parse_mode: 'Markdown', ...ownerKeyboard }
    );
  }

  const admin = await Admin.findOne({ where: { telegramId: userId } });
  if (admin) {
    return ctx.reply(
      `🎙️ *خوش آمدی ${name}!*\n\nبه پنل ادمین veriaapp خوش آمدی.`,
      { parse_mode: 'Markdown', ...adminKeyboard }
    );
  }

  return ctx.reply(
    `🎙️ *سلام ${name}!*\n\nبه veriaapp خوش آمدی.\n\nاز منوی زیر یه بخش رو انتخاب کن:`,
    { parse_mode: 'Markdown', ...userKeyboard }
  );
}

module.exports = { startHandler };
