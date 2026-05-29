const express = require('express');
const { createBot } = require('../bot');
const { connectDB } = require('../database/connection');
const { PORT, USE_WEBHOOK, WEBHOOK_DOMAIN, WEBHOOK_SECRET, NODE_ENV } = require('../config');

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

  if (USE_WEBHOOK) {
    const webhookPath = `/webhook/${WEBHOOK_SECRET}`;

    await bot.telegram.setWebhook(`${WEBHOOK_DOMAIN}${webhookPath}`);
    app.use(webhookPath, bot.webhookCallback(webhookPath));

    console.log(`Webhook set: ${WEBHOOK_DOMAIN}${webhookPath}`);
  } else {
    await bot.telegram.deleteWebhook();
    bot.launch({ allowedUpdates: ['message', 'callback_query', 'chat_join_request', 'chat_member'] });
    console.log('Bot running in polling mode');
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} [${NODE_ENV}]`);
  });

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

module.exports = { startServer };
