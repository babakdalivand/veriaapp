const { Markup } = require('telegraf');
const Settings = require('../../database/models/Settings');
const { isAdmin } = require('../middleware/auth');

// Conversation state for waiting on text input
const settingsState = new Map(); // userId -> { action }

function isWaitingSettings(userId) {
  return settingsState.has(userId);
}

function buildSettingsMenu(settings) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📝 پیام خوش‌آمدگویی', 'cfg:welcome')],
    [
      Markup.button.callback(
        `${settings.botEnabled ? '🟢 بات: فعال' : '🔴 بات: غیرفعال'}`,
        'cfg:toggle:bot'
      ),
    ],
    [Markup.button.callback('🔤 مدیریت کلمات ممنوعه', 'cfg:keywords')],
    [Markup.button.callback('📢 تنظیم کانال اصلی', 'cfg:setchannel')],
    [Markup.button.callback('💬 تنظیم گروه اصلی', 'cfg:setgroup')],
    [Markup.button.callback('🤖 دستورات slash بات', 'cfg:commands')],
  ]);
}

async function settingsHandler(ctx) {
  if (!(await isAdmin(ctx))) return ctx.reply('⛔️ دسترسی ندارید.');
  const settings = await Settings.getSettings();
  const channel = settings.mainChannelId ? `📢 کانال: \`${settings.mainChannelId}\`` : '📢 کانال: تنظیم نشده';
  const groups = parseGroupIds(settings.groupIds);
  const groupText = groups.length
    ? groups.map(g => `\`${g}\``).join(' ،‌ ')
    : 'تنظیم نشده';

  return ctx.reply(
    `⚙️ *پنل تنظیمات بات*\n\n${channel}\n💬 گروه‌ها: ${groupText}`,
    { parse_mode: 'Markdown', ...buildSettingsMenu(settings) }
  );
}

async function settingsCallback(ctx) {
  if (!(await isAdmin(ctx))) return ctx.answerCbQuery('⛔️ دسترسی ندارید.');
  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id;

  await ctx.answerCbQuery();
  const settings = await Settings.getSettings();

  if (data === 'cfg:toggle:bot') {
    settings.botEnabled = !settings.botEnabled;
    await settings.save();
    await ctx.editMessageReplyMarkup(buildSettingsMenu(settings).reply_markup).catch(() => {});
    return ctx.reply(settings.botEnabled ? '🟢 بات فعال شد.' : '🔴 بات غیرفعال شد.');
  }

  if (data === 'cfg:welcome') {
    settingsState.set(userId, { action: 'welcome' });
    return ctx.reply(
      `📝 *پیام خوش‌آمدگویی فعلی:*\n\n${settings.welcomeMessage}\n\n` +
      `پیام جدید را بنویسید یا /cancel بزنید:`,
      { parse_mode: 'Markdown' }
    );
  }

  if (data === 'cfg:setchannel') {
    settingsState.set(userId, { action: 'channel' });
    return ctx.reply(
      '📢 آیدی کانال را وارد کنید:\n`@channel_username` یا `-100xxxxxxxxxx`\n\n/cancel برای لغو',
      { parse_mode: 'Markdown' }
    );
  }

  if (data === 'cfg:setgroup') {
    const groups = parseGroupIds(settings.groupIds);
    return showGroupsMenu(ctx, groups);
  }

  if (data === 'cfg:grp:add') {
    settingsState.set(userId, { action: 'group_add' });
    return ctx.reply(
      '💬 آیدی گروه را وارد کنید:\n`@group_username` یا `-100xxxxxxxxxx`\n\n/cancel برای لغو',
      { parse_mode: 'Markdown' }
    );
  }

  if (data.startsWith('cfg:grp:del:')) {
    const id = decodeURIComponent(data.slice('cfg:grp:del:'.length));
    const groups = parseGroupIds(settings.groupIds).filter(g => g !== id);
    settings.groupIds = groups.join(',');
    await settings.save();
    return showGroupsMenu(ctx, groups, true);
  }

  if (data === 'cfg:keywords') {
    return showKeywordsMenu(ctx, settings);
  }

  if (data === 'cfg:kw:add') {
    settingsState.set(userId, { action: 'kw_add' });
    return ctx.reply('🔤 کلمه یا عبارت ممنوعه را بنویسید:\n/cancel برای لغو');
  }

  if (data.startsWith('cfg:kw:del:')) {
    const word = decodeURIComponent(data.slice('cfg:kw:del:'.length));
    const keywords = parseKeywords(settings.keywords).filter(k => k !== word);
    settings.keywords = keywords.join(',');
    await settings.save();
    return showKeywordsMenu(ctx, settings, true);
  }

  if (data === 'cfg:commands') {
    const BotCommand = require('../../database/models/BotCommand');
    const cmds = await BotCommand.findAll({ order: [['command', 'ASC']] });
    const list = cmds.length
      ? cmds.map(c => `/${c.command} — ${c.description}`).join('\n')
      : 'هنوز دستور سفارشی اضافه نشده';
    return ctx.reply(
      `🤖 *دستورات slash بات*\n\n${list}\n\nبرای مدیریت کامل از پنل ادمین Mini App استفاده کنید.\n\n📱 /miniapp`,
      { parse_mode: 'Markdown' }
    );
  }
}

async function showKeywordsMenu(ctx, settings, edit = false) {
  const keywords = parseKeywords(settings.keywords);
  const list = keywords.length
    ? keywords.map((k, i) => `${i + 1}. \`${k}\``).join('\n')
    : '_هنوز کلمه‌ای ثبت نشده_';

  const rows = [];
  for (let i = 0; i < keywords.length; i += 2) {
    const row = [Markup.button.callback(`❌ ${keywords[i]}`, `cfg:kw:del:${encodeURIComponent(keywords[i])}`)];
    if (keywords[i + 1]) row.push(Markup.button.callback(`❌ ${keywords[i + 1]}`, `cfg:kw:del:${encodeURIComponent(keywords[i + 1])}`));
    rows.push(row);
  }
  rows.push([Markup.button.callback('➕ افزودن کلمه جدید', 'cfg:kw:add')]);

  const text = `🔤 *کلمات ممنوعه* (${keywords.length})\n\n${list}`;
  const opts = { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) };

  if (edit) {
    return ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts));
  }
  return ctx.reply(text, opts);
}

function parseKeywords(raw) {
  if (!raw) return [];
  return raw.split(',').map(k => k.trim()).filter(Boolean);
}

function parseGroupIds(raw) {
  if (!raw) return [];
  return raw.split(',').map(g => g.trim()).filter(Boolean);
}

async function showGroupsMenu(ctx, groups, edit = false) {
  const list = groups.length
    ? groups.map((g, i) => `${i + 1}. \`${g}\``).join('\n')
    : '_هنوز گروهی تنظیم نشده_';

  const rows = [];
  for (let i = 0; i < groups.length; i += 2) {
    const row = [Markup.button.callback(`❌ ${groups[i]}`, `cfg:grp:del:${encodeURIComponent(groups[i])}`)];
    if (groups[i + 1]) row.push(Markup.button.callback(`❌ ${groups[i + 1]}`, `cfg:grp:del:${encodeURIComponent(groups[i + 1])}`));
    rows.push(row);
  }
  rows.push([Markup.button.callback('➕ افزودن گروه', 'cfg:grp:add')]);

  const text = `💬 *گروه‌های بات* (${groups.length})\n\n${list}`;
  const opts = { parse_mode: 'Markdown', ...Markup.inlineKeyboard(rows) };

  if (edit) {
    return ctx.editMessageText(text, opts).catch(() => ctx.reply(text, opts));
  }
  return ctx.reply(text, opts);
}

async function handleSettingsInput(ctx) {
  const userId = ctx.from.id;
  const state = settingsState.get(userId);
  if (!state) return false;

  const text = ctx.message.text;

  if (text === '/cancel') {
    settingsState.delete(userId);
    await ctx.reply('❌ لغو شد.');
    return true;
  }

  const settings = await Settings.getSettings();

  if (state.action === 'welcome') {
    settings.welcomeMessage = text;
    await settings.save();
    settingsState.delete(userId);
    await ctx.reply(`✅ پیام خوش‌آمدگویی به‌روز شد.`);
    return true;
  }

  if (state.action === 'channel') {
    const val = text.trim();
    settings.mainChannelId = val.startsWith('@') ? val : (parseInt(val) || val);
    await settings.save();
    settingsState.delete(userId);
    await ctx.reply(`✅ کانال اصلی تنظیم شد: \`${val}\``, { parse_mode: 'Markdown' });
    return true;
  }

  if (state.action === 'group_add') {
    const val = text.trim();
    const groups = parseGroupIds(settings.groupIds);
    if (val && !groups.includes(val)) {
      groups.push(val);
      settings.groupIds = groups.join(',');
      settings.mainGroupId = groups[0];
      await settings.save();
    }
    settingsState.delete(userId);
    await ctx.reply(`✅ گروه اضافه شد: \`${val}\`\nمجموع: ${groups.length} گروه`, { parse_mode: 'Markdown' });
    return true;
  }

  if (state.action === 'kw_add') {
    const keywords = parseKeywords(settings.keywords);
    const newKw = text.trim().toLowerCase();
    if (newKw && !keywords.includes(newKw)) {
      keywords.push(newKw);
      settings.keywords = keywords.join(',');
      await settings.save();
    }
    settingsState.delete(userId);
    await ctx.reply(`✅ کلمه ممنوعه اضافه شد: \`${newKw}\`\nمجموع: ${keywords.length} کلمه`, { parse_mode: 'Markdown' });
    return true;
  }

  return false;
}

module.exports = { settingsHandler, settingsCallback, handleSettingsInput, isWaitingSettings };
