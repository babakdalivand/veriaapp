const { DataTypes } = require('sequelize');
const { sequelize } = require('../connection');

const User = sequelize.define('User', {
  telegramId: { type: DataTypes.BIGINT, allowNull: false, unique: true },
  username: { type: DataTypes.STRING, allowNull: true },
  firstName: { type: DataTypes.STRING, allowNull: true },
  lastName: { type: DataTypes.STRING, allowNull: true },
  role: { type: DataTypes.ENUM('user', 'vip', 'admin', 'owner'), defaultValue: 'user' },
  isBlocked: { type: DataTypes.BOOLEAN, defaultValue: false },
  warnCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  lastSeen: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

module.exports = User;
