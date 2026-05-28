const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema({
  telegramId: { type: Number, required: true, unique: true },
  username: String,
  firstName: String,
  addedBy: { type: Number, required: true },
  addedAt: { type: Date, default: Date.now },
  permissions: {
    manageGroup: { type: Boolean, default: true },
    manageContent: { type: Boolean, default: true },
    viewStats: { type: Boolean, default: true },
    manageAdmins: { type: Boolean, default: false },
  },
});

module.exports = mongoose.model('Admin', adminSchema);
