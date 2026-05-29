const { Markup } = require('telegraf');
const https = require('https');

const {
  ANTHROPIC_API_KEY,
  GEMINI_API_KEY,
  OPENROUTER_API_KEY,
  DEEPSEEK_API_KEY,
} = require('../../config');

const SYSTEM_PROMPT = `تو یک دستیار هوشمند سکولار و عقل‌گرا هستی.
پاسخ‌هایت را به فارسی روان و مختصر بده.
اگر سوال به انگلیسی بود، به انگلیسی پاسخ بده.
بدون تعارف و مستقیم صحبت کن.`;

const PROVIDERS = {
  gemini: { name: 'Gemini', available: () => !!GEMINI_API_KEY },
  deepseek: { name: 'DeepSeek', available: () => !!DEEPSEEK_API_KEY },
  openrouter: { name: 'OpenRouter', available: () => !!OPENROUTER_API_KEY },
  claude: { name: 'Claude', available: () => !!ANTHROPIC_API_KEY },
};

// In-memory: userId -> { state, provider, history }
const userSessions = new Map();

function getSession(userId) {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, { state: null, provider: null, history: [] });
  }
  return userSessions.get(userId);
}

// POST request helper
function postJSON(hostname, path, body, headers) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({ hostname, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers } }, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function callGemini(history, userMsg) {
  const contents = history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  contents.push({ role: 'user', parts: [{ text: userMsg }] });

  const res = await postJSON(
    'generativelanguage.googleapis.com',
    `/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    { contents, systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] } },
    {}
  );
  return res.body?.candidates?.[0]?.content?.parts?.[0]?.text || 'خطا در دریافت پاسخ';
}

async function callOpenAICompatible(hostname, path, apiKey, model, history, userMsg) {
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...history, { role: 'user', content: userMsg }];
  const res = await postJSON(hostname, path, { model, messages, max_tokens: 1024 }, { Authorization: `Bearer ${apiKey}` });
  return res.body?.choices?.[0]?.message?.content || 'خطا در دریافت پاسخ';
}

async function callClaude(history, userMsg) {
  const messages = [...history, { role: 'user', content: userMsg }];
  const res = await postJSON(
    'api.anthropic.com', '/v1/messages',
    { model: 'claude-haiku-4-5-20251001', max_tokens: 1024, system: SYSTEM_PROMPT, messages },
    { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }
  );
  return res.body?.content?.[0]?.text || 'خطا در دریافت پاسخ';
}

async function askAI(provider, history, userMsg) {
  switch (provider) {
    case 'gemini': return callGemini(history, userMsg);
    case 'deepseek': return callOpenAICompatible('api.deepseek.com', '/v1/chat/completions', DEEPSEEK_API_KEY, 'deepseek-chat', history, userMsg);
    case 'openrouter': return callOpenAICompatible('openrouter.ai', '/api/v1/chat/completions', OPENROUTER_API_KEY, 'meta-llama/llama-3.1-8b-instruct:free', history, userMsg);
    case 'claude': return callClaude(history, userMsg);
    default: throw new Error('Provider not found');
  }
}

async function aiMenuHandler(ctx) {
  const available = Object.entries(PROVIDERS).filter(([, p]) => p.available());

  if (available.length === 0) {
    return ctx.reply('❌ هیچ سرویس AI تنظیم نشده. لطفاً API key اضافه کن.');
  }

  const buttons = available.map(([key, p]) => [Markup.button.callback(`🤖 ${p.name}`, `ai:pick:${key}`)]);

  await ctx.reply(
    '🤖 *دستیار هوشمند*\n\nکدام هوش مصنوعی؟',
    { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
  );
}

async function aiPickCallback(ctx) {
  const provider = ctx.callbackQuery.data.replace('ai:pick:', '');
  await ctx.answerCbQuery();

  const session = getSession(ctx.from.id);
  session.state = 'waiting_ai';
  session.provider = provider;
  session.history = [];

  const name = PROVIDERS[provider]?.name || provider;
  await ctx.editMessageText(
    `🤖 *${name}* آماده است!\n\nسوالت رو بپرس.\n_(❌ انصراف برای خروج)_`,
    { parse_mode: 'Markdown' }
  );
}

async function handleAiMessage(ctx) {
  const userId = ctx.from.id;
  const text = ctx.message?.text?.trim();
  const session = getSession(userId);

  if (text === '❌ انصراف') {
    session.state = null;
    session.history = [];
    const { ownerKeyboard, adminKeyboard, userKeyboard } = require('../keyboards/mainMenu');
    const { isOwner, isAdmin } = require('../middleware/auth');
    let kb = userKeyboard;
    if (await isOwner(ctx)) kb = ownerKeyboard;
    else if (await isAdmin(ctx)) kb = adminKeyboard;
    return ctx.reply('بازگشت به منو.', kb);
  }

  if (!text) return;

  const typingMsg = await ctx.reply('⏳ در حال فکر کردن...');

  try {
    const reply = await askAI(session.provider, session.history.slice(-10), text);

    session.history.push({ role: 'user', content: text });
    session.history.push({ role: 'assistant', content: reply });
    if (session.history.length > 20) session.history = session.history.slice(-20);

    await ctx.telegram.editMessageText(ctx.chat.id, typingMsg.message_id, null, reply);
  } catch (e) {
    await ctx.telegram.editMessageText(ctx.chat.id, typingMsg.message_id, null,
      `❌ خطا: ${e.message.slice(0, 100)}`);
  }
}

function isWaitingAI(userId) {
  return userSessions.get(userId)?.state === 'waiting_ai';
}

module.exports = { aiMenuHandler, aiPickCallback, handleAiMessage, isWaitingAI };
