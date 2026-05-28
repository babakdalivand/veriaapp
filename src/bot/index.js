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

function createBot() {
  const bot = new Telegraf(BOT_TOKEN);

  bot.use(saveUser);

  bot.start(startHandler);

  bot.hears('📊 آمار و تحلیل', statsHandler);
  bot.hears('👥 مدیریت ادمین‌ها', adminManageHandler);
  bot.hears('⚙️ تنظیمات', settingsHandler);
  bot.hears('🛡️ مدیریت گروه', comingSoonHandler);
  bot.hears('🎬 مدیریت محتوا', comingSoonHandler);
  bot.hears('📱 Mini App', comingSoonHandler);
  bot.hears('📺 دانلود یوتیوب', comingSoonHandler);
  bot.hears('📰 آخرین اخبار', comingSoonHandler);
  bot.hears('💬 نقل‌قول روز', comingSoonHandler);
  bot.hears('ℹ️ درباره ما', comingSoonHandler);

  bot.command('addadmin', addAdminCommand);
  bot.command('removeadmin', removeAdminCommand);

  bot.catch((err, ctx) => {
    console.error(`Bot error for ${ctx.updateType}:`, err.message);
  });

  return bot;
}

module.exports = { createBot };
