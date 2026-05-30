const { Telegraf } = require('telegraf');
const { BOT_TOKEN } = require('../config');
const { saveUser } = require('./middleware/auth');
const { startHandler } = require('./handlers/start');
const {
  statsHandler,
  adminManageHandler,
  addAdminCommand,
  removeAdminCommand,
  miniAppHandler,
  comingSoonHandler,
} = require('./handlers/menu');
const {
  groupMenuHandler,
  groupMenuCallback,
  setGroupCommand,
  setWarnLimitCommand,
  setKeywordsCommand,
} = require('./handlers/groupMenu');
const { settingsHandler, settingsCallback, handleSettingsInput, isWaitingSettings } = require('./handlers/settings');
const { contentMenuHandler, contentCallback, handleContentInput, isWaitingContent } = require('./handlers/content');
const { warnCommand, unwarnCommand, warnsCommand, muteCommand, banCommand } = require('./handlers/moderation/warnSystem');
const { antiSpamMiddleware } = require('./handlers/moderation/antiSpam');
const { antiLinkMiddleware } = require('./handlers/moderation/antiLink');
const { keywordFilterMiddleware } = require('./handlers/moderation/keywordFilter');
const { joinRequestHandler, captchaCallbackHandler } = require('./handlers/moderation/joinHandler');
const { youtubeMenuHandler, handleYoutubeUrl, youtubeDownloadCallback, userState: ytUserState } = require('./handlers/youtube');
const { newsHandler } = require('./handlers/news');
const { quoteHandler } = require('./handlers/quote');
const { twitterMenuHandler, twitterCallback, handleTwitterUsername, userState: twitterUserState } = require('./handlers/twitter');
const { aiMenuHandler, aiPickCallback, handleAiMessage, isWaitingAI } = require('./handlers/ai');
const { premiumMenuHandler, premiumBuyCallback, preCheckoutHandler, successfulPaymentHandler } = require('./handlers/premium');
const { broadcastMenuHandler, handleBroadcastMessage, isWaitingBroadcast } = require('./handlers/broadcast');
const { referralHandler } = require('./handlers/referral');
const { generateTweetImage, THEME_KEYS } = require('./handlers/graphics');
const { isOwner, isAdmin } = require('./middleware/auth');
const { handleMediaLink, downloadCallback, pendingDownloads, genId } = require('./handlers/downloader');
const { handleVideoMessage, conversionCallback } = require('./handlers/converter');

function createBot() {
  const bot = new Telegraf(BOT_TOKEN);

  bot.use(saveUser);

  // Moderation middleware (group messages only)
  bot.use(antiSpamMiddleware);
  bot.use(antiLinkMiddleware);
  bot.use(keywordFilterMiddleware);

  // Conversation state middleware — checked before any other handler
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    const text = ctx.message?.text;
    if (!userId) return next();

    // Photo messages for content handler
    if (ctx.message?.photo && isWaitingContent(userId)) return handleContentInput(ctx);

    if (!text) return next();

    if (ytUserState.get(userId) === 'waiting_url') return handleYoutubeUrl(ctx);
    if (isWaitingAI(userId)) return handleAiMessage(ctx);
    if (twitterUserState.get(userId) === 'waiting_twitter') return handleTwitterUsername(ctx);
    if (isWaitingBroadcast(userId)) return handleBroadcastMessage(ctx);
    if (isWaitingSettings(userId)) {
      const handled = await handleSettingsInput(ctx);
      if (handled) return;
    }
    if (isWaitingContent(userId)) {
      const handled = await handleContentInput(ctx);
      if (handled) return;
    }

    return next();
  });

  // /start + /menu + /help
  bot.start(startHandler);
  bot.command('menu', startHandler);
  bot.command('help', async (ctx) => {
    return ctx.reply(
      `📖 *راهنمای دستورات VeriaApp*\n\n` +
      `🎬 *محتوا:*\n` +
      `/quote — نقل‌قول روز\n` +
      `/youtube — دانلود یوتیوب\n` +
      `/ai — دستیار هوشمند\n` +
      `/twitter — فید توییتر\n` +
      `/news — آخرین اخبار\n\n` +
      `👤 *حساب کاربری:*\n` +
      `/premium — خرید پریمیوم\n` +
      `/invite — لینک دعوت شما\n` +
      `/miniapp — باز کردن Mini App\n\n` +
      `⚙️ *مدیریت (ادمین):*\n` +
      `/settings — تنظیمات بات\n` +
      `/addadmin [id] — افزودن ادمین\n` +
      `/removeadmin [id] — حذف ادمین`,
      { parse_mode: 'Markdown' }
    );
  });

  // Shortcut commands
  bot.command('quote', quoteHandler);
  bot.command('youtube', youtubeMenuHandler);
  bot.command('ai', aiMenuHandler);
  bot.command('news', newsHandler);
  bot.command('premium', premiumMenuHandler);
  bot.command('invite', referralHandler);
  bot.command('miniapp', miniAppHandler);
  bot.command('settings', async (ctx) => {
    if (!(await isAdmin(ctx))) return;
    return settingsHandler(ctx);
  });
  bot.command('broadcast', async (ctx) => {
    if (!(await isOwner(ctx))) return;
    return broadcastMenuHandler(ctx);
  });

  // Main keyboard menu
  bot.hears('📊 آمار و تحلیل', statsHandler);
  bot.hears('👥 مدیریت ادمین‌ها', adminManageHandler);
  bot.hears('⚙️ تنظیمات', settingsHandler);
  bot.hears('🛡️ مدیریت گروه', groupMenuHandler);
  bot.hears('🎬 مدیریت محتوا', contentMenuHandler);
  bot.hears('📱 Mini App', miniAppHandler);
  bot.hears('📺 دانلود یوتیوب', youtubeMenuHandler);
  bot.hears('📰 آخرین اخبار', newsHandler);
  bot.hears('💬 نقل‌قول روز', quoteHandler);
  bot.hears('🤖 دستیار هوشمند', aiMenuHandler);
  bot.hears('⭐ پریمیوم', premiumMenuHandler);
  bot.hears('🔗 دعوت دوستان', referralHandler);
  bot.hears('📢 Broadcast', async (ctx) => {
    if (!(await isOwner(ctx))) return ctx.reply('⛔️ فقط مالک بات.');
    return broadcastMenuHandler(ctx);
  });
  bot.hears('ℹ️ درباره ما', async (ctx) => {
    return ctx.reply(
      `ℹ️ *درباره VeriaApp*\n\n` +
      `VeriaApp یک اکوسیستم هوشمند رسانه‌ای است برای:\n` +
      `• دانلود یوتیوب، تیک‌تاک، X و...\n` +
      `• نقل‌قول روزانه اندیشمندان آزاد\n` +
      `• دستیار هوشمند با AI\n` +
      `• آخرین اخبار ایران\n\n` +
      `📱 Mini App: /miniapp`,
      { parse_mode: 'Markdown' }
    );
  });

  // Auto-detect media links (TikTok, SoundCloud, Vimeo, Dailymotion, Pinterest, Twitter/X)
  const MEDIA_URL_RE = /https?:\/\/(www\.)?(tiktok\.com|vm\.tiktok\.com|soundcloud\.com|vimeo\.com|dailymotion\.com|dai\.ly|pinterest\.com|pin\.it|twitter\.com|x\.com)[^\s]*/i;
  bot.hears(MEDIA_URL_RE, handleMediaLink);

  // Custom slash commands from DB
  bot.use(async (ctx, next) => {
    const text = ctx.message?.text;
    if (!text || !text.startsWith('/')) return next();
    const cmd = text.split(' ')[0].slice(1).split('@')[0].toLowerCase();
    try {
      const BotCommand = require('../database/models/BotCommand');
      const custom = await BotCommand.findOne({ where: { command: cmd, isActive: true } });
      if (custom?.response) return ctx.reply(custom.response, { parse_mode: 'Markdown' });
    } catch (_) {}
    return next();
  });

  // Admin & moderation commands
  bot.command('addadmin', addAdminCommand);
  bot.command('removeadmin', removeAdminCommand);
  bot.command('warn', warnCommand);
  bot.command('unwarn', unwarnCommand);
  bot.command('warns', warnsCommand);
  bot.command('mute', muteCommand);
  bot.command('ban', banCommand);
  bot.command('setgroup', setGroupCommand);
  bot.command('setwarnlimit', setWarnLimitCommand);
  bot.command('setkeywords', setKeywordsCommand);

  // Inline keyboard callbacks
  bot.action(/^dl:/, downloadCallback);
  bot.action(/^yt:/, youtubeDownloadCallback);
  bot.action(/^ai:pick:/, aiPickCallback);
  bot.action(/^cfg:/, settingsCallback);
  bot.action(/^cnt:/, contentCallback);
  bot.action('premium:buy', premiumBuyCallback);
  bot.action(/^grp:/, groupMenuCallback);
  bot.action(/^captcha:/, captchaCallbackHandler);
  bot.action(/^conv:/, conversionCallback);

  // Video file → offer MP3 conversion
  bot.on('message', async (ctx, next) => {
    if (ctx.message?.video || (ctx.message?.document?.mime_type?.startsWith('video/'))) {
      await handleVideoMessage(ctx);
    }
    return next();
  });

  // Payment
  bot.on('pre_checkout_query', preCheckoutHandler);
  bot.on('message', (ctx, next) => {
    if (ctx.message?.successful_payment) return successfulPaymentHandler(ctx);
    return next();
  });

  // Join request
  bot.on('chat_join_request', joinRequestHandler);

  bot.catch((err, ctx) => {
    const user = ctx.from?.id || 'unknown';
    const text = ctx.message?.text || ctx.callbackQuery?.data || '';
    console.error(`[BotError] type=${ctx.updateType} user=${user} text="${text.slice(0, 60)}" err=${err.message}`);
    ctx.reply('⚠️ خطایی رخ داد. لطفاً دوباره امتحان کنید.').catch(() => {});
  });

  return bot;
}

module.exports = { createBot };
