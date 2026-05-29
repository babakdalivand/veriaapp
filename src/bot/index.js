const { Telegraf } = require('telegraf');
const { BOT_TOKEN } = require('../config');
const { saveUser } = require('./middleware/auth');
const { startHandler } = require('./handlers/start');
const {
  statsHandler,
  adminManageHandler,
  addAdminCommand,
  removeAdminCommand,
  settingsHandler,
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
const { isOwner } = require('./middleware/auth');

function createBot() {
  const bot = new Telegraf(BOT_TOKEN);

  bot.use(saveUser);

  // Moderation middleware (group messages only)
  bot.use(antiSpamMiddleware);
  bot.use(antiLinkMiddleware);
  bot.use(keywordFilterMiddleware);

  // Conversation state middleware
  bot.use((ctx, next) => {
    const userId = ctx.from?.id;
    const text = ctx.message?.text;
    if (!text || !userId) return next();
    if (ytUserState.get(userId) === 'waiting_url') return handleYoutubeUrl(ctx);
    if (isWaitingAI(userId)) return handleAiMessage(ctx);
    if (twitterUserState.get(userId) === 'waiting_twitter') return handleTwitterUsername(ctx);
    if (isWaitingBroadcast(userId)) return handleBroadcastMessage(ctx);
    return next();
  });

  // Start
  bot.start(startHandler);

  // Main menu
  bot.hears('📊 آمار و تحلیل', statsHandler);
  bot.hears('👥 مدیریت ادمین‌ها', adminManageHandler);
  bot.hears('⚙️ تنظیمات', settingsHandler);
  bot.hears('🛡️ مدیریت گروه', groupMenuHandler);
  bot.hears('🎬 مدیریت محتوا', comingSoonHandler);
  bot.hears('📱 Mini App', miniAppHandler);
  bot.hears('📺 دانلود یوتیوب', youtubeMenuHandler);
  bot.hears('📰 آخرین اخبار', newsHandler);
  bot.hears('💬 نقل‌قول روز', quoteHandler);
  bot.hears('🤖 دستیار هوشمند', aiMenuHandler);
  bot.hears('🐦 توییتر', twitterMenuHandler);
  bot.hears('⭐ پریمیوم', premiumMenuHandler);
  bot.hears('🔗 دعوت دوستان', referralHandler);
  bot.hears('📢 Broadcast', async (ctx) => {
    if (!(await isOwner(ctx))) return ctx.reply('⛔️ فقط مالک بات.');
    return broadcastMenuHandler(ctx);
  });
  bot.hears('📱 Mini App', miniAppHandler);
  bot.hears('ℹ️ درباره ما', comingSoonHandler);

  // Admin commands
  bot.command('addadmin', addAdminCommand);
  bot.command('removeadmin', removeAdminCommand);

  // Moderation commands
  bot.command('warn', warnCommand);
  bot.command('unwarn', unwarnCommand);
  bot.command('warns', warnsCommand);
  bot.command('mute', muteCommand);
  bot.command('ban', banCommand);
  bot.command('setgroup', setGroupCommand);
  bot.command('setwarnlimit', setWarnLimitCommand);
  bot.command('setkeywords', setKeywordsCommand);

  // YouTube download callbacks
  bot.action(/^yt:/, youtubeDownloadCallback);

  // Twitter callbacks
  bot.action(/^tw:/, twitterCallback);

  // AI provider pick callbacks
  bot.action(/^ai:pick:/, aiPickCallback);

  // Premium callbacks
  bot.action('premium:buy', premiumBuyCallback);
  bot.on('pre_checkout_query', preCheckoutHandler);
  bot.on('message', (ctx, next) => {
    if (ctx.message?.successful_payment) return successfulPaymentHandler(ctx);
    return next();
  });

  // Group management panel callbacks
  bot.action(/^grp:/, groupMenuCallback);

  // Captcha join request
  bot.on('chat_join_request', joinRequestHandler);
  bot.action(/^captcha:/, captchaCallbackHandler);

  bot.catch((err, ctx) => {
    console.error(`Bot error for ${ctx.updateType}:`, err.message);
  });

  return bot;
}

module.exports = { createBot };
