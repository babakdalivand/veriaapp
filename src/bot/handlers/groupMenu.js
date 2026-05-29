const { Markup } = require('telegraf');
const Settings = require('../../database/models/Settings');
const { isAdmin, isOwner } = require('../middleware/auth');

async function groupMenuHandler(ctx) {
  if (!await isOwner(ctx) && !(await isAdmin(ctx))) return;

  const settings = await Settings.getSettings();
  await ctx.reply(
    '🛡️ <b>مدیریت گروه</b>\n\nتنظیمات فعلی:',
    {
      parse_mode: 'HTML',
      ...buildGroupMenu(settings),
    }
  );
}

function buildGroupMenu(settings) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        `${settings.captchaEnabled ? '✅' : '❌'} کپچا ورود`,
        'grp:toggle:captcha'
      ),
      Markup.button.callback(
        `${settings.antiSpamEnabled ? '✅' : '❌'} ضد اسپم`,
        'grp:toggle:antispam'
      ),
    ],
    [
      Markup.button.callback(
        `${settings.antiLinkEnabled ? '✅' : '❌'} ضد لینک`,
        'grp:toggle:antilink'
      ),
      Markup.button.callback(
        `⚠️ حد اخطار: ${settings.warnLimit}`,
        'grp:warnlimit'
      ),
    ],
    [Markup.button.callback('🔤 کلمات ممنوع', 'grp:keywords')],
    [Markup.button.callback('🔗 تنظیم گروه/کانال', 'grp:setgroup')],
  ]);
}

async function groupMenuCallback(ctx) {
  if (!await isOwner(ctx) && !(await isAdmin(ctx))) return ctx.answerCbQuery('دسترسی ندارید.');

  const data = ctx.callbackQuery.data;
  const settings = await Settings.getSettings();

  if (data === 'grp:toggle:captcha') {
    settings.captchaEnabled = !settings.captchaEnabled;
    await settings.save();
    await ctx.answerCbQuery(`کپچا ${settings.captchaEnabled ? 'فعال' : 'غیرفعال'} شد`);
  } else if (data === 'grp:toggle:antispam') {
    settings.antiSpamEnabled = !settings.antiSpamEnabled;
    await settings.save();
    await ctx.answerCbQuery(`ضد اسپم ${settings.antiSpamEnabled ? 'فعال' : 'غیرفعال'} شد`);
  } else if (data === 'grp:toggle:antilink') {
    settings.antiLinkEnabled = !settings.antiLinkEnabled;
    await settings.save();
    await ctx.answerCbQuery(`ضد لینک ${settings.antiLinkEnabled ? 'فعال' : 'غیرفعال'} شد`);
  } else if (data === 'grp:warnlimit') {
    return ctx.answerCbQuery(`حد اخطار: ${settings.warnLimit}\nبرای تغییر: /setwarnlimit <عدد>`);
  } else if (data === 'grp:keywords') {
    const list = settings.keywords || 'هنوز تنظیم نشده';
    return ctx.answerCbQuery(`کلمات ممنوع:\n${list}`);
  } else if (data === 'grp:setgroup') {
    return ctx.answerCbQuery('برای تنظیم گروه، دستور /setgroup را در گروه اجرا کن.');
  }

  await ctx.editMessageReplyMarkup(buildGroupMenu(settings).reply_markup).catch(() => {});
}

async function setGroupCommand(ctx) {
  if (!ctx.chat || ctx.chat.type === 'private') return;
  if (!await isOwner(ctx) && !(await isAdmin(ctx))) return;

  const settings = await Settings.getSettings();
  settings.mainGroupId = ctx.chat.id;
  await settings.save();

  ctx.reply(`✅ این گروه به عنوان گروه اصلی ثبت شد.\nID: <code>${ctx.chat.id}</code>`, { parse_mode: 'HTML' });
}

async function setWarnLimitCommand(ctx) {
  if (!await isOwner(ctx)) return;
  const parts = ctx.message.text.split(' ');
  const limit = parseInt(parts[1]);
  if (!limit || limit < 1 || limit > 10) return ctx.reply('مقدار باید بین ۱ تا ۱۰ باشد.');

  const settings = await Settings.getSettings();
  settings.warnLimit = limit;
  await settings.save();
  ctx.reply(`✅ حد اخطار به ${limit} تغییر کرد.`);
}

async function setKeywordsCommand(ctx) {
  if (!await isOwner(ctx)) return;
  const keywords = ctx.message.text.split(' ').slice(1).join(' ');
  if (!keywords) return ctx.reply('استفاده: /setkeywords کلمه۱,کلمه۲,کلمه۳');

  const settings = await Settings.getSettings();
  settings.keywords = keywords;
  await settings.save();
  ctx.reply(`✅ کلمات ممنوع ثبت شد:\n${keywords}`);
}

module.exports = {
  groupMenuHandler,
  groupMenuCallback,
  setGroupCommand,
  setWarnLimitCommand,
  setKeywordsCommand,
};
