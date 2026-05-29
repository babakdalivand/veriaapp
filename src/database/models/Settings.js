const { DataTypes } = require('sequelize');
const { sequelize } = require('../connection');

const Settings = sequelize.define('Settings', {
  botEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  mainGroupId: { type: DataTypes.STRING(255), allowNull: true },
  mainChannelId: { type: DataTypes.STRING(255), allowNull: true },
  groupIds: { type: DataTypes.TEXT, allowNull: true },
  welcomeMessage: { type: DataTypes.TEXT, defaultValue: 'به veriaapp خوش آمدید! 🎙️' },
  captchaEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  antiSpamEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  antiLinkEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  warnLimit: { type: DataTypes.INTEGER, defaultValue: 3 },
  keywords: { type: DataTypes.TEXT, allowNull: true },
});

// helper to get or create the single settings row
Settings.getSettings = async () => {
  const [settings] = await Settings.findOrCreate({ where: { id: 1 } });
  return settings;
};

module.exports = Settings;
