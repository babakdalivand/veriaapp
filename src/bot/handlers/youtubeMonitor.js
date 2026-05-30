const YoutubeMonitor = require('../../database/models/YoutubeMonitor');
const Settings = require('../../database/models/Settings');
const { getYT, formatDuration } = require('./youtube');

// ── Helpers ──────────────────────────────────────────────────────────────────

function getText(val) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && val.text) return val.text;
  return String(val);
}

function getThumbnail(video) {
  const thumbs = video.thumbnails || video.thumbnail;
  if (!thumbs) return null;
  const arr = Array.isArray(thumbs) ? thumbs : [thumbs];
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => (b.width || 0) - (a.width || 0));
  return sorted[0]?.url || null;
}

function getDuration(v) {
  if (!v.duration) return '';
  if (typeof v.duration === 'object' && v.duration.text) return v.duration.text;
  if (typeof v.duration === 'number') return formatDuration(v.duration);
  return String(v.duration);
}

function sanitizeMd(text) {
  return String(text || '').replace(/[*_`[\]]/g, '').slice(0, 300);
}

// ── Caption builder ───────────────────────────────────────────────────────────

function buildPost(item, monitor) {
  const v      = item.data;
  const title  = sanitizeMd(getText(v.title) || 'ویدیو بدون عنوان');
  const chName = sanitizeMd(monitor.channelTitle);
  const handle = monitor.channelHandle;
  const chUrl  = handle
    ? `https://www.youtube.com/${handle}`
    : `https://www.youtube.com/channel/${monitor.channelId}`;
  const vidUrl = item.type === 'short'
    ? `https://www.youtube.com/shorts/${item.id}`
    : `https://www.youtube.com/watch?v=${item.id}`;
  const dur    = getDuration(v);
  const desc   = sanitizeMd(getText(v.description_snippet) || getText(v.short_description));

  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(vidUrl)}&text=${encodeURIComponent(getText(v.title) || title)}`;

  if (item.type === 'video') {
    const caption =
      `🎬 *${title}*\n\n` +
      `📺 [${chName}](${chUrl})` +
      (dur ? `\n⏱ مدت: ${dur}` : '') +
      (desc ? `\n\n${desc}` : '');

    return {
      caption,
      buttons: [
        [
          { text: '▶️ تماشای ویدیو', url: vidUrl },
          { text: '🔔 سابسکرایب', url: chUrl },
        ],
        [
          { text: '👍 لایک ویدیو', url: vidUrl },
        ],
      ],
    };
  }

  if (item.type === 'short') {
    const caption =
      `📱 *${title}*\n\n` +
      `🎬 [${chName}](${chUrl}) — شورت` +
      (dur ? `\n⏱ ${dur}` : '');

    return {
      caption,
      buttons: [
        [
          { text: '▶️ تماشا', url: vidUrl },
          { text: '🔔 سابسکرایب', url: chUrl },
        ],
        [
          { text: '👍 لایک', url: vidUrl },
        ],
      ],
    };
  }

  if (item.type === 'live') {
    const caption =
      `🔴 *لایو الان: ${title}*\n\n` +
      `📺 [${chName}](${chUrl})\n` +
      `⚡️ همین الان در حال پخش است!`;

    return {
      caption,
      buttons: [
        [
          { text: '🔴 تماشای لایو', url: vidUrl },
          { text: '🔔 سابسکرایب', url: chUrl },
        ],
      ],
    };
  }

  // upcoming
  const scheduledTime = v.upcoming
    ? new Date(v.upcoming).toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' })
    : '';
  const caption =
    `📅 *لایو پیش‌رو: ${title}*\n\n` +
    `📺 [${chName}](${chUrl})` +
    (scheduledTime ? `\n⏰ زمان: ${scheduledTime} (تهران)` : '') +
    `\n\n🔔 سابسکرایب کنید تا یادآوری دریافت کنید`;

  return {
    caption,
    buttons: [
      [
        { text: '🔔 یادآوری', url: vidUrl },
        { text: '🔔 سابسکرایب', url: chUrl },
      ],
      [
        { text: '▶️ مشاهده', url: vidUrl },
      ],
    ],
  };
}

// ── Post to Telegram ──────────────────────────────────────────────────────────

async function postItem(bot, telegramChannelId, item, monitor) {
  const { caption, buttons } = buildPost(item, monitor);
  const thumbUrl = getThumbnail(item.data) || monitor.thumbnailUrl;
  const replyMarkup = buttons.length ? { inline_keyboard: buttons } : undefined;

  const opts = { caption, parse_mode: 'Markdown', reply_markup: replyMarkup };

  if (thumbUrl) {
    try {
      await bot.telegram.sendPhoto(String(telegramChannelId), thumbUrl, opts);
      return;
    } catch (e) {
      if (!e.message.includes('PHOTO') && !e.message.includes('photo') && !e.message.includes('wrong type')) throw e;
      // Fall through to text
    }
  }

  await bot.telegram.sendMessage(String(telegramChannelId), caption, {
    parse_mode: 'Markdown',
    reply_markup: replyMarkup,
    disable_web_page_preview: false,
  });
}

// ── Fetch new items from channel ──────────────────────────────────────────────

async function getNewItems(innertube, channelId, postedIds) {
  const channel = await innertube.getChannel(channelId);
  const items   = [];

  const tryTab = async (getter, type) => {
    try {
      const page = await getter();
      const vids = page.videos || page.shorts || [];
      for (const v of vids.slice(0, 5)) {
        if (!v.id) continue;
        const isLive     = v.is_live || v.live_now;
        const isUpcoming = v.is_upcoming || (v.upcoming != null);
        // For lives tab, track live and upcoming separately
        const resolvedType = type === 'lives'
          ? (isLive ? 'live' : isUpcoming ? 'upcoming' : null)
          : type;
        if (!resolvedType) continue;
        if (!postedIds.includes(v.id)) {
          items.push({ type: resolvedType, id: v.id, data: v });
        }
      }
    } catch (e) {
      // tab might not exist for this channel — safe to ignore
    }
  };

  await tryTab(() => channel.getVideos(), 'video');
  await tryTab(() => channel.getShorts(), 'short');
  await tryTab(() => channel.getLiveStreams(), 'lives');

  return items;
}

// ── Resolve channel from URL / handle / ID ────────────────────────────────────

async function resolveChannel(input) {
  const innertube = await getYT();
  let id = input.trim();

  // Extract from full URL
  const urlMatch = id.match(/youtube\.com\/(?:channel\/(UC[\w-]+)|@([\w.]+)|c\/([\w.]+)|user\/([\w.]+))/);
  if (urlMatch) {
    id = urlMatch[1] ? urlMatch[1] : '@' + (urlMatch[2] || urlMatch[3] || urlMatch[4]);
  } else if (id.startsWith('https://') || id.startsWith('http://')) {
    // Could be youtu.be or other — just try as-is
  }

  const channel = await innertube.getChannel(id);
  const meta    = channel.metadata;

  // Get existing video IDs so we don't re-post old content on first add
  const existingIds = [];
  try {
    const vp = await channel.getVideos();
    for (const v of (vp.videos || []).slice(0, 15)) {
      if (v.id) existingIds.push(v.id);
    }
  } catch {}
  try {
    const sp = await channel.getShorts();
    for (const v of (sp.videos || sp.shorts || []).slice(0, 10)) {
      if (v.id) existingIds.push(v.id);
    }
  } catch {}

  const channelId = meta.external_id || (id.startsWith('UC') ? id : null);
  if (!channelId) throw new Error('شناسه کانال یوتیوب پیدا نشد.');

  return {
    channelId,
    channelTitle: getText(meta.title) || id,
    channelHandle: meta.vanity_url || (id.startsWith('@') ? id : null),
    thumbnailUrl:  getThumbnail({ thumbnails: meta.thumbnail }) || null,
    existingIds,
  };
}

// ── Main cron job ─────────────────────────────────────────────────────────────

async function checkAllChannels(bot) {
  const settings = await Settings.getSettings().catch(() => null);
  const tgChannel = settings?.mainChannelId;
  if (!tgChannel) return;

  const monitors = await YoutubeMonitor.findAll({ where: { isActive: true } }).catch(() => []);
  if (!monitors.length) return;

  const innertube = await getYT();

  for (const monitor of monitors) {
    try {
      const postedIds = JSON.parse(monitor.postedIds || '[]');
      const newItems  = await getNewItems(innertube, monitor.channelId, postedIds);

      for (const item of newItems) {
        try {
          await postItem(bot, tgChannel, item, monitor);
          postedIds.unshift(item.id);
          await new Promise(r => setTimeout(r, 3000)); // rate-limit
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
