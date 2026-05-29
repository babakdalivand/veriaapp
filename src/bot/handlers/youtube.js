const { Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');

// youtubei.js evaluator is patched via postinstall script (scripts/patch-ytjs.mjs)
const { Innertube } = require('youtubei.js');

const userState = new Map();
const MAX_SIZE_MB = 45;

let ytInstance = null;
async function getYT() {
  if (!ytInstance) {
    ytInstance = await Innertube.create({ cache: false, generate_session_locally: true });
    patchYtjsEval();
  }
  return ytInstance;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatSize(bytes) {
  if (!bytes) return '?';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

function extractVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function isYoutubeUrl(text) {
  return /(?:youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\/)/.test(text);
}

// Returns only formats that can actually be deciphered
async function getWorkableFormats(info, player) {
  const muxed = info.streaming_data?.formats || [];
  const results = [];

  for (const f of muxed) {
    try {
      const url = await f.decipher(player);
      if (url && typeof url === 'string' && url.startsWith('http')) {
        results.push({ format: f, url, height: f.height || 0 });
      }
    } catch (_) {}
  }

  // Sort by quality descending
  results.sort((a, b) => b.height - a.height);
  return results;
}

async function youtubeMenuHandler(ctx) {
  userState.set(ctx.from.id, 'waiting_url');
  await ctx.reply(
    '📺 *دانلود یوتیوب*\n\nلینک ویدیو را بفرست:',
    {
      parse_mode: 'Markdown',
      ...Markup.keyboard([['❌ انصراف']]).resize()
    }
  );
}

async function handleYoutubeUrl(ctx) {
  const userId = ctx.from.id;
  const text = ctx.message?.text?.trim();

  if (text === '❌ انصراف') {
    userState.delete(userId);
    const { ownerKeyboard, adminKeyboard, userKeyboard } = require('../keyboards/mainMenu');
    const { isOwner, isAdmin } = require('../middleware/auth');
    let kb = userKeyboard;
    if (await isOwner(ctx)) kb = ownerKeyboard;
    else if (await isAdmin(ctx)) kb = adminKeyboard;
    return ctx.reply('بازگشت به منو.', kb);
  }

  if (!isYoutubeUrl(text)) {
    return ctx.reply('❌ لینک معتبر یوتیوب نیست. دوباره امتحان کن یا ❌ انصراف بزن.');
  }

  const videoId = extractVideoId(text);
  if (!videoId) {
    return ctx.reply('❌ نتوانستم شناسه ویدیو را پیدا کنم.');
  }

  userState.delete(userId);
  const loadingMsg = await ctx.reply('⏳ در حال دریافت اطلاعات ویدیو...');

  try {
    const innertube = await getYT();
    const info = await innertube.getInfo(videoId);
    const details = info.basic_info;
    const duration = details.duration || 0;

    if (duration > 600) {
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null,
        '❌ ویدیوهای بیشتر از ۱۰ دقیقه پشتیبانی نمی‌شن.');
      return;
    }

    const workable = await getWorkableFormats(info, innertube.session.player);

    if (workable.length === 0) {
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null,
        '❌ هیچ فرمت قابل دانلودی پیدا نشد.');
      return;
    }

    const buttons = workable.map(({ format, height }) =>
      Markup.button.callback(
        `🎬 ویدیو ${height}p`,
        `yt:${height}:${videoId}`
      )
    );

    const title = details.title || 'ویدیو';
    const views = details.view_count ? parseInt(details.view_count).toLocaleString() : '?';

    await ctx.telegram.editMessageText(
      ctx.chat.id, loadingMsg.message_id, null,
      `🎬 *${title.slice(0, 100)}*\n\n` +
      `⏱ مدت: ${formatDuration(duration)}\n` +
      `👁 بازدید: ${views}\n\n` +
      `کیفیت دلخواه را انتخاب کن:`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons.map(b => [b]))
      }
    );
  } catch (e) {
    console.error('[YT] getInfo error:', e.message);
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null,
      `❌ خطا در دریافت اطلاعات: ${e.message.slice(0, 100)}`);
  }
}

function downloadUrl(url, dest) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    const req = proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        return downloadUrl(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    });
    req.on('error', (e) => { try { fs.unlinkSync(dest); } catch {} reject(e); });
    file.on('error', (e) => { try { fs.unlinkSync(dest); } catch {} reject(e); });
  });
}

async function youtubeDownloadCallback(ctx) {
  const data = ctx.callbackQuery.data; // yt:HEIGHT:videoId
  const parts = data.split(':');
  const targetHeight = parseInt(parts[1]);
  const videoId = parts[2];

  await ctx.answerCbQuery('⏳ در حال دانلود...');
  await ctx.editMessageText('⏳ در حال دانلود... لطفاً صبر کن.');

  const tmpFile = path.join(os.tmpdir(), `yt_${ctx.from.id}_${Date.now()}.mp4`);

  try {
    const innertube = await getYT();
    const info = await innertube.getInfo(videoId);
    const title = (info.basic_info.title || 'video').replace(/[^\w\s؀-ۿ]/g, '').trim().slice(0, 60);

    const workable = await getWorkableFormats(info, innertube.session.player);
    const chosen = workable.find(w => w.height === targetHeight) || workable[0];

    if (!chosen) {
      return ctx.editMessageText('❌ فرمت مورد نظر پیدا نشد.');
    }

    const contentLength = chosen.format.content_length ? parseInt(chosen.format.content_length) : null;
    if (contentLength && contentLength > MAX_SIZE_MB * 1024 * 1024) {
      return ctx.editMessageText(`❌ فایل ${formatSize(contentLength)} است — بیشتر از حد مجاز تلگرام.`);
    }

    await downloadUrl(chosen.url, tmpFile);

    const stat = fs.statSync(tmpFile);
    if (stat.size > MAX_SIZE_MB * 1024 * 1024) {
      fs.unlinkSync(tmpFile);
      return ctx.editMessageText(`❌ فایل ${formatSize(stat.size)} است — بیشتر از حد مجاز.`);
    }

    await ctx.editMessageText('📤 در حال آپلود...');
    await ctx.replyWithVideo(
      { source: tmpFile, filename: title + '.mp4' },
      { caption: `🎬 ${title} (${chosen.height}p)` }
    );
    await ctx.deleteMessage().catch(() => {});
  } catch (e) {
    console.error('[YT] download error:', e.message);
    await ctx.editMessageText(`❌ خطا: ${e.message.slice(0, 150)}`).catch(() => {});
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

module.exports = { youtubeMenuHandler, handleYoutubeUrl, youtubeDownloadCallback, userState };
