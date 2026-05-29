const { Markup } = require('telegraf');
const Settings = require('../../../database/models/Settings');

// In-memory captcha store: { userId: { answer, chatId, messageId, expires } }
const captchaStore = new Map();

function generateMath() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const ops = ['+', '-', '*'];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let answer;
  if (op === '+') answer = a + b;
  else if (op === '-') answer = a - b;
  else answer = a * b;
  return { question: `${a} ${op} ${b} = ?`, answer };
}

function buildCaptchaKeyboard(correctAnswer, userId) {
  const options = new Set([correctAnswer]);
  while (options.size < 4) {
    options.add(correctAnswer + Math.floor(Math.random() * 10) - 5);
  }
  const shuffled = [...options].sort(() => Math.random() - 0.5);
  return Markup.inlineKeyboard(
    shuffled.map(opt =>
      Markup.button.callback(String(opt), `captcha:${userId}:${opt}`)
    ),
    { columns: 2 }
  );
}

async function joinRequestHandler(ctx) {
  const settings = await Settings.getSettings().catch(() => null);
  if (!settings || !settings.captchaEnabled) {
    await ctx.approveChatJoinRequest(ctx.chatJoinRequest.from.id).catch(() => {});
    return;
  }

  const user = ctx.chatJoinRequest.from;
  const chatId = ctx.chatJoinRequest.chat.id;
  const { question, answer } = generateMath();

  try {
    const msg = await ctx.telegram.sendMessage(
      user.id,
      `👋 سلام <b>${user.first_name}</b>!\n\nبرای ورود به گروه، جواب این سوال را بزن:\n\n🔢 <b>${question}</b>`,
      {
        parse_mode: 'HTML',
        ...buildCaptchaKeyboard(answer, user.id),
      }
    );

    captchaStore.set(user.id, {
      answer,
      chatId,
      messageId: msg.message_id,
      expires: Date.now() + 5 * 60 * 1000,
    });

    // auto-decline after 5 minutes
    setTimeout(async () => {
      if (captchaStore.has(user.id)) {
        captchaStore.delete(user.id);
        await ctx.telegram.declineChatJoinRequest(chatId, user.id).catch(() => {});
        await ctx.telegram.sendMessage(user.id, '⏰ وقت کپچا تموم شد. دوباره درخواست ورود بده.').catch(() => {});
      }
    }, 5 * 60 * 1000);
  } catch {
    // user has private DMs — approve anyway
    await ctx.approveChatJoinRequest(user.id).catch(() => {});
  }
}

async function captchaCallbackHandler(ctx) {
  const [, userIdStr, answerStr] = ctx.callbackQuery.data.split(':');
  const userId = parseInt(userIdStr);
  const givenAnswer = parseInt(answerStr);

  if (ctx.from.id !== userId) return ctx.answerCbQuery('این کپچا مال تو نیست!');

  const entry = captchaStore.get(userId);
  if (!entry) return ctx.answerCbQuery('این کپچا منقضی شده.');
  if (Date.now() > entry.expires) {
    captchaStore.delete(userId);
    return ctx.answerCbQuery('⏰ وقت تموم شد.');
  }

  if (givenAnswer === entry.answer) {
    captchaStore.delete(userId);
    await ctx.telegram.approveChatJoinRequest(entry.chatId, userId).catch(() => {});
    await ctx.editMessageText('✅ درست بود! به گروه خوش آمدی.').catch(() => {});
    await ctx.answerCbQuery('✅ درست!');
  } else {
    await ctx.answerCbQuery('❌ اشتباه. دوباره تلاش کن.');
  }
}

module.exports = { joinRequestHandler, captchaCallbackHandler };
