const cron = require('node-cron');
const { generateQuoteImage, THEME_KEYS } = require('./graphics');
const Quote = require('../../database/models/Quote');
const Settings = require('../../database/models/Settings');
const schedulerState = require('../schedulerState');

async function postDailyQuote(bot) {
  try {
    const settings = await Settings.getSettings();
    const channelId = settings.mainChannelId || process.env.CHANNEL_ID;
    if (!channelId) return console.log('[Scheduler] No channel configured');

    const quote = await Quote.findOne({
      where: { isActive: true },
      order: [['usedCount', 'ASC'], ['lastUsed', 'ASC'], ['id', 'ASC']],
    });
    if (!quote) return console.log('[Scheduler] No active quotes');

    const theme = THEME_KEYS[quote.usedCount % THEME_KEYS.length];
    const imgBuffer = await generateQuoteImage({ text: quote.text, author: quote.author }, theme);

    await bot.telegram.sendPhoto(String(channelId), { source: imgBuffer }, {
      caption: `💬 *نقل‌قول روز*\n\n_«${quote.text}»_\n\n— *${quote.author}*`,
      parse_mode: 'Markdown',
    });

    await quote.update({ usedCount: quote.usedCount + 1, lastUsed: new Date() });
    console.log(`[Scheduler] Quote posted: ${quote.author}`);
  } catch (e) {
    console.error('[Scheduler] postDailyQuote error:', e.message);
  }
}

function startScheduler(bot) {
  // 05:00 UTC = 08:30 Tehran (IRST UTC+3:30)
  cron.schedule('0 5 * * *', () => postDailyQuote(bot), { timezone: 'UTC' });
  schedulerState.triggerQuote = () => postDailyQuote(bot);
  console.log('[Scheduler] Quote scheduler started (05:00 UTC daily)');
}

module.exports = { startScheduler, postDailyQuote };
