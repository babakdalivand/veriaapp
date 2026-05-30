const { Markup } = require('telegraf');

const ownerKeyboard = Markup.keyboard([
  ['📊 آمار و تحلیل', '🛡️ مدیریت گروه'],
  ['🎬 مدیریت محتوا', '⚙️ تنظیمات'],
  ['👥 مدیریت ادمین‌ها', '📱 Mini App'],
  ['📺 دانلود یوتیوب', '🤖 دستیار هوشمند'],
  ['📰 آخرین اخبار', '💬 نقل‌قول روز'],
  ['⭐ پریمیوم', '🔗 دعوت دوستان'],
  ['📢 Broadcast'],
]).resize();

const adminKeyboard = Markup.keyboard([
  ['📊 آمار و تحلیل', '🛡️ مدیریت گروه'],
  ['🎬 مدیریت محتوا', '⚙️ تنظیمات'],
  ['📺 دانلود یوتیوب', '🤖 دستیار هوشمند'],
  ['📰 آخرین اخبار', '💬 نقل‌قول روز'],
  ['⭐ پریمیوم', '🔗 دعوت دوستان'],
]).resize();

const userKeyboard = Markup.keyboard([
  ['📺 دانلود یوتیوب', '🤖 دستیار هوشمند'],
  ['📰 آخرین اخبار', '💬 نقل‌قول روز'],
  ['⭐ پریمیوم', '🔗 دعوت دوستان'],
  ['📱 Mini App', 'ℹ️ درباره ما'],
]).resize();

module.exports = { ownerKeyboard, adminKeyboard, userKeyboard };
