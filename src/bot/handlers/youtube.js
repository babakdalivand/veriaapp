const { Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
const { spawn } = require('child_process');

const PYTHON_BIN = process.env.PYTHON_BIN || '/usr/bin/python3';

// youtubei.js evaluator is patched via postinstall script (scripts/patch-ytjs.mjs)
const { Innertube } = require('youtubei.js');

const userState = new Map();
const MAX_SIZE_MB = 45;

let ytInstance = null;
async function getYT() {
  if (!ytInstance) {
    ytInstance = await Innertube.create();
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
    const { isOwner } = require('../middleware/auth');
    const owner = await isOwner(ctx);

    if (!owner && duration > 900) {
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null,
        '❌ ویدیوهای بیشتر از ۱۵ دقیقه پشتیبانی نمی‌شن.');
      return;
    }

    const workable = await getWorkableFormats(info, innertube.session.player);

    if (workable.length === 0) {
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null,
        '❌ هیچ فرمت قابل دانلودی پیدا نشد.');
      return;
    }

    const videoButtons = workable.map(({ height }) =>
      Markup.button.callback(`🎬 ویدیو ${height}p`, `yt:${height}:${videoId}`)
    );
    const audioButton = Markup.button.callback('🎵 صدا MP3', `yt:audio:${videoId}`);

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
        ...Markup.inlineKeyboard([
          ...videoButtons.map(b => [b]),
          [audioButton],
        ])
      }
    );
  } catch (e) {
    console.error('[YT] getInfo error:', e.message);
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null,
      `❌ خطا در دریافت اطلاعات: ${e.message.slice(0, 100)}`);
  }
}

function ytdlpAudio(videoId, dest) {
  return new Promise((resolve, reject) => {
    const args = [
      '-m', 'yt_dlp',
      '--no-playlist',
      '--max-filesize', `${MAX_SIZE_MB}M`,
      '-f', 'bestaudio[ext=m4a]/bestaudio/best',
      '-x', '--audio-format', 'mp3', '--audio-quality', '0',
      '-o', dest,
      '--no-warnings',
      '--print', 'after_move:filepath',
      `https://www.youtube.com/watch?v=${videoId}`,
    ];
    let out = '', err = '';
    const proc = spawn(PYTHON_BIN, args, { timeout: 180000 });
    proc.stdout.on('data', d => { out += d; });
    proc.stderr.on('data', d => { err += d; });
    proc.on('close', code => {
      const filePath = out.trim().split('\n').pop();
      if (code === 0 && filePath && fs.existsSync(filePath)) resolve(filePath);
      else reject(new Error(err.slice(-300) || `exit code ${code}`));
    });
    proc.on('error', e => reject(new Error(`spawn failed: ${e.message}`)));
  });
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
  const data = ctx.callbackQuery.data; // yt:HEIGHT:videoId  or  yt:audio:videoId
  const parts = data.split(':');
  const mode = parts[1];
  const videoId = parts[2];
  const isAudio = mode === 'audio';

  await ctx.answerCbQuery(isAudio ? '🎵 در حال استخراج صدا...' : '⏳ در حال دانلود...');
  await ctx.editMessageText(isAudio ? '🎵 در حال استخراج صدا... لطفاً صبر کن.' : '⏳ در حال دانلود... لطفاً صبر کن.');

  let tmpFile = null;

  try {
    const innertube = await getYT();
    const info = await innertube.getInfo(videoId);
    const title = (info.basic_info.title || 'video').replace(/[^\w\s؀-ۿ]/g, '').trim().slice(0, 60);

    if (isAudio) {
      const destTemplate = path.join(os.tmpdir(), `yt_audio_${ctx.from.id}_${Date.now()}.%(ext)s`);
      tmpFile = await ytdlpAudio(videoId, destTemplate);

      const stat = fs.statSync(tmpFile);
      if (stat.size > MAX_SIZE_MB * 1024 * 1024) {
        fs.unlinkSync(tmpFile);
        return ctx.editMessageText(`❌ فایل ${formatSize(stat.size)} است — بیشتر از حد مجاز.`);
      }

      await ctx.editMessageText('📤 در حال آپلود...');
      await ctx.replyWithAudio(
        { source: tmpFile, filename: title + '.mp3' },
        { caption: `🎵 ${title}`, title, performer: 'YouTube' }
      );
    } else {
      const targetHeight = parseInt(mode);
      tmpFile = path.join(os.tmpdir(), `yt_${ctx.from.id}_${Date.now()}.mp4`);

      const workable = await getWorkableFormats(info, innertube.session.player);
      const chosen = workable.find(w => w.height === targetHeight) || workable[0];

      if (!chosen) return ctx.editMessageText('❌ فرمت مورد نظر پیدا نشد.');

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
    }

    await ctx.deleteMessage().catch(() => {});
  } catch (e) {
    console.error('[YT] download error:', e.message);
    await ctx.editMessageText(`❌ خطا: ${e.message.slice(0, 150)}`).catch(() => {});
  } finally {
    if (tmpFile && fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

// Get video info for Mini App (title, duration, available formats)
async function getYoutubeVideoInfo(videoId) {
  const innertube = await getYT();
  const info = await innertube.getInfo(videoId);
  const details = info.basic_info;
  const duration = details.duration || 0;

  if (duration > 900) throw new Error('ویدیوهای بیشتر از ۱۵ دقیقه پشتیبانی نمی‌شن.');

  const workable = await getWorkableFormats(info, innertube.session.player);
  if (workable.length === 0) throw new Error('هیچ فرمت قابل دانلودی پیدا نشد.');

  return {
    title: details.title || 'ویدیو',
    duration,
    durationStr: formatDuration(duration),
    viewCount: details.view_count ? parseInt(details.view_count) : 0,
    thumbnail: details.thumbnail?.[0]?.url || null,
    formats: workable.map(w => ({
      height: w.height,
      sizeMB: w.format.content_length
        ? parseFloat((parseInt(w.format.content_length) / 1024 / 1024).toFixed(1))
        : null,
    })),
  };
}

// Download and send to channel with CTA inline keyboard
async function downloadYoutubeToChannel(bot, videoId, targetHeight, channelId) {
  const innertube = await getYT();
  const info = await innertube.getInfo(videoId);
  const title = (info.basic_info.title || 'ویدیو').replace(/[^\w\s؀-ۿ]/g, '').trim().slice(0, 100);

  const workable = await getWorkableFormats(info, innertube.session.player);
  const chosen = workable.find(w => w.height === targetHeight) || workable[0];
  if (!chosen) throw new Error('فرمت مورد نظر پیدا نشد.');

  const contentLength = chosen.format.content_length ? parseInt(chosen.format.content_length) : null;
  if (contentLength && contentLength > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`فایل ${formatSize(contentLength)} است — بیشتر از حد مجاز تلگرام.`);
  }

  const tmpFile = path.join(os.tmpdir(), `yt_ch_${Date.now()}.mp4`);
  try {
    await downloadUrl(chosen.url, tmpFile);
    const stat = fs.statSync(tmpFile);
    if (stat.size > MAX_SIZE_MB * 1024 * 1024) {
      throw new Error(`فایل ${formatSize(stat.size)} است — بیشتر از حد مجاز تلگرام.`);
    }

    const channelStr = String(channelId);
    const channelUsername = channelStr.startsWith('@') ? channelStr.slice(1) : null;

    const ctaButtons = [];
    if (channelUsername) {
      ctaButtons.push({ text: '📢 عضویت در کانال', url: `https://t.me/${channelUsername}` });
    }
    ctaButtons.push({ text: '▶️ مشاهده در یوتیوب', url: `https://youtu.be/${videoId}` });

    await bot.telegram.sendVideo(
      channelStr,
      { source: tmpFile, filename: title + '.mp4' },
      {
        caption: `🎬 ${title}`,
        reply_markup: { inline_keyboard: [ctaButtons] },
      }
    );

    return { ok: true, title };
  } finally {
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch {}
  }
}

module.exports = {
  youtubeMenuHandler,
  handleYoutubeUrl,
  youtubeDownloadCallback,
  userState,
  extractVideoId,
  isYoutubeUrl,
  formatDuration,
  getYT,
  getYoutubeVideoInfo,
  downloadYoutubeToChannel,
};
