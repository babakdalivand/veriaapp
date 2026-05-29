const { DataTypes } = require('sequelize');
const { sequelize } = require('../connection');

const Settings = sequelize.define('Settings', {
  botEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  mainGroupId: { type: DataTypes.BIGINT, allowNull: true },
  mainChannelId: { type: DataTypes.BIGINT, allowNull: true },
  welcomeMessage: { type: DataTypes.TEXT, defaultValue: 'به veriaapp خوش آمدید! 🎙️' },
  captchaEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  antiSpamEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  antiLinkEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  warnLimit: { type: DataTypes.INTEGER, defaultValue: 3 },
});

// helper to get or create the single settings row
Settings.getSettings = async () => {
  const [settings] = await Settings.findOrCreate({ where: { id: 1 } });
  return settings;
};

module.exports = Settings;
