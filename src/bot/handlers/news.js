const Parser = require('rss-parser');
const parser = new Parser({ timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });

const FEEDS = [
  { name: 'ایران اینترنشنال', url: 'https://www.iranintl.com/iran-feed.rss' },
  { name: 'BBC فارسی', url: 'https://feeds.bbci.co.uk/persian/rss.xml' },
];

function escapeMarkdownV2(text) {
  return (text || '').replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
}

async function fetchFromFeed(feed) {
  try {
    const result = await parser.parseURL(feed.url);
    if (result?.items?.length) return { source: feed.name, items: result.items.slice(0, 5) };
  } catch (_) {}
  return null;
}

async function newsHandler(ctx) {
  const loadMsg = await ctx.reply('⏳ در حال دریافت اخبار...');

  try {
    // Try all feeds, use first that works
    let data = null;
    for (const feed of FEEDS) {
      data = await fetchFromFeed(feed);
      if (data) break;
    }

    if (!data) {
      return ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
        '❌ در حال حاضر دسترسی به اخبار ممکن نیست. دوباره امتحان کن.');
    }

    let text = `📰 *${escapeMarkdownV2(data.source)}*\n\n`;
    data.items.forEach((item, i) => {
      const title = escapeMarkdownV2((item.title || '').slice(0, 80));
      const link = item.link || '';
      text += `${i + 1}\\. [${title}](${link})\n\n`;
    });

    await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null, text, {
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true,
    });
  } catch (e) {
    await ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
      `❌ خطا: ${e.message.slice(0, 100)}`);
  }
}

module.exports = { newsHandler };
