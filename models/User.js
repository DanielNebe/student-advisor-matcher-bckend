const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },

  // This field replaces BOTH email & registrationNumber/staffNumber
  identifier: { type: String, required: true, unique: true },

  password: { type: String, required: true },

  role: { type: String, enum: ['student', 'advisor'], required: true },

  createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

module.exports = mongoose.model('User', userSchema);
