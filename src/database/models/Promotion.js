const { DataTypes } = require('sequelize');
const { sequelize } = require('../connection');

const Promotion = sequelize.define('Promotion', {
  title:       { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT,        allowNull: true },
  imageUrl:    { type: DataTypes.TEXT,        allowNull: true },
  linkUrl:     { type: DataTypes.TEXT,        allowNull: false },
  isActive:    { type: DataTypes.BOOLEAN,     defaultValue: true },
  sortOrder:   { type: DataTypes.INTEGER,     defaultValue: 0 },
  viewCount:   { type: DataTypes.INTEGER,     defaultValue: 0 },
  clickCount:  { type: DataTypes.INTEGER,     defaultValue: 0 },
});

module.exports = Promotion;
