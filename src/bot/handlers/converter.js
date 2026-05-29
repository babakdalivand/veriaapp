const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { Markup } = require('telegraf');
const { BOT_TOKEN } = require('../../config');

const FFMPEG_CANDIDATES = [
  'ffmpeg',
  '/usr/bin/ffmpeg',
  '/usr/local/bin/ffmpeg',
  '/opt/ffmpeg/bin/ffmpeg',
];

let _ffmpegPath = null;
let _checked = false;

async function findFfmpeg() {
  if (_checked) return _ffmpegPath;
  _checked = true;
  for (const candidate of FFMPEG_CANDIDATES) {
    const found = await new Promise((resolve) => {
      exec(`"${candidate}" -version`, { timeout: 5000 }, (err) => resolve(!err));
    });
    if (found) { _ffmpegPath = candidate; break; }
  }
  console.log(_ffmpegPath ? `[Converter] ffmpeg found: ${_ffmpegPath}` : '[Converter] ffmpeg not available');
  return _ffmpegPath;
}

// Map: userId → { fileId, fileName, sizeMB, ts }
const pendingConversions = new Map();
setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [k, v] of pendingConversions) {
    if (v.ts < cutoff) pendingConversions.delete(k);
  }
}, 5 * 60 * 1000);

async function handleVideoMessage(ctx) {
  const ffmpeg = await findFfmpeg();
  if (!ffmpeg) return; // ffmpeg موجود نیست — بی‌صدا رد می‌شود

  const video = ctx.message?.video;
  const doc = ctx.message?.document;
  if (!video && !(doc?.mime_type?.startsWith('video/'))) return;

  const file = video || doc;
  const sizeMB = file.file_size ? file.file_size / 1024 / 1024 : 0;
  if (sizeMB > 45) {
    return ctx.reply('❌ فایل بیش از ۴۵ MB است — تبدیل پشتیبانی نمی‌شود.');
  }

  const name = doc?.file_name || 'video.mp4';
  pendingConversions.set(ctx.from.id, { fileId: file.file_id, fileName: name, sizeMB: sizeMB.toFixed(1), ts: Date.now() });

  await ctx.reply(
    `🎬 *فایل ویدیو شناسایی شد*\n\n` +
    `📄 ${name}\n` +
    `📦 ${sizeMB.toFixed(1)} MB\n\n` +
    `آیا می‌خواید به صوت MP3 تبدیل شود؟`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('🎵 بله، تبدیل کن', `conv:yes:${ctx.from.id}`),
          Markup.button.callback('❌ خیر', `conv:no:${ctx.from.id}`),
        ],
      ]),
    }
  );
}

function downloadTgFile(fileUrl, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(fileUrl, { timeout: 60000 }, (res) => {
      if (res.statusCode !== 200) {
        file.close();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    }).on('error', reject);
  });
}

async function conversionCallback(ctx) {
  const data = ctx.callbackQuery.data; // conv:yes:USER_ID | conv:no:USER_ID
  const parts = data.split(':');
  const action = parts[1];
  const ownerId = parseInt(parts[2]);

  if (ownerId !== ctx.from.id) {
    return ctx.answerCbQuery('⛔ این درخواست برای شما نیست.');
  }

  if (action === 'no') {
    pendingConversions.delete(ownerId);
    await ctx.answerCbQuery();
    return ctx.editMessageText('❌ تبدیل لغو شد.');
  }

  const pending = pendingConversions.get(ownerId);
  if (!pending) {
    await ctx.answerCbQuery();
    return ctx.editMessageText('⏰ درخواست منقضی شد. فایل را دوباره بفرست.');
  }

  pendingConversions.delete(ownerId);
  await ctx.answerCbQuery('⏳ در حال تبدیل...');
  await ctx.editMessageText('⏳ در حال دانلود فایل از تلگرام...');

  const tmpVideo = path.join(os.tmpdir(), `conv_in_${ownerId}_${Date.now()}.mp4`);
  const tmpAudio = path.join(os.tmpdir(), `conv_out_${ownerId}_${Date.now()}.mp3`);

  try {
    const fileInfo = await ctx.telegram.getFile(pending.fileId);
    const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.file_path}`;
    await downloadTgFile(fileUrl, tmpVideo);

    await ctx.editMessageText('🔄 در حال تبدیل به MP3...');

    const ffmpeg = await findFfmpeg();
    await new Promise((resolve, reject) => {
      exec(
        `"${ffmpeg}" -i "${tmpVideo}" -vn -acodec libmp3lame -ab 192k -ar 44100 -y "${tmpAudio}"`,
        { timeout: 120000 },
        (err, _stdout, stderr) => {
          if (err) reject(new Error(stderr?.slice(-200) || err.message));
          else resolve();
        }
      );
    });

    const stat = fs.statSync(tmpAudio);
    if (stat.size === 0) throw new Error('تبدیل ناموفق بود — فایل صوتی خالی است.');

    await ctx.editMessageText('📤 در حال آپلود...');
    const baseName = pending.fileName.replace(/\.[^.]+$/, '');
    await ctx.replyWithAudio(
      { source: tmpAudio, filename: baseName + '.mp3' },
      { caption: `🎵 ${baseName}`, title: baseName }
    );
    await ctx.deleteMessage().catch(() => {});
  } catch (e) {
    console.error('[Converter] error:', e.message);
    await ctx.editMessageText(`❌ خطا در تبدیل: ${e.message.slice(0, 150)}`).catch(() => {});
  } finally {
    try { if (fs.existsSync(tmpVideo)) fs.unlinkSync(tmpVideo); } catch {}
    try { if (fs.existsSync(tmpAudio)) fs.unlinkSync(tmpAudio); } catch {}
  }
}

module.exports = { handleVideoMessage, conversionCallback, findFfmpeg };
