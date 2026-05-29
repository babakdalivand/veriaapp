const { DataTypes } = require('sequelize');
const { sequelize } = require('../connection');

const Quote = sequelize.define('Quote', {
  text: { type: DataTypes.TEXT, allowNull: false },
  author: { type: DataTypes.STRING(255), allowNull: false },
  category: { type: DataTypes.STRING(100), allowNull: true },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  lastUsed: { type: DataTypes.DATE, allowNull: true },
  usedCount: { type: DataTypes.INTEGER, defaultValue: 0 },
}, { tableName: 'Quotes' });

module.exports = Quote;
