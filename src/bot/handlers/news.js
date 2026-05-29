const { Markup } = require('telegraf');
const Parser = require('rss-parser');

const parser = new Parser({ timeout: 10000 });

const FEEDS = [
  { name: 'BBC فارسی', url: 'https://feeds.bbci.co.uk/persian/rss.xml' },
  { name: 'VOA فارسی', url: 'https://www.voanews.com/api/z-mkm_uepmq' },
  { name: 'رادیو فردا', url: 'https://www.radiofarda.com/api/epiqq' },
];

async function fetchNews() {
  for (const feed of FEEDS) {
    try {
      const result = await parser.parseURL(feed.url);
      if (result?.items?.length) return { source: feed.name, items: result.items.slice(0, 5) };
    } catch (_) {}
  }
  return null;
}

async function newsHandler(ctx) {
  const loadMsg = await ctx.reply('⏳ در حال دریافت اخبار...');

  try {
    const data = await fetchNews();

    if (!data) {
      return ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
        '❌ در حال حاضر دسترسی به اخبار ممکن نیست.');
    }

    let text = `📰 *آخرین اخبار — ${data.source}*\n\n`;
    data.items.forEach((item, i) => {
      const title = (item.title || '').slice(0, 80);
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
