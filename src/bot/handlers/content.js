const { Markup } = require('telegraf');
const Settings = require('../../database/models/Settings');
const Quote = require('../../database/models/Quote');
const { isAdmin, isOwner } = require('../middleware/auth');
const schedulerState = require('../schedulerState');

const contentState = new Map(); // userId -> { action }

function isWaitingContent(userId) {
  return contentState.has(userId);
}

async function contentMenuHandler(ctx) {
  if (!(await isAdmin(ctx))) return ctx.reply('⛔️ دسترسی ندارید.');

  const settings = await Settings.getSettings();
  const quoteCount = await Quote.count({ where: { isActive: true } }).catch(() => 0);
  const channel = settings.mainChannelId || 'تنظیم نشده';

  return ctx.reply(
    `🎬 *مدیریت محتوا*\n\n📢 کانال: \`${channel}\`\n💬 نقل‌قول‌های فعال: ${quoteCount}`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📤 ارسال نقل‌قول همین الان', 'cnt:quote:now')],
        [Markup.button.callback('📝 پست متنی به کانال', 'cnt:post:text')],
        [Markup.button.callback('🖼 پست عکس + کپشن به کانال', 'cnt:post:photo')],
        [Markup.button.callback('📊 آمار نقل‌قول‌ها', 'cnt:quote:stats')],
      ])
    }
  );
}

async function contentCallback(ctx) {
  if (!(await isAdmin(ctx))) return ctx.answerCbQuery('⛔️ دسترسی ندارید.');
  await ctx.answerCbQuery();
  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id;

  if (data === 'cnt:quote:now') {
    if (!schedulerState.triggerQuote) return ctx.reply('⚠️ Scheduler آماده نیست.');
    await ctx.reply('⏳ در حال ارسال...');
    try {
      await schedulerState.triggerQuote();
      return ctx.reply('✅ نقل‌قول با موفقیت به کانال ارسال شد!');
    } catch (e) {
      return ctx.reply(`❌ خطا: ${e.message}`);
    }
  }

  if (data === 'cnt:post:text') {
    contentState.set(userId, { action: 'post_text' });
    return ctx.reply('📝 متن پست را بنویسید (از فرمت‌بندی Markdown پشتیبانی می‌شود):\n/cancel برای لغو');
  }

  if (data === 'cnt:post:photo') {
    contentState.set(userId, { action: 'post_photo_wait' });
    return ctx.reply('🖼 عکس را ارسال کنید:\n/cancel برای لغو');
  }

  if (data === 'cnt:quote:stats') {
    const [total, active, used] = await Promise.all([
      Quote.count(),
      Quote.count({ where: { isActive: true } }),
      Quote.count({ where: { usedCount: { [require('sequelize').Op.gt]: 0 } } }).catch(() => 0),
    ]);
    return ctx.reply(
      `📊 *آمار نقل‌قول‌ها*\n\nکل: ${total}\nفعال: ${active}\nاستفاده شده: ${used}`,
      { parse_mode: 'Markdown' }
    );
  }
}

async function handleContentInput(ctx) {
  const userId = ctx.from.id;
  const state = contentState.get(userId);
  if (!state) return false;

  const text = ctx.message?.text;

  if (text === '/cancel') {
    contentState.delete(userId);
    await ctx.reply('❌ لغو شد.');
    return true;
  }

  const settings = await Settings.getSettings();
  const channelId = settings.mainChannelId;
  if (!channelId) {
    contentState.delete(userId);
    await ctx.reply('⚠️ ابتدا کانال اصلی را تنظیم کنید (تنظیمات → تنظیم کانال)');
    return true;
  }

  if (state.action === 'post_text' && text) {
    try {
      await ctx.telegram.sendMessage(String(channelId), text, { parse_mode: 'Markdown' });
      contentState.delete(userId);
      await ctx.reply('✅ پست با موفقیت در کانال منتشر شد!');
    } catch (e) {
      contentState.delete(userId);
      await ctx.reply(`❌ خطا در ارسال: ${e.message}`);
    }
    return true;
  }

  if (state.action === 'post_photo_wait' && ctx.message?.photo) {
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    const caption = ctx.message.caption || '';
    contentState.set(userId, { action: 'post_photo_done', fileId, caption });
    try {
      await ctx.telegram.sendPhoto(String(channelId), fileId, {
        caption,
        parse_mode: 'Markdown',
      });
      contentState.delete(userId);
      await ctx.reply('✅ عکس با موفقیت در کانال منتشر شد!');
    } catch (e) {
      contentState.delete(userId);
      await ctx.reply(`❌ خطا در ارسال: ${e.message}`);
    }
    return true;
  }

  // If waiting for photo but got text
  if (state.action === 'post_photo_wait' && text) {
    await ctx.reply('⚠️ لطفاً یک عکس ارسال کنید (نه متن).\n/cancel برای لغو');
    return true;
  }

  return false;
}

module.exports = { contentMenuHandler, contentCallback, handleContentInput, isWaitingContent };
