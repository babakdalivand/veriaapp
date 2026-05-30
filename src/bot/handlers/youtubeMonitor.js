const https = require('https');
const http = require('http');
const YoutubeMonitor = require('../../database/models/YoutubeMonitor');
const Settings = require('../../database/models/Settings');

// ── HTTP helper ───────────────────────────────────────────────────────────────

function fetchUrl(url, maxRedirects = 4) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 15000,
    }, (res) => {
      if ((res.statusCode >= 301 && res.statusCode <= 308)
          && res.headers.location && maxRedirects > 0) {
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return fetchUrl(next, maxRedirects - 1).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function decodeHtml(str) {
  return String(str || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'");
}

function sanitizeMd(text) {
  return String(text || '').replace(/[*_`[\]]/g, '').slice(0, 300);
}

// ── RSS parsing ───────────────────────────────────────────────────────────────

async function fetchRss(channelId) {
  const res = await fetchUrl(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
  if (res.status !== 200) throw new Error(`RSS returned ${res.status}`);
  return res.data;
}

function parseRssEntries(xml) {
  const entries = [];
  const re = /<entry>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const e = m[1];
    const idM     = e.match(/<yt:videoId>([\w-]+)<\/yt:videoId>/);
    const titleM  = e.match(/<media:title[^>]*>([\s\S]*?)<\/media:title>/);
    const thumbM  = e.match(/<media:thumbnail[^>]+url="([^"]+)"/);
    const pubM    = e.match(/<published>([\s\S]*?)<\/published>/);
    if (!idM) continue;
    entries.push({
      id:        idM[1],
      title:     decodeHtml(titleM ? titleM[1] : ''),
      thumbnail: thumbM ? thumbM[1] : null,
      published: pubM ? pubM[1] : null,
    });
  }
  return entries;
}

// ── Caption builder ───────────────────────────────────────────────────────────

function buildPost(item, monitor) {
  const title  = sanitizeMd(item.data.title || 'ویدیو بدون عنوان');
  const chName = sanitizeMd(monitor.channelTitle);
  const handle = monitor.channelHandle;
  const chUrl  = handle
    ? `https://www.youtube.com/${handle}`
    : `https://www.youtube.com/channel/${monitor.channelId}`;
  const vidUrl = `https://www.youtube.com/watch?v=${item.id}`;

  const caption =
    `🎬 *${title}*\n\n` +
    `📺 [${chName}](${chUrl})`;

  return {
    caption,
    thumbnail: item.data.thumbnail || monitor.thumbnailUrl,
    buttons: [
      [
        { text: '▶️ تماشای ویدیو', url: vidUrl },
        { text: '🔔 سابسکرایب', url: chUrl },
      ],
      [{ text: '👍 لایک ویدیو', url: vidUrl }],
    ],
  };
}

// ── Post to Telegram ──────────────────────────────────────────────────────────

async function postItem(bot, telegramChannelId, item, monitor) {
  const { caption, thumbnail, buttons } = buildPost(item, monitor);
  const replyMarkup = { inline_keyboard: buttons };
  const opts = { caption, parse_mode: 'Markdown', reply_markup: replyMarkup };

  if (thumbnail) {
    try {
      await bot.telegram.sendPhoto(String(telegramChannelId), thumbnail, opts);
      return;
    } catch (e) {
      if (!e.message.includes('PHOTO') && !e.message.includes('photo') && !e.message.includes('wrong type')) throw e;
    }
  }

  await bot.telegram.sendMessage(String(telegramChannelId), caption, {
    parse_mode: 'Markdown',
    reply_markup: replyMarkup,
    disable_web_page_preview: false,
  });
}

// ── Get new items (from RSS) ──────────────────────────────────────────────────

async function getNewItems(channelId, postedIds) {
  const xml     = await fetchRss(channelId);
  const entries = parseRssEntries(xml);
  return entries
    .filter(e => !postedIds.includes(e.id))
    .map(e => ({ id: e.id, type: 'video', data: { title: e.title, thumbnail: e.thumbnail } }));
}

// ── Resolve channel from URL / handle / ID ────────────────────────────────────

async function resolveChannel(input) {
  let url = input.trim();

  // Normalize to a YouTube URL
  if (!url.startsWith('http')) {
    if (url.startsWith('@')) {
      url = `https://www.youtube.com/${url}`;
    } else if (/^UC[\w-]{20,}$/.test(url)) {
      url = `https://www.youtube.com/channel/${url}`;
    } else {
      url = `https://www.youtube.com/@${url}`;
    }
  }

  const res = await fetchUrl(url);
  if (res.status !== 200) throw new Error(`HTTP ${res.status} از یوتیوب`);
  const html = res.data;

  // Channel ID
  const cidM = html.match(/"channelId":"(UC[\w-]+)"/) ||
               html.match(/"externalId":"(UC[\w-]+)"/);
  if (!cidM) throw new Error('شناسه کانال یوتیوب پیدا نشد. مطمئن شو آدرس درست است.');
  const channelId = cidM[1];

  // Title — try multiple patterns
  const titleM = html.match(/"microformatDataRenderer"[\s\S]{0,200}?"title":"([^"]+)"/) ||
                 html.match(/<meta name="title" content="([^"]+)"/) ||
                 html.match(/<title>([^<]+)<\/title>/);
  const channelTitle = titleM
    ? decodeHtml(titleM[1]).replace(/ - YouTube$/, '').trim()
    : channelId;

  // Handle (@username)
  const handleM = html.match(/"canonicalBaseUrl":"(@[\w.-]+)"/) ||
                  html.match(/"vanityUrl":"(@[\w.-]+)"/);
  const channelHandle = handleM ? handleM[1] : null;

  // Channel avatar thumbnail
  const thumbM = html.match(/"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/) ||
                 html.match(/<meta name="twitter:image" content="([^"]+)"/);
  const thumbnailUrl = thumbM
    ? thumbM[1].replace(/=s\d+-/, '=s240-').split('?')[0]
    : null;

  // Seed existing video IDs so we don't re-post old content on first add
  const existingIds = [];
  try {
    const xml = await fetchRss(channelId);
    for (const e of parseRssEntries(xml).slice(0, 15)) existingIds.push(e.id);
  } catch {}

  return { channelId, channelTitle, channelHandle, thumbnailUrl, existingIds };
}

// ── Main cron job ─────────────────────────────────────────────────────────────

async function checkAllChannels(bot) {
  const settings = await Settings.getSettings().catch(() => null);
  const tgChannel = settings?.mainChannelId;
  if (!tgChannel) return;

  const monitors = await YoutubeMonitor.findAll({ where: { isActive: true } }).catch(() => []);
  if (!monitors.length) return;

  for (const monitor of monitors) {
    try {
      const postedIds = JSON.parse(monitor.postedIds || '[]');
      const newItems  = await getNewItems(monitor.channelId, postedIds);

      for (const item of newItems) {
        try {
          await postItem(bot, tgChannel, item, monitor);
          postedIds.unshift(item.id);
          await new Promise(r => setTimeout(r, 3000));
        } catch (e) {
          console.error(`[YTMonitor] Post failed for ${item.id}: ${e.message}`);
        }
      }

      if (newItems.length > 0) {
        monitor.postedIds = JSON.stringify(postedIds.slice(0, 50));
        await monitor.save();
        console.log(`[YTMonitor] ${monitor.channelTitle}: ${newItems.length} new item(s) posted`);
      }
    } catch (e) {
      console.error(`[YTMonitor] Channel ${monitor.channelTitle} error: ${e.message}`);
    }
  }
}

module.exports = { resolveChannel, checkAllChannels };
