const https = require('https');
const http = require('http');
const Settings = require('../../database/models/Settings');

// ── HTTP helper ───────────────────────────────────────────────────────────────

function fetchUrl(url, maxRedirects = 4) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VeriaBot/1.0)' },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode >= 301 && res.statusCode <= 308 && res.headers.location && maxRedirects > 0) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return fetchUrl(next, maxRedirects - 1).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// ── RSS parsing ───────────────────────────────────────────────────────────────

const RSS_URL = 'https://www.persianatheists.com/feed/';

// Persistent set of posted GUIDs (in-memory, reset on restart — Settings used for persistence)
let postedGuids = null;

async function loadPostedGuids() {
  if (postedGuids !== null) return;
  const settings = await Settings.getSettings().catch(() => null);
  const raw = settings?.websitePostedGuids || '[]';
  try { postedGuids = new Set(JSON.parse(raw)); } catch { postedGuids = new Set(); }
}

async function savePostedGuids() {
  const arr = [...postedGuids].slice(-100);
  const settings = await Settings.getSettings().catch(() => null);
  if (settings) await settings.update({ websitePostedGuids: JSON.stringify(arr) }).catch(() => {});
}

function decodeHtml(str) {
  return String(str || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseRss(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const entry = m[1];
    const guidM   = entry.match(/<guid[^>]*>(.*?)<\/guid>/);
    const titleM  = entry.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const linkM   = entry.match(/<link>(.*?)<\/link>/);
    const descM   = entry.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
    const thumbM  = entry.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)[^\s"'<>]*/i);
    if (!guidM || !titleM || !linkM) continue;
    const desc = descM ? stripTags(decodeHtml(descM[1])).slice(0, 200) : '';
    items.push({
      guid:      guidM[1].trim(),
      title:     decodeHtml(titleM[1]),
      link:      linkM[1].trim(),
      thumbnail: thumbM ? thumbM[0] : null,
      excerpt:   desc,
    });
  }
  return items;
}

// ── Build Telegram message ────────────────────────────────────────────────────

function sanitizeMd(t) {
  return String(t || '').replace(/[*_`[\]]/g, '').slice(0, 300);
}

function buildMessage(item) {
  const title   = sanitizeMd(item.title);
  const excerpt = sanitizeMd(item.excerpt);
  const text =
    `📰 *${title}*` +
    (excerpt ? `\n\n${excerpt}…` : '') +
    `\n\n🌐 [persianatheists.com](${item.link})`;

  const buttons = [[
    { text: '📖 مطالعه کامل', url: item.link },
    { text: '🌐 وب‌سایت', url: 'https://www.persianatheists.com' },
  ]];

  return { text, thumbnail: item.thumbnail, buttons };
}

// ── Post to channel ───────────────────────────────────────────────────────────

async function postWebsiteItem(bot, channelId, item) {
  const { text, thumbnail, buttons } = buildMessage(item);
  const replyMarkup = { inline_keyboard: buttons };

  if (thumbnail) {
    try {
      await bot.telegram.sendPhoto(String(channelId), thumbnail, {
        caption: text,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      });
      return;
    } catch (e) {
      if (!e.message.includes('PHOTO') && !e.message.includes('photo')) throw e;
    }
  }

  await bot.telegram.sendMessage(String(channelId), text, {
    parse_mode: 'Markdown',
    reply_markup: replyMarkup,
    disable_web_page_preview: false,
  });
}

// ── Main cron function ────────────────────────────────────────────────────────

async function checkWebsite(bot) {
  await loadPostedGuids();

  const settings = await Settings.getSettings().catch(() => null);
  const tgChannel = settings?.mainChannelId;
  if (!tgChannel) return;

  let xml;
  try {
    const res = await fetchUrl(RSS_URL);
    if (res.status !== 200) return;
    xml = res.data;
  } catch (e) {
    console.error('[WebsiteMonitor] RSS fetch error:', e.message);
    return;
  }

  const items = parseRss(xml);
  const newItems = items.filter(i => !postedGuids.has(i.guid));

  for (const item of newItems.reverse()) { // oldest first
    try {
      await postWebsiteItem(bot, tgChannel, item);
      postedGuids.add(item.guid);
      await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
      console.error(`[WebsiteMonitor] Post failed: ${e.message}`);
    }
  }

  if (newItems.length > 0) {
    await savePostedGuids();
    console.log(`[WebsiteMonitor] ${newItems.length} new post(s) sent`);
  }
}

module.exports = { checkWebsite };
