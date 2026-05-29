const { Markup } = require('telegraf');
const Anthropic = require('@anthropic-ai/sdk');
const { ANTHROPIC_API_KEY } = require('../../config');

const client = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

// In-memory state: userId -> 'waiting_ai'
const userState = new Map();
// Conversation history: userId -> [{role, content}]
const userHistory = new Map();

const SYSTEM_PROMPT = `تو یک دستیار هوشمند فارسی‌زبان هستی که به کاربران ایرانی کمک می‌کنی.
پاسخ‌هایت را به فارسی روان و کوتاه بده.
اگر سوال به زبان انگلیسی بود، به انگلیسی جواب بده.
پاسخ‌ها را مختصر و مفید نگه دار.`;

async function aiMenuHandler(ctx) {
  if (!client) {
    return ctx.reply('❌ سرویس هوش مصنوعی هنوز تنظیم نشده.');
  }
  userState.set(ctx.from.id, 'waiting_ai');
  userHistory.delete(ctx.from.id); // reset history
  await ctx.reply(
    '🤖 *دستیار هوشمند*\n\nسوالت رو بپرس — هر چیزی بخوای بهت کمک می‌کنم:\n\n_(برای پایان: ❌ انصراف)_',
    {
      parse_mode: 'Markdown',
      ...Markup.keyboard([['❌ انصراف']]).resize()
    }
  );
}

async function handleAiMessage(ctx) {
  const userId = ctx.from.id;
  const text = ctx.message?.text?.trim();

  if (text === '❌ انصراف') {
    userState.delete(userId);
    userHistory.delete(userId);
    const { ownerKeyboard, adminKeyboard, userKeyboard } = require('../keyboards/mainMenu');
    const { isOwner, isAdmin } = require('../middleware/auth');
    let kb = userKeyboard;
    if (await isOwner(ctx)) kb = ownerKeyboard;
    else if (await isAdmin(ctx)) kb = adminKeyboard;
    return ctx.reply('بازگشت به منو.', kb);
  }

  if (!text) return;

  const typingMsg = await ctx.reply('⏳ در حال فکر کردن...');

  // Build conversation history
  const history = userHistory.get(userId) || [];
  history.push({ role: 'user', content: text });

  // Keep last 10 messages to avoid token overflow
  const trimmed = history.slice(-10);

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: trimmed,
    });

    const reply = response.content[0]?.text || '...';
    history.push({ role: 'assistant', content: reply });
    userHistory.set(userId, history.slice(-20));

    await ctx.telegram.editMessageText(ctx.chat.id, typingMsg.message_id, null, reply);
  } catch (e) {
    await ctx.telegram.editMessageText(ctx.chat.id, typingMsg.message_id, null,
      `❌ خطا در ارتباط با AI: ${e.message.slice(0, 100)}`);
  }
}

module.exports = { aiMenuHandler, handleAiMessage, userState };
