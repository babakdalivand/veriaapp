const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Markup } = require('telegraf');

const MAX_SIZE_MB = 45;

// Short-lived store: id -> { url, userId, platform }
// Cleared after 15 minutes to avoid memory leak
const pendingDownloads = new Map();
function genId() { return Math.random().toString(36).slice(2, 9); }
setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [k, v] of pendingDownloads) {
    if (v.ts < cutoff) pendingDownloads.delete(k);
  }
}, 5 * 60 * 1000);

const PLATFORM_INFO = {
  youtube:    { name: 'یوتیوب',      emoji: '📺' },
  instagram:  { name: 'اینستاگرام',  emoji: '📷' },
  twitter:    { name: 'توییتر / X',  emoji: '🐦' },
  tiktok:     { name: 'تیک‌تاک',     emoji: '🎵' },
  soundcloud: { name: 'ساندکلاد',    emoji: '🎵' },
  vimeo:      { name: 'ویمیو',       emoji: '🎬' },
  dailymotion:{ name: 'دیلی‌موشن',  emoji: '🎬' },
  pinterest:  { name: 'پینترست',     emoji: '📌' },
};

function detectPlatform(url) {
  try {
    const u = url.toLowerCase();
    if (/youtube\.com|youtu\.be/.test(u))     return 'youtube';
    if (/instagram\.com/.test(u))             return 'instagram';
    if (/twitter\.com|x\.com/.test(u))        return 'twitter';
    if (/tiktok\.com|vm\.tiktok\.com/.test(u))return 'tiktok';
    if (/soundcloud\.com/.test(u))            return 'soundcloud';
    if (/vimeo\.com/.test(u))                 return 'vimeo';
    if (/dailymotion\.com|dai\.ly/.test(u))   return 'dailymotion';
    if (/pinterest\.com|pin\.it/.test(u))     return 'pinterest';
  } catch {}
  return null;
}

function extractFirstUrl(text) {
  const m = text.match(/https?:\/\/[^\s]+/);
  return m ? m[0] : null;
}

// Call cobalt.tools public API
async function callCobalt(mediaUrl, audioOnly = false) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      url: mediaUrl,
      videoQuality: '1080',
      audioFormat: audioOnly ? 'mp3' : 'best',
      downloadMode: audioOnly ? 'audio' : 'auto',
      filenameStyle: 'pretty',
      twitterGif: false,
    });

    const options = {
      hostname: 'api.cobalt.tools',
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'VeriaApp/2.0 (https://veriaapp.persianatheists.com)',
      },
      timeout: 15000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('پاسخ نامعتبر از سرویس دانلود'));
        }
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('سرویس دانلود پاسخ نداد (timeout)')); });
    req.on('error', (e) => reject(new Error(`خطای شبکه: ${e.message}`)));
    req.write(body);
    req.end();
  });
}

// Download a file URL to a local path
function downloadFile(fileUrl, destPath) {
  return new Promise((resolve, reject) => {
    const proto = fileUrl.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);

    const doRequest = (url, redirectCount = 0) => {
      if (redirectCount > 5) return reject(new Error('Too many redirects'));
      const p = url.startsWith('https') ? https : http;
      p.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VeriaApp/2.0)' },
        timeout: 60000,
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          return doRequest(res.headers.location, redirectCount + 1);
        }
        if (res.statusCode !== 200) {
          file.close();
          try { fs.unlinkSync(destPath); } catch {}
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', (e) => { try { fs.unlinkSync(destPath); } catch {} reject(e); });
      }).on('error', (e) => { try { fs.unlinkSync(destPath); } catch {} reject(e); });
    };

    doRequest(fileUrl);
  });
}

function formatSize(bytes) {
  if (!bytes) return '';
  return ` (${(bytes / 1024 / 1024).toFixed(1)} MB)`;
}

// Main handler: detect URL in message and offer download
async function handleMediaLink(ctx) {
  const text = ctx.message?.text?.trim();
  if (!text) return;

  const url = extractFirstUrl(text);
  if (!url) return;

  const platform = detectPlatform(url);
  if (!platform) return;

  // YouTube is handled by the existing dedicated handler — skip here
  // unless you want to unify; for now keep existing youtube handler
  if (platform === 'youtube') return;

  const info = PLATFORM_INFO[platform];
  const id = genId();
  pendingDownloads.set(id, { url, userId: ctx.from.id, platform, ts: Date.now() });

  await ctx.reply(
    `${info.emoji} *${info.name}* شناسایی شد\n\nچه فرمتی می‌خواید؟`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('🎬 ویدیو', `dl:v:${id}`),
          Markup.button.callback('🎵 صدا MP3', `dl:a:${id}`),
        ],
      ]),
    }
  );
}

// Callback: dl:v:ID  or  dl:a:ID
async function downloadCallback(ctx) {
  const data = ctx.callbackQuery.data; // dl:v:XXXXXXX
  const parts = data.split(':');
  const mode = parts[1];    // 'v' or 'a'
  const id   = parts[2];

  const pending = pendingDownloads.get(id);
  if (!pending) {
    return ctx.answerCbQuery('⏰ درخواست منقضی شد. لینک را دوباره بفرست.');
  }

  // Only the same user can trigger it
  if (pending.userId !== ctx.from.id) {
    return ctx.answerCbQuery('⛔ این درخواست برای شما نیست.');
  }

  pendingDownloads.delete(id);
  const audioOnly = mode === 'a';
  const info = PLATFORM_INFO[pending.platform] || { emoji: '📥', name: pending.platform };

  await ctx.answerCbQuery('⏳ در حال دانلود...');
  await ctx.editMessageText(`${info.emoji} در حال دریافت از ${info.name}...`);

  const tmpFile = path.join(os.tmpdir(), `dl_${ctx.from.id}_${Date.now()}.${audioOnly ? 'mp3' : 'mp4'}`);

  try {
    const result = await callCobalt(pending.url, audioOnly);

    if (result.status === 'error') {
      const msg = result.error?.code || result.error || 'خطای ناشناخته';
      await ctx.editMessageText(`❌ خطا: ${msg}`);
      return;
    }

    // Get direct download URL
    let downloadUrl = null;
    if (result.status === 'redirect' || result.status === 'tunnel') {
      downloadUrl = result.url;
    } else if (result.status === 'picker' && result.picker?.length) {
      // For multi-item (e.g. Twitter carousel), pick the first
      downloadUrl = result.picker[0].url;
    }

    if (!downloadUrl) {
      await ctx.editMessageText('❌ لینک دانلود دریافت نشد.');
      return;
    }

    await ctx.editMessageText(`${info.emoji} در حال دانلود فایل...`);
    await downloadFile(downloadUrl, tmpFile);

    const stat = fs.statSync(tmpFile);
    const sizeMB = stat.size / 1024 / 1024;

    if (sizeMB > MAX_SIZE_MB) {
      fs.unlinkSync(tmpFile);
      await ctx.editMessageText(
        `❌ فایل ${sizeMB.toFixed(1)} MB است — بیشتر از حد مجاز تلگرام (${MAX_SIZE_MB} MB).\n\n` +
        `🔗 لینک مستقیم: ${downloadUrl}`
      );
      return;
    }

    await ctx.editMessageText('📤 در حال آپلود...');
    const filename = (result.filename || `download_${Date.now()}.${audioOnly ? 'mp3' : 'mp4'}`).slice(0, 60);

    if (audioOnly) {
      await ctx.replyWithAudio(
        { source: tmpFile, filename },
        { caption: `🎵 ${info.name}`, title: filename }
      );
    } else {
      await ctx.replyWithVideo(
        { source: tmpFile, filename },
        { caption: `${info.emoji} ${info.name}` }
      );
    }

    await ctx.deleteMessage().catch(() => {});
  } catch (e) {
    console.error('[Downloader] error:', e.message);
    await ctx.editMessageText(`❌ خطا: ${e.message.slice(0, 200)}`).catch(() => {});
  } finally {
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch {}
  }
}

// Download and send to a channel — used by API
async function downloadToChannel(bot, mediaUrl, channelId, audioOnly = false) {
  const tmpFile = path.join(os.tmpdir(), `ch_${Date.now()}.${audioOnly ? 'mp3' : 'mp4'}`);
  try {
    const result = await callCobalt(mediaUrl, audioOnly);
    if (result.status === 'error') throw new Error(result.error?.code || 'cobalt error');

    let downloadUrl = null;
    if (result.status === 'redirect' || result.status === 'tunnel') {
      downloadUrl = result.url;
    } else if (result.status === 'picker' && result.picker?.length) {
      downloadUrl = result.picker[0].url;
    }
    if (!downloadUrl) throw new Error('No download URL received');

    await downloadFile(downloadUrl, tmpFile);
    const stat = fs.statSync(tmpFile);
    if (stat.size > MAX_SIZE_MB * 1024 * 1024) throw new Error(`File too large: ${(stat.size/1024/1024).toFixed(1)} MB`);

    const platform = detectPlatform(mediaUrl) || 'media';
    const info = PLATFORM_INFO[platform] || { emoji: '📥', name: platform };
    const filename = (result.filename || `download.${audioOnly ? 'mp3' : 'mp4'}`).slice(0, 60);

    if (audioOnly) {
      await bot.telegram.sendAudio(String(channelId), { source: tmpFile, filename }, {
        caption: `🎵 ${info.name}`,
        title: filename,
      });
    } else {
      await bot.telegram.sendVideo(String(channelId), { source: tmpFile, filename }, {
        caption: `${info.emoji} ${info.name}`,
      });
    }

    return { ok: true, filename };
  } finally {
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch {}
  }
}

// Download and send to a user's DM — used by API
async function downloadToUser(bot, mediaUrl, userId, audioOnly = false) {
  const tmpFile = path.join(os.tmpdir(), `usr_${userId}_${Date.now()}.${audioOnly ? 'mp3' : 'mp4'}`);
  try {
    const result = await callCobalt(mediaUrl, audioOnly);
    if (result.status === 'error') throw new Error(result.error?.code || 'cobalt error');

    let downloadUrl = null;
    if (result.status === 'redirect' || result.status === 'tunnel') {
      downloadUrl = result.url;
    } else if (result.status === 'picker' && result.picker?.length) {
      downloadUrl = result.picker[0].url;
    }
    if (!downloadUrl) throw new Error('No download URL received');

    await downloadFile(downloadUrl, tmpFile);
    const stat = fs.statSync(tmpFile);
    if (stat.size > MAX_SIZE_MB * 1024 * 1024) throw new Error(`File too large: ${(stat.size/1024/1024).toFixed(1)} MB`);

    const platform = detectPlatform(mediaUrl) || 'media';
    const info = PLATFORM_INFO[platform] || { emoji: '📥', name: platform };
    const filename = (result.filename || `download.${audioOnly ? 'mp3' : 'mp4'}`).slice(0, 60);

    if (audioOnly) {
      await bot.telegram.sendAudio(String(userId), { source: tmpFile, filename }, {
        caption: `🎵 ${info.name} — از Mini App`,
        title: filename,
      });
    } else {
      await bot.telegram.sendVideo(String(userId), { source: tmpFile, filename }, {
        caption: `${info.emoji} ${info.name} — از Mini App`,
      });
    }

    return { ok: true, filename };
  } finally {
    try { if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile); } catch {}
  }
}

module.exports = {
  detectPlatform,
  PLATFORM_INFO,
  handleMediaLink,
  downloadCallback,
  downloadToChannel,
  downloadToUser,
  callCobalt,
  pendingDownloads,
  genId,
};
