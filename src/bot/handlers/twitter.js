const { Markup } = require('telegraf');
const Parser = require('rss-parser');
const parser = new Parser({ timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });

// Nitter instances (fallback list)
const NITTER_INSTANCES = [
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
  'https://nitter.nl',
];

// Default accounts to follow - customizable
const DEFAULT_ACCOUNTS = [
  'IranIntl_Fa',
  'bbcpersian',
  'AlinejadMasih',
];

async function fetchTweets(username) {
  for (const instance of NITTER_INSTANCES) {
    try {
      const url = `${instance}/${username}/rss`;
      const feed = await parser.parseURL(url);
      if (feed?.items?.length) {
        return feed.items.slice(0, 3).map(item => ({
          title: (item.title || '').slice(0, 200),
          link: item.link?.replace(instance, 'https://twitter.com') || '',
          date: item.pubDate ? new Date(item.pubDate).toLocaleDateString('fa-IR') : '',
        }));
      }
    } catch (_) {}
  }
  return null;
}

async function twitterMenuHandler(ctx) {
  const buttons = DEFAULT_ACCOUNTS.map(acc =>
    [Markup.button.callback(`🐦 @${acc}`, `tw:${acc}`)]
  );
  buttons.push([Markup.button.callback('✏️ اکانت دلخواه', 'tw:custom')]);

  await ctx.reply(
    '🐦 *توییتر*\n\nاکانت مورد نظر را انتخاب کن:',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    }
  );
}

// In-memory state for custom account input
const userState = new Map();

async function twitterCallback(ctx) {
  const data = ctx.callbackQuery.data;
  const account = data.replace('tw:', '');

  await ctx.answerCbQuery();

  if (account === 'custom') {
    userState.set(ctx.from.id, 'waiting_twitter');
    return ctx.editMessageText(
      '🐦 نام کاربری اکانت توییتر را بفرست:\n_(مثال: elonmusk)_',
      { parse_mode: 'Markdown' }
    );
  }

  await showTweets(ctx, account);
}

async function handleTwitterUsername(ctx) {
  const userId = ctx.from.id;
  const username = ctx.message?.text?.trim().replace('@', '');
  userState.delete(userId);

  if (!username || username.length > 50) {
    return ctx.reply('❌ نام کاربری نامعتبر است.');
  }

  await showTweets(ctx, username);
}

async function showTweets(ctx, username) {
  const loadMsg = await ctx.reply(`⏳ در حال دریافت توییت‌های @${username}...`);

  try {
    const tweets = await fetchTweets(username);

    if (!tweets) {
      return ctx.telegram.editMessageText(ctx.chat.id, loadMsg.message_id, null,
        `❌ نتوانستم توییت‌های @${username} را دریافت کنم.`);
    }

    let text = `🐦 *@${username}*\n\n`;
    tweets.forEach((t, i) => {
      text += `${i + 1}\\. ${t.title.replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&')}\n[مشاهده](${t.link})\n\n`;
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

module.exports = { twitterMenuHandler, twitterCallback, handleTwitterUsername, userState };
