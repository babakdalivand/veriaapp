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

function createBot() {
  const bot = new Telegraf(BOT_TOKEN);

  bot.use(saveUser);

  // TEMP DEBUG
  bot.use((ctx, next) => {
    if (ctx.chat && ctx.chat.type !== 'private') {
      console.log(`[DEBUG] update=${ctx.updateType} chat=${ctx.chat.id} from=${ctx.from?.id} text=${ctx.message?.text?.slice(0, 50)}`);
    }
    return next();
  });

  // Moderation middleware (group messages only)
  bot.use(antiSpamMiddleware);
  bot.use(antiLinkMiddleware);
  bot.use(keywordFilterMiddleware);

  // Start
  bot.start(startHandler);

  // Main menu
  bot.hears('📊 آمار و تحلیل', statsHandler);
  bot.hears('👥 مدیریت ادمین‌ها', adminManageHandler);
  bot.hears('⚙️ تنظیمات', settingsHandler);
  bot.hears('🛡️ مدیریت گروه', groupMenuHandler);
  bot.hears('🎬 مدیریت محتوا', comingSoonHandler);
  bot.hears('📱 Mini App', comingSoonHandler);
  bot.hears('📺 دانلود یوتیوب', comingSoonHandler);
  bot.hears('📰 آخرین اخبار', comingSoonHandler);
  bot.hears('💬 نقل‌قول روز', comingSoonHandler);
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
