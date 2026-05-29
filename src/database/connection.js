const { Sequelize } = require('sequelize');
const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS } = require('../config');

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'mysql',
  logging: false,
});

async function connectDB() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    // Add new columns that may not exist yet (safe, idempotent)
    await sequelize.query(`ALTER TABLE Users ADD COLUMN IF NOT EXISTS premiumExpiry DATETIME NULL`).catch(() => {});
    await sequelize.query(`ALTER TABLE Users MODIFY COLUMN role ENUM('user','vip','premium','admin','owner') NOT NULL DEFAULT 'user'`).catch(() => {});
    console.log('MySQL connected');
  } catch (err) {
    console.error('MySQL connection error:', err.message);
    process.exit(1);
  }
}

module.exports = { sequelize, connectDB };
