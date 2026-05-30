const cron = require('node-cron');
const { generateQuoteImage, THEME_KEYS } = require('./graphics');
const Quote = require('../../database/models/Quote');
const Settings = require('../../database/models/Settings');
const schedulerState = require('../schedulerState');
const { checkAllChannels } = require('./youtubeMonitor');
const { checkWebsite }    = require('./websiteMonitor');

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
  cron.schedule('* * * * *', () => checkScheduledPosts(bot));
  // Check YouTube monitored channels every 15 minutes
  cron.schedule('*/15 * * * *', () => checkAllChannels(bot).catch(e =>
    console.error('[YTMonitor] cron error:', e.message)
  ));
  // Check website (persianatheists.com) every 30 minutes
  cron.schedule('*/30 * * * *', () => checkWebsite(bot).catch(e =>
    console.error('[WebsiteMonitor] cron error:', e.message)
  ));
  console.log('[Scheduler] Quote scheduler started (05:00 UTC daily)');
}

async function checkScheduledPosts(bot) {
  try {
    const ScheduledPost = require('../../database/models/ScheduledPost');
    const Settings = require('../../database/models/Settings');
    const now = new Date();
    const pending = await ScheduledPost.findAll({
      where: { isPosted: false, scheduledAt: { [require('sequelize').Op.lte]: now } },
    });
    for (const post of pending) {
      try {
        const settings = await Settings.getSettings();
        const channelId = post.channelId || settings.mainChannelId;
        if (!channelId) { await post.update({ isPosted: true, postedAt: now }); continue; }

        if (post.mediaType === 'quote') {
          await postDailyQuote(bot);
        } else {
          await bot.telegram.sendMessage(String(channelId), post.content, { parse_mode: 'Markdown' });
        }
        await post.update({ isPosted: true, postedAt: now });
        console.log(`[Scheduler] Scheduled post ${post.id} sent`);
      } catch (e) {
        console.error(`[Scheduler] Scheduled post ${post.id} error:`, e.message);
      }
    }
  } catch (e) {
    console.error('[Scheduler] checkScheduledPosts error:', e.message);
  }
}

module.exports = { startScheduler, postDailyQuote, checkScheduledPosts };
