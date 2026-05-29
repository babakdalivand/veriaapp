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
  const app = express();

  app.use(express.json());

  app.get('/', (req, res) => res.send('veriaapp is running 🎙️'));
  app.use('/api', apiRouter);
  app.use('/miniapp', express.static(path.join(__dirname, '../miniapp')));

  if (USE_WEBHOOK) {
    const webhookPath = `/webhook/${WEBHOOK_SECRET}`;

    await bot.telegram.setWebhook(`${WEBHOOK_DOMAIN}${webhookPath}`);
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

  // Keep Passenger process alive by self-pinging every 4 minutes
  setInterval(() => {
    const http = require('http');
    http.get(`http://127.0.0.1:${PORT}/`, () => {}).on('error', () => {});
  }, 4 * 60 * 1000);

  process.once('SIGINT', () => { try { bot.stop('SIGINT'); } catch {} server.close(); });
  process.once('SIGTERM', () => { try { bot.stop('SIGTERM'); } catch {} server.close(); });
}

module.exports = { startServer };
