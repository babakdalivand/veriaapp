const { Markup } = require('telegraf');

const ownerKeyboard = Markup.keyboard([
  ['📊 آمار و تحلیل', '🛡️ مدیریت گروه'],
  ['🎬 مدیریت محتوا', '⚙️ تنظیمات'],
  ['👥 مدیریت ادمین‌ها', '📱 Mini App'],
  ['📰 آخرین اخبار', '💬 نقل‌قول روز'],
  ['🤖 دستیار هوشمند', '⭐ پریمیوم'],
  ['🔗 دعوت دوستان', '📢 Broadcast'],
]).resize();

const adminKeyboard = Markup.keyboard([
  ['📊 آمار و تحلیل', '🛡️ مدیریت گروه'],
  ['🎬 مدیریت محتوا', '⚙️ تنظیمات'],
  ['📰 آخرین اخبار', '💬 نقل‌قول روز'],
  ['🤖 دستیار هوشمند', '⭐ پریمیوم'],
  ['🔗 دعوت دوستان'],
]).resize();

const userKeyboard = Markup.keyboard([
  ['📰 آخرین اخبار', '💬 نقل‌قول روز'],
  ['🤖 دستیار هوشمند', '⭐ پریمیوم'],
  ['🔗 دعوت دوستان', '📱 Mini App'],
  ['ℹ️ درباره ما'],
]).resize();

module.exports = { ownerKeyboard, adminKeyboard, userKeyboard };
