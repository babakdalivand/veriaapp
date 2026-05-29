const { DataTypes } = require('sequelize');
const { sequelize } = require('../connection');

const ScheduledPost = sequelize.define('ScheduledPost', {
  content:     { type: DataTypes.TEXT, allowNull: true },
  mediaType:   { type: DataTypes.ENUM('text', 'quote'), defaultValue: 'text' },
  channelId:   { type: DataTypes.STRING(255), allowNull: true },
  scheduledAt: { type: DataTypes.DATE, allowNull: false },
  isPosted:    { type: DataTypes.BOOLEAN, defaultValue: false },
  postedAt:    { type: DataTypes.DATE, allowNull: true },
  createdBy:   { type: DataTypes.BIGINT, allowNull: true },
}, { tableName: 'ScheduledPosts' });

module.exports = ScheduledPost;
