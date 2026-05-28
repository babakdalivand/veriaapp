const { Markup } = require('telegraf');

const ownerKeyboard = Markup.keyboard([
  ['📊 آمار و تحلیل', '🛡️ مدیریت گروه'],
  ['🎬 مدیریت محتوا', '⚙️ تنظیمات'],
  ['👥 مدیریت ادمین‌ها', '📱 Mini App'],
]).resize();

const adminKeyboard = Markup.keyboard([
  ['📊 آمار و تحلیل', '🛡️ مدیریت گروه'],
  ['🎬 مدیریت محتوا', '⚙️ تنظیمات'],
]).resize();

const userKeyboard = Markup.keyboard([
  ['📺 دانلود یوتیوب', '📰 آخرین اخبار'],
  ['💬 نقل‌قول روز', 'ℹ️ درباره ما'],
]).resize();

module.exports = { ownerKeyboard, adminKeyboard, userKeyboard };
