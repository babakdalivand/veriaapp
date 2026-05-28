module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  OWNER_ID: parseInt(process.env.OWNER_ID),
  MONGODB_URI: process.env.MONGODB_URI,
  WEBHOOK_DOMAIN: process.env.WEBHOOK_DOMAIN,
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || 'arcavox_secret',
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  USE_WEBHOOK: process.env.USE_WEBHOOK === 'true',
};
