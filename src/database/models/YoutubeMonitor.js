const { DataTypes } = require('sequelize');
const { sequelize } = require('../connection');

const YoutubeMonitor = sequelize.define('YoutubeMonitor', {
  id:            { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  channelId:     { type: DataTypes.STRING(100), allowNull: false, unique: true },
  channelTitle:  { type: DataTypes.STRING(255), allowNull: false },
  channelHandle: { type: DataTypes.STRING(100), allowNull: true },
  thumbnailUrl:  { type: DataTypes.TEXT, allowNull: true },
  // JSON array of last 50 posted video IDs (prevents re-posting)
  postedIds:     { type: DataTypes.TEXT, defaultValue: '[]' },
  isActive:      { type: DataTypes.BOOLEAN, defaultValue: true },
});

module.exports = YoutubeMonitor;
