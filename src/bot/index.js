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
const { generateTweetImage, THEME_KEYS } = require('./handlers/graphics');
const { isOwner, isAdmin } = require('./middleware/auth');

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

  // Admin/Owner: send a tweet URL → auto-generate tweet card image
  const TWEET_URL_RE = /https?:\/\/(twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/i;
  bot.hears(TWEET_URL_RE, async (ctx) => {
    if (!(await isAdmin(ctx))) return;
    const match = ctx.message.text.match(TWEET_URL_RE);
    if (!match) return;
    const username = match[2];
    const Parser = require('rss-parser');
    const rssParser = new Parser({ timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const NITTER = ['https://nitter.privacydev.net', 'https://nitter.poast.org', 'https://nitter.nl'];
    let tweet = null;
    for (const inst of NITTER) {
      try {
        const feed = await rssParser.parseURL(`${inst}/${username}/rss`);
        if (feed?.items?.length) {
          const item = feed.items[0];
          tweet = {
            text: (item.title || '').replace(/^RT @\S+:\s*/i, '').slice(0, 280),
            username,
            date: item.pubDate ? new Date(item.pubDate).toLocaleDateString('fa-IR') : '',
            link: ctx.message.text,
          };
          break;
        }
      } catch (_) {}
    }
    if (!tweet) return ctx.reply('❌ دریافت توییت ناموفق بود.');
    const themeIdx = Math.floor(Math.random() * THEME_KEYS.length);
    const imgBuffer = await generateTweetImage(tweet, THEME_KEYS[themeIdx]).catch(() => null);
    if (!imgBuffer) return ctx.reply('❌ ساخت تصویر ناموفق بود.');
    await ctx.replyWithPhoto({ source: imgBuffer }, {
      caption: `🐦 *@${username}*\n\n${tweet.text}\n\n[مشاهده توییت اصلی](${tweet.link})`,
      parse_mode: 'Markdown',
    });
  });

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
    const user = ctx.from?.id || 'unknown';
    const text = ctx.message?.text || ctx.callbackQuery?.data || '';
    console.error(`[BotError] type=${ctx.updateType} user=${user} text="${text.slice(0,60)}" err=${err.message}`);
    ctx.reply('⚠️ خطایی رخ داد. لطفاً دوباره امتحان کنید.').catch(() => {});
  });

  return bot;
}

module.exports = { createBot };
