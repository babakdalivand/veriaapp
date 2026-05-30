const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const { Markup } = require('telegraf');

const MAX_SIZE_MB = 45;
const PYTHON_BIN = process.env.PYTHON_BIN || '/usr/bin/python3';

// Short-lived store: id -> { url, userId, platform }
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
    if (/youtube\.com|youtu\.be/.test(u))      return 'youtube';
    if (/instagram\.com/.test(u))              return 'instagram';
    if (/twitter\.com|x\.com/.test(u))         return 'twitter';
    if (/tiktok\.com|vm\.tiktok\.com/.test(u)) return 'tiktok';
    if (/soundcloud\.com/.test(u))             return 'soundcloud';
    if (/vimeo\.com/.test(u))                  return 'vimeo';
    if (/dailymotion\.com|dai\.ly/.test(u))    return 'dailymotion';
    if (/pinterest\.com|pin\.it/.test(u))      return 'pinterest';
  } catch {}
  return null;
}

function extractFirstUrl(text) {
  const m = text.match(/https?:\/\/[^\s]+/);
  return m ? m[0] : null;
}

// Download via yt-dlp (python3 -m yt_dlp)
function ytdlpDownload(mediaUrl, destDir, audioOnly = false) {
  return new Promise((resolve, reject) => {
    const outTemplate = path.join(destDir, '%(id)s.%(ext)s');
    const format = audioOnly
      ? 'bestaudio[ext=mp3]/bestaudio/best'
      : `bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][filesize<${MAX_SIZE_MB}M]/best[filesize<${MAX_SIZE_MB}M]/best`;

    const args = [
      '-m', 'yt_dlp',
      '--no-playlist',
      '--max-filesize', `${MAX_SIZE_MB}M`,
      '-f', format,
      '--merge-output-format', audioOnly ? 'mp3' : 'mp4',
      '-o', outTemplate,
      '--no-warnings',
      '--print', 'after_move:filepath',
      mediaUrl,
    ];

    let output = '';
    let errOutput = '';

    const proc = spawn(PYTHON_BIN, args, { timeout: 120000 });

    proc.stdout.on('data', d => { output += d.toString(); });
    proc.stderr.on('data', d => { errOutput += d.toString(); });

    proc.on('close', (code) => {
      const filePath = output.trim().split('\n').pop();
      if (code === 0 && filePath && fs.existsSync(filePath)) {
        resolve(filePath);
      } else {
        const msg = errOutput.slice(-300) || `exit code ${code}`;
        reject(new Error(msg));
      }
    });

    proc.on('error', (e) => reject(new Error(`yt-dlp spawn failed: ${e.message}`)));
  });
}

// Main handler: detect URL in message and offer download
async function handleMediaLink(ctx) {
  const text = ctx.message?.text?.trim();
  if (!text) return;

  const url = extractFirstUrl(text);
  if (!url) return;

  const platform = detectPlatform(url);
  if (!platform) return;

  // YouTube is handled by the dedicated youtube.js handler
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
  const data = ctx.callbackQuery.data;
  const parts = data.split(':');
  const mode = parts[1];
  const id   = parts[2];

  const pending = pendingDownloads.get(id);
  if (!pending) {
    return ctx.answerCbQuery('⏰ درخواست منقضی شد. لینک را دوباره بفرست.');
  }

  if (pending.userId !== ctx.from.id) {
    return ctx.answerCbQuery('⛔ این درخواست برای شما نیست.');
  }

  pendingDownloads.delete(id);
  const audioOnly = mode === 'a';
  const info = PLATFORM_INFO[pending.platform] || { emoji: '📥', name: pending.platform };

  await ctx.answerCbQuery('⏳ در حال دانلود...');
  await ctx.editMessageText(`${info.emoji} در حال دریافت از ${info.name}...`);

  const tmpDir = os.tmpdir();
  let filePath = null;

  try {
    filePath = await ytdlpDownload(pending.url, tmpDir, audioOnly);

    const stat = fs.statSync(filePath);
    const sizeMB = stat.size / 1024 / 1024;

    if (sizeMB > MAX_SIZE_MB) {
      fs.unlinkSync(filePath);
      return ctx.editMessageText(`❌ فایل ${sizeMB.toFixed(1)} MB است — بیشتر از حد مجاز تلگرام (${MAX_SIZE_MB} MB).`);
    }

    await ctx.editMessageText('📤 در حال آپلود...');
    const filename = path.basename(filePath);

    if (audioOnly) {
      await ctx.replyWithAudio(
        { source: filePath, filename },
        { caption: `🎵 ${info.name}`, title: filename }
      );
    } else {
      await ctx.replyWithVideo(
        { source: filePath, filename },
        { caption: `${info.emoji} ${info.name}` }
      );
    }

    await ctx.deleteMessage().catch(() => {});
  } catch (e) {
    console.error('[Downloader] yt-dlp error:', e.message.slice(0, 200));
    const userMsg = e.message.includes('Unsupported URL')
      ? '❌ این لینک پشتیبانی نمی‌شود.'
      : e.message.includes('Private')
      ? '❌ این محتوا خصوصی است و قابل دانلود نیست.'
      : `❌ خطا در دانلود: ${e.message.slice(0, 120)}`;
    await ctx.editMessageText(userMsg).catch(() => {});
  } finally {
    if (filePath) try { fs.unlinkSync(filePath); } catch {}
  }
}

// Download and send to a channel — used by API
async function downloadToChannel(bot, mediaUrl, channelId, audioOnly = false) {
  const tmpDir = os.tmpdir();
  let filePath = null;
  try {
    filePath = await ytdlpDownload(mediaUrl, tmpDir, audioOnly);
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_SIZE_MB * 1024 * 1024) throw new Error(`File too large: ${(stat.size/1024/1024).toFixed(1)} MB`);

    const platform = detectPlatform(mediaUrl) || 'media';
    const info = PLATFORM_INFO[platform] || { emoji: '📥', name: platform };
    const filename = path.basename(filePath);

    if (audioOnly) {
      await bot.telegram.sendAudio(String(channelId), { source: filePath, filename }, {
        caption: `🎵 ${info.name}`,
        title: filename,
      });
    } else {
      await bot.telegram.sendVideo(String(channelId), { source: filePath, filename }, {
        caption: `${info.emoji} ${info.name}`,
      });
    }
    return { ok: true, filename };
  } finally {
    if (filePath) try { fs.unlinkSync(filePath); } catch {}
  }
}

// Download and send to a user's DM — used by API
async function downloadToUser(bot, mediaUrl, userId, audioOnly = false) {
  const tmpDir = os.tmpdir();
  let filePath = null;
  try {
    filePath = await ytdlpDownload(mediaUrl, tmpDir, audioOnly);
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_SIZE_MB * 1024 * 1024) throw new Error(`File too large: ${(stat.size/1024/1024).toFixed(1)} MB`);

    const platform = detectPlatform(mediaUrl) || 'media';
    const info = PLATFORM_INFO[platform] || { emoji: '📥', name: platform };
    const filename = path.basename(filePath);

    if (audioOnly) {
      await bot.telegram.sendAudio(String(userId), { source: filePath, filename }, {
        caption: `🎵 ${info.name} — از Mini App`,
        title: filename,
      });
    } else {
      await bot.telegram.sendVideo(String(userId), { source: filePath, filename }, {
        caption: `${info.emoji} ${info.name} — از Mini App`,
      });
    }
    return { ok: true, filename };
  } finally {
    if (filePath) try { fs.unlinkSync(filePath); } catch {}
  }
}

module.exports = {
  detectPlatform,
  PLATFORM_INFO,
  handleMediaLink,
  downloadCallback,
  downloadToChannel,
  downloadToUser,
  pendingDownloads,
  genId,
};
