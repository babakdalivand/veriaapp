const { DataTypes } = require('sequelize');
const { sequelize } = require('../connection');

const Warn = sequelize.define('Warn', {
  telegramId: { type: DataTypes.BIGINT, allowNull: false },
  groupId: { type: DataTypes.BIGINT, allowNull: false },
  reason: { type: DataTypes.STRING, defaultValue: 'تخلف' },
  warnedBy: { type: DataTypes.BIGINT, allowNull: false },
});

module.exports = Warn;
