const { DataTypes } = require('sequelize');
const { sequelize } = require('../connection');

const Admin = sequelize.define('Admin', {
  telegramId: { type: DataTypes.BIGINT, allowNull: false, unique: true },
  username: { type: DataTypes.STRING, allowNull: true },
  firstName: { type: DataTypes.STRING, allowNull: true },
  addedBy: { type: DataTypes.BIGINT, allowNull: false },
  manageGroup: { type: DataTypes.BOOLEAN, defaultValue: true },
  manageContent: { type: DataTypes.BOOLEAN, defaultValue: true },
  viewStats: { type: DataTypes.BOOLEAN, defaultValue: true },
  manageAdmins: { type: DataTypes.BOOLEAN, defaultValue: false },
});

module.exports = Admin;
