const { DataTypes } = require('sequelize');
const { sequelize } = require('../connection');

const ViolationLog = sequelize.define('ViolationLog', {
  telegramId:    { type: DataTypes.BIGINT, allowNull: false },
  firstName:     { type: DataTypes.STRING(100), allowNull: true },
  username:      { type: DataTypes.STRING(100), allowNull: true },
  groupId:       { type: DataTypes.BIGINT,      allowNull: true },
  violationType: { type: DataTypes.STRING(50),  defaultValue: 'other' },
  messageText:   { type: DataTypes.TEXT,        allowNull: true },
  action:        { type: DataTypes.STRING(20),  defaultValue: 'warn' },
  warnCount:     { type: DataTypes.INTEGER,     defaultValue: 0 },
  reason:        { type: DataTypes.STRING(500), allowNull: true },
});

module.exports = ViolationLog;
