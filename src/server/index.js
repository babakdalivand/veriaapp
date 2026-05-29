const express = require('express');
const path = require('path');
const { createBot } = require('../bot');
const { connectDB } = require('../database/connection');
const { PORT, USE_WEBHOOK, WEBHOOK_DOMAIN, WEBHOOK_SECRET, NODE_ENV } = require('../config');
const apiRouter = require('./api');

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
});

async function startServer() {
  await connectDB();

  const bot = createBot();
  const botState = require('../bot/botState');
  const { startScheduler } = require('../bot/handlers/scheduler');
  bot.telegram.getMe().then(info => { botState.username = info.username; }).catch(() => {});
  startScheduler(bot);

  const app = express();

  app.use(express.json());

  app.get('/', (req, res) => res.send('veriaapp is running 🎙️'));
  app.use('/api', apiRouter);
  app.use('/miniapp', express.static(path.join(__dirname, '../miniapp')));

  if (USE_WEBHOOK) {
    const webhookPath = `/webhook/${WEBHOOK_SECRET}`;

    await bot.telegram.setWebhook(`${WEBHOOK_DOMAIN}${webhookPath}`, {
      drop_pending_updates: false,
      max_connections: 40,
    });
    app.post(webhookPath, (req, res) => {
      res.sendStatus(200);
      bot.handleUpdate(req.body).catch(e => console.error('handleUpdate error:', e.message));
    });

    console.log(`Webhook set: ${WEBHOOK_DOMAIN}${webhookPath}`);
  } else {
    await bot.telegram.deleteWebhook();
    bot.launch({ allowedUpdates: ['message', 'callback_query', 'chat_join_request', 'chat_member'] });
    console.log('Bot running in polling mode');
  }

  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} [${NODE_ENV}]`);
  });

  // Keep Passenger process alive — ping every 90s so Passenger never idles out
  const http = require('http');
  setInterval(() => {
    http.get(`http://127.0.0.1:${PORT}/`, () => {}).on('error', () => {});
  }, 90 * 1000);

  process.once('SIGINT', () => { try { bot.stop('SIGINT'); } catch {} server.close(); });
  process.once('SIGTERM', () => { try { bot.stop('SIGTERM'); } catch {} server.close(); });
}

module.exports = { startServer };
