const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: String,
  firstName: String,
  lastName: String,
  role: { type: String, enum: ['user', 'vip', 'admin', 'owner'], default: 'user' },
  isBlocked: { type: Boolean, default: false },
  warnCount: { type: Number, default: 0 },
  joinedAt: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', userSchema);
