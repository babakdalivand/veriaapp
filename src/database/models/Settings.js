const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  singleton: { type: Boolean, default: true, unique: true },
  botEnabled: { type: Boolean, default: true },
  mainGroupId: { type: Number, default: null },
  mainChannelId: { type: Number, default: null },
  welcomeMessage: { type: String, default: 'به ArcaVox خوش آمدید! 🎙️' },
  captchaEnabled: { type: Boolean, default: true },
  antiSpamEnabled: { type: Boolean, default: true },
  antiLinkEnabled: { type: Boolean, default: true },
  warnLimit: { type: Number, default: 3 },
  updatedAt: { type: Date, default: Date.now },
});

settingsSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Settings', settingsSchema);
