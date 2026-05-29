const { Markup } = require('telegraf');
const ytdl = require('@distube/ytdl-core');
const fs = require('fs');
const path = require('path');
const os = require('os');

// In-memory state: userId -> 'waiting_url'
const userState = new Map();

const MAX_SIZE_MB = 45;

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatSize(bytes) {
  if (!bytes) return '?';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
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

  if (!ytdl.validateURL(text)) {
    return ctx.reply('❌ لینک معتبر یوتیوب نیست. دوباره امتحان کن یا ❌ انصراف بزن.');
  }

  userState.delete(userId);

  const loadingMsg = await ctx.reply('⏳ در حال دریافت اطلاعات ویدیو...');

  try {
    const info = await ytdl.getInfo(text);
    const details = info.videoDetails;
    const duration = parseInt(details.lengthSeconds);

    if (duration > 600) {
      await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null,
        '❌ ویدیوهای بیشتر از ۱۰ دقیقه پشتیبانی نمی‌شن.');
      return;
    }

    // Find best audio format
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
    const audioFormat = audioFormats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];

    // Find video formats (with audio)
    const videoFormats = ytdl.filterFormats(info.formats, 'videoandaudio')
      .filter(f => f.container === 'mp4')
      .sort((a, b) => (b.height || 0) - (a.height || 0));

    const video360 = videoFormats.find(f => f.height <= 360);
    const video720 = videoFormats.find(f => f.height <= 720);

    const buttons = [];
    if (audioFormat) {
      buttons.push(Markup.button.callback(
        `🎵 صدا (${audioFormat.audioBitrate || '?'}kbps)`,
        `yt:audio:${encodeURIComponent(text)}`
      ));
    }
    if (video360) {
      buttons.push(Markup.button.callback(
        `🎬 ویدیو 360p`,
        `yt:video360:${encodeURIComponent(text)}`
      ));
    }
    if (video720) {
      buttons.push(Markup.button.callback(
        `🎬 ویدیو 720p`,
        `yt:video720:${encodeURIComponent(text)}`
      ));
    }

    const thumb = details.thumbnails?.[details.thumbnails.length - 1]?.url || '';

    await ctx.telegram.editMessageText(
      ctx.chat.id, loadingMsg.message_id, null,
      `🎬 *${details.title.slice(0, 100)}*\n\n` +
      `⏱ مدت: ${formatDuration(duration)}\n` +
      `👁 بازدید: ${parseInt(details.viewCount).toLocaleString()}\n\n` +
      `فرمت دلخواه را انتخاب کن:`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons.map(b => [b]))
      }
    );
  } catch (e) {
    await ctx.telegram.editMessageText(ctx.chat.id, loadingMsg.message_id, null,
      `❌ خطا در دریافت اطلاعات: ${e.message.slice(0, 100)}`);
  }
}

async function youtubeDownloadCallback(ctx) {
  const data = ctx.callbackQuery.data; // yt:audio:URL or yt:video360:URL or yt:video720:URL
  const parts = data.split(':');
  const type = parts[1];
  const url = decodeURIComponent(parts.slice(2).join(':'));

  await ctx.answerCbQuery('⏳ در حال دانلود...');
  await ctx.editMessageText('⏳ در حال دانلود... لطفاً صبر کن.');

  const tmpFile = path.join(os.tmpdir(), `yt_${ctx.from.id}_${Date.now()}.${type === 'audio' ? 'mp3' : 'mp4'}`);

  try {
    const info = await ytdl.getInfo(url);
    const title = info.videoDetails.title.replace(/[^\w\s؀-ۿ]/g, '').trim().slice(0, 60);

    let format;
    if (type === 'audio') {
      const formats = ytdl.filterFormats(info.formats, 'audioonly');
      format = formats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];
    } else if (type === 'video360') {
      const formats = ytdl.filterFormats(info.formats, 'videoandaudio').filter(f => f.container === 'mp4');
      format = formats.filter(f => f.height <= 360).sort((a, b) => (b.height || 0) - (a.height || 0))[0];
    } else {
      const formats = ytdl.filterFormats(info.formats, 'videoandaudio').filter(f => f.container === 'mp4');
      format = formats.filter(f => f.height <= 720).sort((a, b) => (b.height || 0) - (a.height || 0))[0];
    }

    if (!format) {
      return ctx.editMessageText('❌ فرمت مورد نظر پیدا نشد.');
    }

    if (format.contentLength && parseInt(format.contentLength) > MAX_SIZE_MB * 1024 * 1024) {
      return ctx.editMessageText(`❌ فایل بیشتر از ${MAX_SIZE_MB}MB است و قابل ارسال نیست.`);
    }

    await new Promise((resolve, reject) => {
      const stream = ytdl.downloadFromInfo(info, { format });
      const file = fs.createWriteStream(tmpFile);
      stream.pipe(file);
      stream.on('error', reject);
      file.on('finish', resolve);
      file.on('error', reject);
    });

    const stat = fs.statSync(tmpFile);
    if (stat.size > MAX_SIZE_MB * 1024 * 1024) {
      fs.unlinkSync(tmpFile);
      return ctx.editMessageText(`❌ فایل دانلودشده ${formatSize(stat.size)} است — بیشتر از حد مجاز تلگرام.`);
    }

    await ctx.editMessageText('📤 در حال آپلود...');

    if (type === 'audio') {
      await ctx.replyWithAudio({ source: tmpFile, filename: title + '.mp3' }, { title, caption: `🎵 ${title}` });
    } else {
      await ctx.replyWithVideo({ source: tmpFile, filename: title + '.mp4' }, { caption: `🎬 ${title}` });
    }

    await ctx.deleteMessage().catch(() => {});
  } catch (e) {
    await ctx.editMessageText(`❌ خطا: ${e.message.slice(0, 150)}`).catch(() => {});
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}

module.exports = { youtubeMenuHandler, handleYoutubeUrl, youtubeDownloadCallback, userState };
