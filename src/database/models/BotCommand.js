const { DataTypes } = require('sequelize');
const { sequelize } = require('../connection');

const BotCommand = sequelize.define('BotCommand', {
  command: { type: DataTypes.STRING(32), allowNull: false, unique: true },
  description: { type: DataTypes.STRING(256), allowNull: false },
  response: { type: DataTypes.TEXT, allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'BotCommands' });

module.exports = BotCommand;
